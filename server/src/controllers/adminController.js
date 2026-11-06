import mongoose from 'mongoose';
import Update from '../models/Update.js';
import User from '../models/User.js';
import { streamExcelExport } from '../services/excelService.js';
import { formatHoursWorked } from '../utils/time.js';
import {
  createNewUser,
  resetUserPassword,
  updateUserDetails,
} from '../services/userService.js';
import {
  isCurrentWeekUpdatesAllowed,
  setCurrentWeekUpdatesAllowed,
} from '../services/settingService.js';

/**
 * Returns visible users and their IDs based on the caller's role.
 * Super Admin: sees all employees (and admins).
 * Plain Admin: sees ONLY their assigned employees (and themselves so they can see their own updates).
 */
async function getVisibleEmployees(reqUser) {
  const isSuperAdmin = reqUser.role === 'superadmin';

  if (isSuperAdmin) {
    const visibleUsers = await User.find({ role: { $in: ['employee', 'admin'] } })
      .select('_id name username hiddenFromAdmin active assignedAdmins role')
      .lean();
    return {
      isSuperAdmin: true,
      visibleUsers,
      visibleUserIds: visibleUsers.map((u) => u._id),
    };
  }

  // Plain Admin
  let adminId = reqUser.userId || reqUser._id;
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    const found = await User.findOne({ username: reqUser.username }).select('_id');
    adminId = found?._id;
  }

  // Find all users (employees or other admins) assigned to this specific admin
  const assignedUsers = await User.find({
    role: { $in: ['employee', 'admin'] },
    assignedAdmins: adminId,
  })
    .select('_id name username hiddenFromAdmin active assignedAdmins role')
    .lean();

  // Also include the admin user themselves so their own updates can appear
  const adminUser = await User.findById(adminId)
    .select('_id name username active role')
    .lean();

  const combined = adminUser ? [...assignedUsers, adminUser] : assignedUsers;

  // Deduplicate in case admin was also in assigned list
  const visibleUsers = Array.from(
    new Map(combined.map((u) => [u._id.toString(), u])).values()
  );

  return {
    isSuperAdmin: false,
    visibleUsers,
    visibleUserIds: visibleUsers.map((u) => u._id),
  };
}

/**
 * Builds the MongoDB query respecting the role visibility and incoming filters.
 */
async function buildUpdatesQuery(reqUser, queryParams) {
  const { from, to, name, status } = queryParams;
  const { visibleUsers, visibleUserIds } = await getVisibleEmployees(reqUser);

  const filter = {
    userId: { $in: visibleUserIds },
  };

  // Date range filter
  if (from && to) {
    filter.date = { $gte: String(from).slice(0, 10), $lte: String(to).slice(0, 10) };
  } else if (from) {
    filter.date = { $gte: String(from).slice(0, 10) };
  } else if (to) {
    filter.date = { $lte: String(to).slice(0, 10) };
  }

  // Employee filter: must match a visible employee
  if (name) {
    const cleanName = String(name).trim().toLowerCase();
    const matched = visibleUsers.find((u) => u.name.toLowerCase() === cleanName);
    if (matched) {
      filter.userId = matched._id;
    } else {
      // If user filtered for a name not visible to them, return no results
      filter.userId = new mongoose.Types.ObjectId();
    }
  }

  // Status filter
  if (status) {
    filter.status = String(status).trim();
  }

  return { filter, visibleUsers, visibleUserIds };
}

export const getUpdates = async (req, res) => {
  const { filter, visibleUsers } = await buildUpdatesQuery(req.user, req.query);

  const rawRows = await Update.find(filter).sort({ date: -1, employeeName: 1 }).lean();

  // Summary counts query: matches the same filters EXCEPT status so user can see counts per status
  const countFilter = { ...filter };
  delete countFilter.status;

  const countsAgg = await Update.aggregate([
    { $match: countFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = { Present: 0, Partial: 0, Absent: 0 };
  countsAgg.forEach((item) => {
    if (counts[item._id] !== undefined) counts[item._id] = item.count;
  });

  // Employee filter list: only visible employees!
  const employees = visibleUsers.map((u) => u.name).sort();

  const rows = rawRows.map((r) => ({
    ...r,
    name: r.employeeName,
    morning: r.morningUpdate,
    evening: r.eveningUpdate,
    hoursWorked: r.hoursWorked ? formatHoursWorked(r.hoursWorked) : '',
    weeklyTargetStatus: r.weeklyTargetStatus || '',
    weeklyTargetReason: r.weeklyTargetReason || '',
  }));

  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();

  res.json({ rows, counts, employees, allowCurrentWeekUpdates });
};

export const downloadExcel = async (req, res) => {
  const { filter } = await buildUpdatesQuery(req.user, req.query);

  const cursor = Update.find(filter).sort({ date: -1, employeeName: 1 }).cursor();

  await streamExcelExport({
    res,
    filename: 'work_updates.xlsx',
    cursor,
  });
};

export const getUsers = async (_req, res) => {
  const allUsers = await User.find({})
    .populate('assignedAdmins', '_id name username')
    .sort({ role: 1, name: 1 })
    .lean();

  const admins = allUsers
    .filter((u) => u.role === 'admin' && u.active !== false)
    .map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      username: u.username,
    }));

  const users = allUsers.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    username: u.username,
    role: u.role,
    hiddenFromAdmin: Boolean(u.hiddenFromAdmin),
    assignedAdmins: Array.isArray(u.assignedAdmins)
      ? u.assignedAdmins.map((a) => ({
          _id: (a._id || a).toString(),
          name: a.name || '',
          username: a.username || '',
        }))
      : [],
    mustChangePassword: Boolean(u.mustChangePassword),
    active: u.active !== false,
    createdAt: u.createdAt || '',
  }));

  res.json({ users, admins });
};

export const createUser = async (req, res) => {
  const { name, username, role, hiddenFromAdmin, assignedAdmins } = req.body || {};
  try {
    const user = await createNewUser({ name, username, role, hiddenFromAdmin, assignedAdmins });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  const { username } = req.body || {};
  try {
    const u = await resetUserPassword(username);
    res.json({
      ok: true,
      message: `Password for "${u.name}" (${u.username}) has been reset to sci12345. They will be required to change it on next login.`,
    });
  } catch (err) {
    res.status(err.message === 'User not found.' ? 404 : 400).json({ error: err.message });
  }
};

export const updateUser = async (req, res) => {
  const targetUsername = req.params.username;
  const { role, hiddenFromAdmin, name, active, assignedAdmins } = req.body || {};
  try {
    const user = await updateUserDetails(targetUsername, {
      role,
      hiddenFromAdmin,
      name,
      active,
      assignedAdmins,
    });
    res.json({ user });
  } catch (err) {
    res.status(err.message === 'User not found.' ? 404 : 400).json({ error: err.message });
  }
};

export const getSystemSettings = async (_req, res) => {
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();
  res.json({ allowCurrentWeekUpdates });
};

export const toggleCurrentWeekUpdates = async (req, res) => {
  const current = await isCurrentWeekUpdatesAllowed();
  const nextVal = req.body?.allowed !== undefined ? Boolean(req.body.allowed) : !current;
  const updated = await setCurrentWeekUpdatesAllowed(nextVal, req.user?.username || 'superadmin');

  res.json({
    ok: true,
    allowCurrentWeekUpdates: updated,
    message: updated
      ? 'Current week updates enabled. Employees and Admins can now add or update their check-in, check-out, and updates for any day of the current week.'
      : 'Current week updates disabled. Morning (9:00 AM - 1:00 PM) and evening (1:00 PM - 11:55 PM) window restrictions restored.',
  });
};
