import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog.model';
import { generateHash } from '../utils/crypto';

function getIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
        ?? req.socket.remoteAddress
        ?? 'unknown';
}

export const auditLog = (
    action: string,
    getMeta?: (req: Request) => Record<string, any>
) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const docId = req.params.id || req.params.docId || req.body?.documentId || null;
        const metadata = getMeta ? getMeta(req) : {};
        const timestamp = new Date();

        try {
            // 1. Find previous log for this specific document to get its hash
            // Only try to chain if we have a documentId
            let previousHash = '0';
            if (docId) {
                const lastLog: any = await AuditLog.findOne({ documentId: docId }).sort({ createdAt: -1 });
                if (lastLog) previousHash = lastLog.hash;
            }

            // 2. Prepare data for current hash calculation
            const logData = {
                documentId: docId,
                userId: req.user?._id,
                action,
                timestamp,
                metadata,
                previousHash
            };

            // 3. Generate SHA-256 hash
            const hash = generateHash(logData);

            // 4. Create the secure log entry
            await AuditLog.create({
                ...logData,
                ipAddress: getIp(req),
                userAgent: req.headers['user-agent'],
                hash
            });
        } catch (err) {
            console.error('❌ Secure Audit Log failed:', err);
        }

        next();
    };
};