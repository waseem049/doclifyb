import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../types/errors';

function setRefreshCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;
        const result = await authService.register(name, email, password);
        setRefreshCookie(res, result.refreshToken);
        res.status(201).json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
    } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        setRefreshCookie(res, result.refreshToken);
        res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
    } catch (err) { next(err); }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) throw new AppError('No refresh token', 401, 'NO_REFRESH_TOKEN');
        const result = await authService.refreshTokens(token);
        setRefreshCookie(res, result.refreshToken);
        res.json({ success: true, data: { accessToken: result.accessToken } });
    } catch (err) { next(err); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await authService.logout(req.user!._id.toString());
        res.clearCookie('refreshToken');
        res.json({ success: true, message: 'Logged out' });
    } catch (err) { next(err); }
};

export const me = (req: Request, res: Response) => {
    const { _id, name, email, createdAt } = req.user!;
    res.json({ success: true, data: { id: _id, name, email, createdAt } });
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await authService.forgotPassword(req.body.email);
        res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
    } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await authService.resetPassword(req.body.token, req.body.password);
        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) { next(err); }
};
