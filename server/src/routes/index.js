import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = Router();

router.use('/', authRoutes);
router.use('/', employeeRoutes);
router.use('/', adminRoutes);

export default router;

