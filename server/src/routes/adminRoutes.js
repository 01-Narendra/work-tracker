import { Router } from 'express';
import {
  getUpdates,
  downloadExcel,
  getUsers,
  createUser,
  resetPassword,
  updateUser,
  getSystemSettings,
  toggleCurrentWeekUpdates,
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
router.get('/superadmin/system-settings', auth('superadmin'), asyncHandler(getSystemSettings));
router.post('/superadmin/toggle-current-week-updates', auth('superadmin'), asyncHandler(toggleCurrentWeekUpdates));

export default router;
