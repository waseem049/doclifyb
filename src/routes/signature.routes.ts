import { Router, Request, Response, NextFunction } from 'express';
import * as sig from '../controllers/signature.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { requireDocOwner } from '../middleware/ownership.middleware';
import { auditLog } from '../middleware/audit.middleware';
import { validatePlacement, validateShare, validateFinalize, validateReject, validateAddSigner, validateSelfSign } from '../validators/signature.validator';
import { handleValidation } from '../middleware/handleValidation.middleware';

const router = Router();

// Owner/Guest: place field
router.post('/',
    optionalAuth, validatePlacement, handleValidation,
    auditLog('sig:placed', req => ({ documentId: req.body.documentId, page: req.body.page, type: req.body.type })),
    sig.place
);

// Owner/Guest: list fields for a doc
router.get('/:docId',
    optionalAuth,
    (req: Request, _res: Response, next: NextFunction) => { req.params.id = req.params.docId; next(); },
    sig.list
);

// Owner/Guest: delete a field
router.delete('/:id', optionalAuth, sig.remove);

// Owner/Guest: update a field (coordinates, etc.)
router.patch('/:id', optionalAuth, sig.update);

// Owner/Guest: assign field to signer
router.patch('/assign/:id', optionalAuth, sig.updateAssignment);

// Owner: generate share link (single signer - backward compatible)
router.post('/share/:docId',
    authMiddleware,
    (req: Request, _res: Response, next: NextFunction) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    validateShare, handleValidation,
    auditLog('link:generated', req => ({ signerEmail: req.body.signerEmail })),
    sig.generateLink
);

// Owner: add additional signer
router.post('/signers/:docId',
    authMiddleware,
    (req: Request, _res: Response, next: NextFunction) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    validateAddSigner, handleValidation,
    auditLog('signer:added', req => ({ documentId: req.params.docId, signerEmail: req.body.signerEmail })),
    sig.addSigner
);

// Owner: list signers
router.get('/signers/:docId',
    authMiddleware,
    (req: Request, _res: Response, next: NextFunction) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    sig.listSigners
);

// Owner: remove signer
router.delete('/signers/:docId/:signerEmail',
    authMiddleware,
    (req: Request, _res: Response, next: NextFunction) => { req.params.id = req.params.docId; next(); },
    requireDocOwner,
    sig.removeSigner
);

// Public: signer submits
router.post('/finalize',
    validateFinalize, handleValidation,
    auditLog('sig:finalized', req => ({ token: (req.body.token as string).slice(0, 8) + '...' })),
    sig.finalize
);

// Public: signer rejects
router.put('/reject',
    validateReject, handleValidation,
    auditLog('sig:rejected'),
    sig.reject
);

// Public: get signature fields by token
router.get('/public/:token', sig.getFieldsByToken);

// Owner/Guest: self sign (sign & download)
router.post('/self-sign',
    optionalAuth, validateSelfSign, handleValidation,
    auditLog('sig:self-signed', req => ({ documentId: req.body.documentId })),
    sig.selfSign
);

export default router;
