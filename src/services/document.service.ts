import fs from 'fs';
import mongoose from 'mongoose';
import { PDFDocument } from 'pdf-lib';
import DocumentModel, { IDocument } from '../models/Document.model';
import { AppError } from '../types/errors';

export async function uploadDocument(ownerId: string | undefined, file: Express.Multer.File) {
    let pageCount: number | undefined;
    try {
        const bytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(bytes);
        pageCount = pdf.getPageCount();
    } catch { }

    return DocumentModel.create({
        ownerId,
        originalName: file.originalname,
        fileName: file.filename,
        filePath: file.path,
        fileSize: file.size,
        pageCount,
        isPublic: !ownerId, // Guest uploads are public by default
    });
}

export async function uploadDocuments(ownerId: string | undefined, files: Express.Multer.File[]) {
    const documents = await Promise.all(
        files.map(async (file) => {
            let pageCount: number | undefined;
            try {
                const bytes = fs.readFileSync(file.path);
                const pdf = await PDFDocument.load(bytes);
                pageCount = pdf.getPageCount();
            } catch { }

            return {
                ownerId,
                originalName: file.originalname,
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                pageCount,
                isPublic: !ownerId, // Guest uploads are public by default
            };
        })
    );

    return DocumentModel.insertMany(documents);
}

export async function listDocuments(
    ownerId: string,
    opts: { status?: string; page: number; limit: number; search?: string }
) {
    const q: Record<string, any> = { ownerId, isDeleted: false };
    if (opts.status) q.status = opts.status;
    if (opts.search) q.originalName = { $regex: opts.search, $options: 'i' };

    const [docs, total] = await Promise.all([
        DocumentModel.find(q)
            .sort({ createdAt: -1 })
            .skip((opts.page - 1) * opts.limit)
            .limit(opts.limit)
            .select('-filePath -signedFilePath -signerToken')
            .lean(),
        DocumentModel.countDocuments(q),
    ]);
    return { docs, total, page: opts.page, totalPages: Math.ceil(total / opts.limit) };
}

export async function getStatusSummary(ownerId: string) {
    const raw = await DocumentModel.aggregate([
        { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return raw.reduce((acc, r) => ({ ...acc, [r._id]: r.count }),
        { pending: 0, signed: 0, rejected: 0 });
}

export async function getDocumentById(id: string, userId?: string): Promise<IDocument> {
    const q: any = { _id: id, isDeleted: false };
    const doc = await DocumentModel.findOne(q);

    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');

    // Allow if public OR if user is owner
    if (!doc.isPublic && doc.ownerId?.toString() !== userId) {
        throw new AppError('Document not found or access denied', 404, 'DOC_NOT_FOUND');
    }

    return doc;
}

export async function softDelete(docId: string, ownerId: string) {
    await DocumentModel.updateOne({ _id: docId, ownerId }, { $set: { isDeleted: true } });
}

export async function updateDocument(docId: string, ownerId: string | undefined, updates: Partial<IDocument>) {
    const doc = await DocumentModel.findOneAndUpdate(
        { _id: docId, ownerId, isDeleted: false },
        { $set: updates },
        { new: true }
    ).select('-filePath -signedFilePath -signerToken');
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    return doc;
}

export async function getDocByToken(token: string) {
    const doc = await DocumentModel.findOne({
        signerToken: token,
        tokenExpiry: { $gt: new Date() },
        status: 'pending',
        isDeleted: false,
    });
    if (!doc) throw new AppError('Invalid or expired signing link', 404, 'TOKEN_INVALID');
    return {
        id: doc._id,
        originalName: doc.originalName,
        pageCount: doc.pageCount,
        filePath: doc.filePath,
    };
}
