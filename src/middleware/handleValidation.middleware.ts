import { validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";

export const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            errors: errors.array().map(err => ({
                field: err.type === 'field' ? err.path : 'unknown',
                message: err.msg
            }))
        });
    }       
    next();
};