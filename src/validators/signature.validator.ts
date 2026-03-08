import { body } from 'express-validator';

export const validatePlacement = [
    body('documentId').isMongoId().withMessage('Invalid document ID'),
    body('xPercent').isFloat({ min: 0, max: 100 }),
    body('yPercent').isFloat({ min: 0, max: 100 }),
    body('widthPercent').isFloat({ min: 1, max: 100 }),
    body('heightPercent').isFloat({ min: 1, max: 100 }),
    body('page').isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    body('type').optional().isIn(['signature', 'text', 'date', 'initials']),
    body('assignedTo').optional().trim().isEmail().normalizeEmail(),
];

export const validateSelfSign = [
    body('documentId').isMongoId().withMessage('Invalid document ID'),
    body('fields').isArray({ min: 1 }).withMessage('Fields array required'),
    body('fields.*.fieldId').isMongoId().withMessage('Invalid field ID'),
    body('fields.*.imageData').optional()
        .matches(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,/)
        .withMessage('Invalid image format'),
    body('fields.*.value').optional().trim(),
];

export const validateShare = [
    body('signerEmail').trim().isEmail().normalizeEmail()
        .withMessage('Valid signer email required'),
];

export const validateAddSigner = [
    body('signerEmail').trim().isEmail().normalizeEmail()
        .withMessage('Valid signer email required'),
];

export const validateFinalize = [
    body('token').notEmpty().withMessage('Token required'),
    body('fields').isArray({ min: 1 }).withMessage('Fields array required'),
    body('fields.*.fieldId').isMongoId().withMessage('Invalid field ID'),
    body('fields.*.imageData').optional()
        .matches(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,/)
        .withMessage('Invalid image format'),
    body('fields.*.value').optional().trim(),
];

export const validateReject = [
    body('token').notEmpty().withMessage('Token required'),
    body('reason').trim().isLength({ min: 10, max: 500 })
        .withMessage('Reason must be 10–500 characters'),
];
