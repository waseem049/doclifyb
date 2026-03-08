import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } from '../validators/auth.validator';
import { handleValidation } from '../middleware/handleValidation.middleware';

const router = Router();

router.post('/register', validateRegister, handleValidation, auth.register);
router.post('/login', validateLogin, handleValidation, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', authMiddleware, auth.logout);
router.get('/me', authMiddleware, auth.me);
router.post('/forgot-password', validateForgotPassword, handleValidation, auth.forgotPassword);
router.post('/reset-password', validateResetPassword, handleValidation, auth.resetPassword);

export default router;
