import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { AppError } from '../types/errors';
import User from '../models/User.model';


export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer '))
            throw new AppError('No token provided', 401, 'NO_TOKEN');

        const token = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(token);

        const user = await User.findById(decoded.userId).select('-__v');
        if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

        req.user = user;
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError')
            return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
        if (err.name === 'JsonWebTokenError')
            return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
        next(err);
    }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return next();

        const token = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(token);

        const user = await User.findById(decoded.userId).select('-__v');
        if (user) req.user = user;

        next();
    } catch {
        next(); // Proceed as guest on any error
    }
};

