import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import {
  verifyCredentials,
  changeUserPassword,
} from '../services/userService.js';

export const login = async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanPassword) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const { user: u, reason } = await verifyCredentials(cleanUsername, cleanPassword);

  if (reason === 'deactivated') {
    return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
  }

  if (!u) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }

  const userPayload = {
    userId: u._id.toString(),
    _id: u._id.toString(),
    username: u.username,
    name: u.name,
    role: u.role,
    mustChangePassword: Boolean(u.mustChangePassword),
    active: Boolean(u.active),
  };

  res.json({
    token: jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' }),
    user: userPayload,
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const cur = String(currentPassword || '');
  const next = String(newPassword || '');
  const conf = String(confirmPassword || '');

  if (!cur || !next || !conf) {
    return res.status(400).json({ error: 'Please fill in all password fields.' });
  }
  if (next !== conf) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }
  if (next.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }
  if (next === 'sci12345') {
    return res.status(400).json({ error: 'New password must differ from the default password (sci12345).' });
  }
  if (next === cur) {
    return res.status(400).json({ error: 'New password must differ from current password.' });
  }

  try {
    const userPayload = await changeUserPassword(req.user.username, cur, next);
    res.json({
      ok: true,
      message: 'Password changed successfully.',
      user: userPayload,
      token: jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' }),
    });
  } catch (err) {
    return res.status(err.message === 'User not found.' ? 404 : 400).json({ error: err.message });
  }
};
