import { Request, Response, NextFunction } from 'express';
import * as sigService from '../services/signature.service';

function getIp(req: Request) {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
        ?? req.socket.remoteAddress ?? 'unknown';
}

export const place = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        const sig = await sigService.savePlacement(userId, req.body);
        res.status(201).json({ success: true, data: sig });
    } catch (err) { next(err); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sigs = await sigService.getPlacementsForDoc(req.params.docId);
        res.json({ success: true, data: sigs });
    } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        await sigService.removePlacement(req.params.id, userId);
        res.json({ success: true, message: 'Field removed' });
    } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        const sig = await sigService.updatePlacement(
            req.params.id,
            userId,
            req.body
        );
        res.json({ success: true, data: sig });
    } catch (err) { next(err); }
};

export const generateLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const emails = Array.isArray(req.body.signerEmail)
            ? req.body.signerEmail
            : [req.body.signerEmail];

        const result = await sigService.addSigners(
            req.params.docId, req.user!._id.toString(), emails
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const finalize = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await sigService.finalizePDF(req.body.token, req.body.fields, getIp(req));
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const updateAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        const field = await sigService.updateFieldAssignment(
            req.params.id,
            userId,
            req.body.assignedTo
        );
        res.json({ success: true, data: field });
    } catch (err) { next(err); }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await sigService.rejectDocument(req.body.token, req.body.reason, getIp(req));
        res.json({ success: true, message: 'Document rejected' });
    } catch (err) { next(err); }
};

export const getFieldsByToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fields = await sigService.getFieldsByToken(req.params.token);
        res.json({ success: true, data: fields });
    } catch (err) { next(err); }
};

export const addSigner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const emails = Array.isArray(req.body.signerEmail)
            ? req.body.signerEmail
            : [req.body.signerEmail];

        const result = await sigService.addSigners(
            req.params.docId, req.user!._id.toString(), emails
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const listSigners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const signers = await sigService.getSigners(req.params.docId, req.user!._id.toString());
        res.json({ success: true, data: signers });
    } catch (err) { next(err); }
};

export const removeSigner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await sigService.removeSigner(
            req.params.docId, req.user!._id.toString(), req.params.signerEmail
        );
        res.json({ success: true, message: 'Signer removed' });
    } catch (err) { next(err); }
};

export const sendReminder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await sigService.sendReminder(
            req.params.docId, req.user!._id.toString(), req.body.signerEmail
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const reorderSigners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await sigService.reorderSigners(
            req.params.docId, req.user!._id.toString(), req.body.order
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};

export const selfSign = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id?.toString();
        console.log('API Request: /api/signatures/self-sign', {
            documentId: req.body.documentId,
            fieldsCount: req.body.fields?.length,
            userId
        });
        const result = await sigService.selfSign(
            req.body.documentId,
            userId,
            req.body.fields
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
};
