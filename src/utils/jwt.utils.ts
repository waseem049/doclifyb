import jwt from 'jsonwebtoken';

export function generateTokens(userId: string) {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as any }
    );
    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as any }
    );
    return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): { userId: string } {
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
}

export function verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
}