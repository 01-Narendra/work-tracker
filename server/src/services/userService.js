import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export const loadUsers = async () => {
  return User.find({}).populate('assignedAdmins', '_id name username').sort({ name: 1 }).lean();
};

export const findUserByUsername = async (username) => {
  if (!username) return null;
  const clean = String(username).trim().toLowerCase();
  return User.findOne({ username: clean });
};

export const findUserByName = async (name) => {
  if (!name) return null;
  const clean = String(name).trim();
  return User.findOne({ name: { $regex: new RegExp(`^${clean}$`, 'i') } });
};

export const verifyCredentials = async (username, password) => {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const u = await User.findOne({ username: cleanUsername });
  if (!u) {
    return { user: null, reason: 'notFound' };
  }

  const matches = bcrypt.compareSync(String(password || ''), u.passwordHash);
  if (!matches) {
    return { user: null, reason: 'invalidPassword' };
  }

  if (u.active === false) {
    return { user: null, reason: 'deactivated' };
  }

  return { user: u, reason: null };
};

export const changeUserPassword = async (username, currentPassword, newPassword) => {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const u = await User.findOne({ username: cleanUsername });
  if (!u) {
    throw new Error('User not found.');
  }

  if (!bcrypt.compareSync(String(currentPassword || ''), u.passwordHash)) {
    throw new Error('Current password is incorrect.');
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  if (newPassword === 'sci12345') {
    throw new Error('New password must differ from the default password (sci12345).');
  }

  if (newPassword === currentPassword) {
    throw new Error('New password must differ from current password.');
  }

  u.passwordHash = bcrypt.hashSync(newPassword, 10);
  u.mustChangePassword = false;
  await u.save();

  return {
    _id: u._id,
    username: u.username,
    name: u.name,
    role: u.role,
    mustChangePassword: false,
    active: u.active,
  };
};

export const createNewUser = async ({
  name,
  username,
  role = 'employee',
  hiddenFromAdmin = false,
  assignedAdmins = [],
}) => {
  const cleanName = String(name || '').trim();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanRole = String(role).trim().toLowerCase();

  if (!cleanName || !cleanUsername) {
    throw new Error('Name and username are required.');
  }
  if (!['employee', 'admin', 'superadmin'].includes(cleanRole)) {
    throw new Error('Role must be employee, admin, or superadmin.');
  }

  const existingUsername = await User.findOne({ username: cleanUsername });
  if (existingUsername) {
    throw new Error(`Username "${cleanUsername}" is already taken.`);
  }

  const existingName = await User.findOne({
    name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
  });
  if (existingName) {
    throw new Error(`An employee named "${cleanName}" already exists.`);
  }

  const newUser = await User.create({
    name: cleanName,
    username: cleanUsername,
    passwordHash: bcrypt.hashSync('sci12345', 10),
    role: cleanRole,
    hiddenFromAdmin: Boolean(hiddenFromAdmin),
    assignedAdmins: Array.isArray(assignedAdmins) ? assignedAdmins : [],
    mustChangePassword: true,
    active: true,
    createdAt: new Date().toISOString().slice(0, 10),
  });

  return {
    _id: newUser._id,
    name: newUser.name,
    username: newUser.username,
    role: newUser.role,
    hiddenFromAdmin: newUser.hiddenFromAdmin,
    assignedAdmins: newUser.assignedAdmins,
    mustChangePassword: newUser.mustChangePassword,
    active: newUser.active,
    createdAt: newUser.createdAt,
  };
};

export const resetUserPassword = async (username) => {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const u = await User.findOne({ username: cleanUsername });
  if (!u) {
    throw new Error('User not found.');
  }

  u.passwordHash = bcrypt.hashSync('sci12345', 10);
  u.mustChangePassword = true;
  await u.save();
  return u;
};

export const updateUserDetails = async (
  username,
  { role, hiddenFromAdmin, name, active, assignedAdmins }
) => {
  const targetUsername = String(username || '').trim().toLowerCase();
  const u = await User.findOne({ username: targetUsername });
  if (!u) {
    throw new Error('User not found.');
  }

  if (role !== undefined) {
    const cleanRole = String(role).trim().toLowerCase();
    if (!['employee', 'admin', 'superadmin'].includes(cleanRole)) {
      throw new Error('Invalid role.');
    }
    u.role = cleanRole;
  }
  if (hiddenFromAdmin !== undefined) {
    u.hiddenFromAdmin = Boolean(hiddenFromAdmin);
  }
  if (active !== undefined) {
    u.active = Boolean(active);
  }
  if (assignedAdmins !== undefined) {
    u.assignedAdmins = Array.isArray(assignedAdmins) ? assignedAdmins : [];
  }
  if (name !== undefined && String(name).trim()) {
    const cleanName = String(name).trim();
    // Check if new name is taken by another user
    const conflict = await User.findOne({
      _id: { $ne: u._id },
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });
    if (conflict) {
      throw new Error(`An employee named "${cleanName}" already exists.`);
    }
    u.name = cleanName;
  }

  await u.save();

  return {
    _id: u._id,
    name: u.name,
    username: u.username,
    role: u.role,
    hiddenFromAdmin: Boolean(u.hiddenFromAdmin),
    assignedAdmins: u.assignedAdmins || [],
    mustChangePassword: Boolean(u.mustChangePassword),
    active: Boolean(u.active),
    createdAt: u.createdAt,
  };
};
