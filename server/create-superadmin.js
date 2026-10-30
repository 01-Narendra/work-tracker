import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import User from './src/models/User.js';

// Read optional CLI arguments or use defaults
// Usage: node create-superadmin.js [username] [password] ["Full Name"]
const args = process.argv.slice(2);
const username = (args[0] || 'superadmin').trim().toLowerCase();
const password = args[1] || 'sci12345';
const name = args[2] || 'Super Admin';

async function createSuperAdmin() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const today = new Date().toISOString().slice(0, 10);

    const user = await User.findOneAndUpdate(
      { username },
      {
        $set: {
          name,
          username,
          passwordHash,
          role: 'superadmin',
          hiddenFromAdmin: false,
          mustChangePassword: password === 'sci12345',
          active: true,
        },
        $setOnInsert: {
          createdAt: today,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('\n=================================================');
    console.log('       SUPER ADMIN CREATED / UPDATED             ');
    console.log('=================================================');
    console.log(` Name        : ${user.name}`);
    console.log(` Username    : ${user.username}`);
    console.log(` Password    : ${password}`);
    console.log(` Role        : ${user.role}`);
    console.log(` Active      : ${user.active}`);
    console.log(` Must Change : ${user.mustChangePassword}`);
    console.log('=================================================');
    console.log('You can now log in using these credentials.\n');
  } catch (err) {
    console.error('Error creating super admin:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createSuperAdmin();

