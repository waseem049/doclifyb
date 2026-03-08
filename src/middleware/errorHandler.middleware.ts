import {Request, Response, NextFunction} from 'express';
import { AppError } from '../types/errors';

export const globalErrorHandler = (
    err: any, _req: Request, res: Response, _next: NextFunction
) => {
    console.error('Error:', err);
    if(err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e: any) => e.message);
        return res.status(422).json({
            success: false,
            code: 'VALIDATION_ERROR',
            errors: messages
        });
    }
    if(err.code === 11000) {
        const field = Object.keys(err.keyValue)[0] ?? 'field';
        return res.status(409).json({
            success: false,
            code: 'DUPLICATE_KEY',
            message: `Duplicate value for ${field}`
        });
    }
    if(err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            code: 'FILE_TOO_LARGE',
            message: 'Uploaded file is too large'
        });
    }
    if(err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            code: err.code,
            message: err.message
        });
    }

    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: 'Internal server error'
    });
};