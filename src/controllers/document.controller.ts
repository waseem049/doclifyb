import { Request, Response, NextFunction } from 'express';
import * as docService from '../services/document.service';
import path from 'path';
import fs from 'fs';
import DocumentModel from '../models/Document.model';
import { AppError } from '../types/errors';

export const upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = req.file || (req.files as Express.Multer.File[])?.[0];
        if (!file) throw new AppError('No file uploaded', 400, 'NO_FILE');

        const ownerId = req.user?._id?.toString();

        // If multiple files were uploaded, we might want to handle them all
        // But for backward compatibility with the current frontend expectation (single doc),
        // we'll process either the single file or the first of the array.
        const doc = await docService.uploadDocument(ownerId, file);

        res.status(201).json({ success: true, data: doc });
    } catch (err) { next(err); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const results = await docService.listDocuments(req.user!._id.toString(), {
            page, limit, status, search
        });
        res.json({ success: true, data: results });
    } catch (err) { next(err); }
};

export const summary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const counts = await docService.getStatusSummary(req.user!._id.toString());
        res.json({ success: true, data: counts });
    } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const doc = await docService.getDocumentById(req.params.id, req.user?._id?.toString());
        res.json({ success: true, data: doc });
    } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await docService.softDelete(req.params.id, req.user!._id.toString());
        res.json({ success: true, message: 'Document deleted' });
    } catch (err) { next(err); }
};

export const getByToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const doc = await docService.getDocByToken(req.params.token);
        res.json({ success: true, data: doc });
    } catch (err) { next(err); }
};

export const download = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const doc = await DocumentModel.findById(req.params.id);
        if (!doc || doc.isDeleted) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');

        const isOwner = doc.ownerId?.toString() === req.user?._id?.toString();
        if (!doc.isPublic && !isOwner) {
            throw new AppError('Forbidden', 403, 'FORBIDDEN');
        }

        if (doc.status !== 'signed' || !doc.signedFilePath) {
            return next({ statusCode: 400, code: 'NOT_SIGNED', message: 'Document has not been signed yet' });
        }

        if (!fs.existsSync(doc.signedFilePath)) {
            return next({ statusCode: 404, code: 'FILE_NOT_FOUND', message: 'Signed file not found' });
        }

        res.download(doc.signedFilePath, `signed-${doc.originalName}`);
    } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        const doc = await docService.updateDocument(req.params.id, userId, req.body);
        res.json({ success: true, data: doc });
    } catch (err) { next(err); }
};
