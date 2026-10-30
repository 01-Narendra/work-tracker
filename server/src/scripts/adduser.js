import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const args = process.argv.slice(2);
const rawName = args[0];
const rawUsername = args[1];
const rawPassword = args[2];
const rawRole = args[3];
const rawHidden = args[4];

const name = rawName?.trim();
const username = rawUsername?.trim()?.toLowerCase();
const password = rawPassword && rawPassword !== '-' ? rawPassword.trim() : 'sci12345';
const role = rawRole ? rawRole.trim().toLowerCase() : 'employee';
const hiddenFromAdmin = rawHidden === 'true' || rawHidden === 'hidden' || rawHidden === '1';

if (!name || !username || !['employee', 'admin', 'superadmin'].includes(role)) {
  console.log('Usage: node adduser.js "Full Name" username [password] [employee|admin|superadmin] [hiddenFromAdmin: true|false]');
  console.log('Example: node adduser.js "John Doe" jdoe sci12345 employee false');
  process.exit(1);
}

await connectDB();

try {
  const existing = await User.findOne({
    $or: [{ username }, { name: { $regex: new RegExp(`^${name}$`, 'i') } }],
  });

  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString().slice(0, 10);

  if (existing) {
    existing.name = name;
    existing.username = username;
    existing.passwordHash = passwordHash;
    existing.role = role;
    existing.hiddenFromAdmin = hiddenFromAdmin;
    existing.mustChangePassword = true;
    existing.active = true;
    await existing.save();
    console.log(`Updated user "${name}" (@${username}) in MongoDB.`);
  } else {
    await User.create({
      name,
      username,
      passwordHash,
      role,
      hiddenFromAdmin,
      mustChangePassword: true,
      active: true,
      createdAt: now,
    });
    console.log(`Created new ${role} "${name}" (@${username}) in MongoDB.`);
  }

  console.log(` - Role: ${role}`);
  console.log(` - Password: ${password === 'sci12345' ? 'sci12345 (default)' : 'custom'}`);
  console.log(` - Hidden from Admin: ${hiddenFromAdmin ? 'Yes' : 'No'}`);
  console.log(` - mustChangePassword: true`);
  console.log(` - active: true`);
  process.exit(0);
} catch (err) {
  console.error('Failed to save user in MongoDB:', err.message);
  process.exit(1);
}
