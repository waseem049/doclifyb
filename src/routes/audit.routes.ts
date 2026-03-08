import { Router } from 'express';
import AuditLog from '../models/AuditLog.model';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireDocOwner } from '../middleware/ownership.middleware';
import { generateHash } from '../utils/crypto';

const router = Router();

router.get('/user/me', authMiddleware, async (req, res, next) => {
    try {
        const logs = await AuditLog
            .find({ userId: req.user!._id })
            .sort({ createdAt: -1 })
            .limit(500)
            .populate('documentId', 'originalName status')
            .lean();
        res.json({ success: true, data: logs });
    } catch (err) { next(err); }
});

router.get('/verify/:docId',
    authMiddleware,
    (req, _res, next) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    async (req, res, next) => {
        try {
            const logs: any[] = await AuditLog
                .find({ documentId: req.params.docId })
                .sort({ createdAt: 1 })
                .lean();

            let isValid = true;
            const details = [];

            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                const prev = i > 0 ? logs[i - 1] : null;
                const prevHash = prev ? prev.hash : '0';

                // Recalculate hash (must match the structure in audit.middleware.ts)
                const dataToHash = {
                    documentId: log.documentId.toString(),
                    userId: log.userId ? log.userId.toString() : undefined,
                    action: log.action,
                    timestamp: log.timestamp,
                    metadata: log.metadata,
                    previousHash: log.previousHash
                };

                const calcHash = generateHash(dataToHash);
                const hasCorrectHash = calcHash === log.hash;
                const hasCorrectLink = log.previousHash === prevHash;

                if (!hasCorrectHash || !hasCorrectLink) isValid = false;

                details.push({
                    id: log._id,
                    action: log.action,
                    hasCorrectHash,
                    hasCorrectLink,
                    timestamp: log.timestamp
                });
            }

            res.json({ success: true, isValid, details });
        } catch (err) { next(err); }
    }
);

router.get('/:docId',
    authMiddleware,
    (req, _res, next) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    async (req, res, next) => {
        try {
            const logs = await AuditLog
                .find({ documentId: req.params.docId })
                .sort({ createdAt: -1 })
                .limit(200)
                .populate('userId', 'name email')
                .lean();
            res.json({ success: true, data: logs });
        } catch (err) { next(err); }
    }
);

export default router;
