import { NextFunction, Request, Response } from 'express';
import {AppError} from '../types/errors';
import Document from '../models/Document.model';

export const requireDocOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const doc = await Document.findOne({
            _id: req.params.id,
            ownerId: req.user?._id,
            isDeleted: false
        });
        if(!doc) throw new AppError('Document not found or access denied', 404, 'DOC_NOT_FOUND');
        req.document = doc;
        next();
    } catch (err) {
        next(err);
    }
};