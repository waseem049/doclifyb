import 'dotenv/config';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { connectDB } from './config/database';
import { globalErrorHandler } from './middleware/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import signatureRoutes from './routes/signature.routes';
import auditRoutes from './routes/audit.routes';

// Ensure upload dirs exist in dev
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
const signedDir = path.join(uploadDir, 'signed');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });

const app = express();

// ── Security ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.options('*', cors());

// ── Parsing ────────────────────────────────────────────────────
app.use(compression() as any);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Static uploads (dev only) ──────────────────────────────────
app.use('/uploads', express.static(uploadDir));

// ── Rate limiting ──────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, code: 'TOO_MANY_REQUESTS' },
});
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/docs', apiLimiter, documentRoutes);
app.use('/api/signatures', apiLimiter, signatureRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);

// ── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'error',
        database: dbStatus,
        ts: new Date().toISOString()
    });
});

// ── 404 ────────────────────────────────────────────────────────
app.use((_req, res) =>
    res.status(404).json({ success: false, code: 'NOT_FOUND' })
);

// ── Error handler ──────────────────────────────────────────────
app.use(globalErrorHandler);

// ── Bootstrap ──────────────────────────────────────────────────
async function bootstrap() {
    await connectDB();
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, '0.0.0.0', () =>
        console.log(`\n🚀 Server running on port ${port} [${process.env.NODE_ENV}]\n`)
    );
}

bootstrap().catch(err => { console.error(err); process.exit(1); });

export default app;
