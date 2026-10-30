import { Router } from 'express';
import {
  getUpdates,
  downloadExcel,
  getUsers,
  createUser,
  resetPassword,
  updateUser,
} from '../controllers/adminController.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Admin and Super Admin routes
router.get('/admin/updates', auth(['admin', 'superadmin']), asyncHandler(getUpdates));
router.get('/admin/download', auth(['admin', 'superadmin']), asyncHandler(downloadExcel));

// Super Admin only routes
router.get('/superadmin/users', auth('superadmin'), asyncHandler(getUsers));
router.post('/superadmin/users', auth('superadmin'), asyncHandler(createUser));
router.post('/superadmin/reset-password', auth('superadmin'), asyncHandler(resetPassword));
router.patch('/superadmin/users/:username', auth('superadmin'), asyncHandler(updateUser));

export default router;
