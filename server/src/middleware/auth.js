import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';

export const auth = (allowedRoles) => (req, res, next) => {
  try {
    const rawHeader = req.headers.authorization || '';
    const token = rawHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Please sign in again' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (allowedRoles) {
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again' });
  }
};
