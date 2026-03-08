import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User.model';
import { AppError } from '../types/errors';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.utils';
import * as emailService from './email.service';

export async function register(name: string, email: string, password: string) {
    const existing = await User.findOne({ email });
    if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id.toString());
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();
    return { user: { id: user._id, name, email }, accessToken, refreshToken };
}

export async function login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const match = await user.comparePassword(password);
    if (!match) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const { accessToken, refreshToken } = generateTokens(user._id.toString());
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();
    return { user: { id: user._id, name: user.name, email }, accessToken, refreshToken };
}

export async function refreshTokens(incomingToken: string) {
    let payload: { userId: string };
    try {
        payload = verifyRefreshToken(incomingToken);
    } catch {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(payload.userId).select('+refreshToken');
    if (!user?.refreshToken)
        throw new AppError('Session expired', 401, 'SESSION_EXPIRED');

    const valid = await bcrypt.compare(incomingToken, user.refreshToken);
    if (!valid) throw new AppError('Token reuse detected', 401, 'TOKEN_REUSE');

    const { accessToken, refreshToken } = generateTokens(user._id.toString());
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();
    return { accessToken, refreshToken };
}

export async function logout(userId: string) {
    await User.updateOne({ _id: userId }, { $set: { refreshToken: null } });
}

export async function forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetExpiry;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(email, resetUrl);
}

export async function resetPassword(token: string, newPassword: string) {
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
}
