import { Router } from 'express';
import {
  getMyToday,
  saveWeeklyPlan,
  submitWeeklyTargetStatus,
  checkIn,
  checkOut,
  updateText,
  updateDay,
  getMyHistory,
  downloadMyExcel,
} from '../controllers/employeeController.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Only employee and admin can log work updates (superadmin does not submit updates)
const updateRoles = ['employee', 'admin'];

router.get('/my-today', auth(updateRoles), asyncHandler(getMyToday));
router.post('/weekly-plan', auth(updateRoles), asyncHandler(saveWeeklyPlan));
router.post('/weekly-target-status', auth(updateRoles), asyncHandler(submitWeeklyTargetStatus));
router.post('/check-in', auth(updateRoles), asyncHandler(checkIn));
router.post('/check-out', auth(updateRoles), asyncHandler(checkOut));
router.post('/update', auth(updateRoles), asyncHandler(updateText));
router.post('/update-day', auth(updateRoles), asyncHandler(updateDay));
router.get('/my-history', auth(updateRoles), asyncHandler(getMyHistory));
router.get('/my-download', auth(updateRoles), asyncHandler(downloadMyExcel));

export default router;
