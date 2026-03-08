import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../types/errors';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = process.env.UPLOAD_DIR ?? './uploads';
        if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9 .-]/g, '_');
        cb(null, `${Date.now()}-${safeFilename}`);
    }
});

export const uploadPdf = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new AppError('Only PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
        }
        cb(null, true);
    }
}).array('pdfs', 10); // Accept up to 10 PDFs at once
