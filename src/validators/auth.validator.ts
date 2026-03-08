import { body } from 'express-validator';

export const validateRegister = [
    body('name').trim().notEmpty().isLength({ min: 2, max: 80 })
        .withMessage('Name must be 2–80 characters'),
    body('email').trim().isEmail().normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .isLength({ min: 8 }).withMessage('Minimum 8 characters')
        .matches(/[A-Z]/).withMessage('Needs an uppercase letter')
        .matches(/[a-z]/).withMessage('Needs a lowercase letter')
        .matches(/[0-9]/).withMessage('Needs a digit'),
];

export const validateLogin = [
    body('email').trim().isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
];

export const validateForgotPassword = [
    body('email').trim().isEmail().normalizeEmail()
        .withMessage('Valid email required'),
];

export const validateResetPassword = [
    body('token').notEmpty().withMessage('Token required'),
    body('password')
        .isLength({ min: 8 }).withMessage('Minimum 8 characters')
        .matches(/[A-Z]/).withMessage('Needs an uppercase letter')
        .matches(/[a-z]/).withMessage('Needs a lowercase letter')
        .matches(/[0-9]/).withMessage('Needs a digit'),
];
