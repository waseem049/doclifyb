import { Router } from 'express';
import * as doc from '../controllers/document.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { requireDocOwner } from '../middleware/ownership.middleware';
import { uploadPdf } from '../middleware/upload.middleware';
import { auditLog } from '../middleware/audit.middleware';

const router = Router();

// Public
router.get('/sign/:token',
    auditLog('link:accessed', req => ({ token: req.params.token?.slice(0, 8) + '...' })),
    doc.getByToken
);

// Protected / Guest
router.post('/upload',
    optionalAuth, uploadPdf,
    auditLog('doc:uploaded', req => ({
        originalName: req.file?.originalname || (req.files as any)?.[0]?.originalname,
        isGuest: !req.user
    })),
    doc.upload
);

router.get('/summary', authMiddleware, doc.summary);
router.get('/', authMiddleware, doc.list);
router.get('/:id', optionalAuth, doc.getById); // Controller handles permission
router.patch('/:id', optionalAuth, doc.update);
router.get('/:id/download', doc.download); // Controller handles permission logic
router.delete('/:id', authMiddleware, requireDocOwner, doc.remove);

export default router;
