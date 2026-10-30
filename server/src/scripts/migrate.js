import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Update from '../models/Update.js';
import WeeklyPlan from '../models/WeeklyPlan.js';
import { DATA_DIR, ROOT_DIR, SERVER_DIR } from '../config/paths.js';

function formatCellDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'object') {
    if (val.text !== undefined) return String(val.text).trim();
    if (val.result !== undefined) return formatCellDate(val.result);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
}

function formatCellText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.text !== undefined) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((t) => t.text || '').join('').trim();
    }
  }
  return String(val).trim();
}

export async function runMigration() {
  console.log('--- Starting One-Time Migration to MongoDB Atlas ---');
  await connectDB();

  let importedUsers = 0;
  let skippedUsers = 0;
  let importedRows = 0;
  let skippedRows = 0;

  // 1. Migrate Users from data/users.json
  const candidateUsersFiles = [
    path.join(DATA_DIR, 'users.json'),
    path.join(SERVER_DIR, 'data', 'users.json'),
    path.join(ROOT_DIR, 'data', 'users.json'),
  ];
  const usersFile = candidateUsersFiles.find((f) => fs.existsSync(f));

  if (usersFile) {
    console.log(`Reading users from: ${usersFile}`);
    try {
      const rawUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      for (const u of rawUsers) {
        if (!u.username || !u.name) continue;
        const cleanUsername = String(u.username).trim().toLowerCase();
        const cleanName = String(u.name).trim();

        const existing = await User.findOne({
          $or: [{ username: cleanUsername }, { name: cleanName }],
        });

        if (existing) {
          skippedUsers++;
        } else {
          await User.create({
            name: cleanName,
            username: cleanUsername,
            passwordHash: u.passwordHash || bcrypt.hashSync('sci12345', 10),
            role: u.role || 'employee',
            hiddenFromAdmin: Boolean(u.hiddenFromAdmin),
            mustChangePassword: u.mustChangePassword !== false,
            active: u.active !== false,
            createdAt: u.createdAt || new Date().toISOString().slice(0, 10),
          });
          importedUsers++;
        }
      }
    } catch (err) {
      console.warn('Error reading users.json:', err.message);
    }
  } else {
    console.log('No users.json file found to migrate.');
  }

  // Build lookup map for users by lowercased name and username
  const allUsers = await User.find({}).lean();
  const userMap = new Map();
  for (const u of allUsers) {
    userMap.set(u.name.toLowerCase().trim(), u);
    userMap.set(u.username.toLowerCase().trim(), u);
  }

  // 2. Migrate Work Updates from data/work_updates.xlsx
  const candidateExcelFiles = [
    path.join(DATA_DIR, 'work_updates.xlsx'),
    path.join(SERVER_DIR, 'data', 'work_updates.xlsx'),
    path.join(ROOT_DIR, 'data', 'work_updates.xlsx'),
  ];
  const excelFile = candidateExcelFiles.find((f) => fs.existsSync(f));

  if (excelFile) {
    console.log(`Reading work updates from: ${excelFile}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(excelFile);

    const ws = wb.getWorksheet('Updates');
    if (ws) {
      for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
        const row = ws.getRow(rowNumber);
        const date = formatCellDate(row.getCell(1).value);
        const employeeName = formatCellText(row.getCell(2).value);

        if (!date || !employeeName) continue;

        let user = userMap.get(employeeName.toLowerCase().trim());
        if (!user) {
          // Auto-provision user if missing from users.json
          const cleanUsername = employeeName.toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Date.now()}`;
          const isHidden = ['skg', 'maanvi', 'anusha'].includes(employeeName.toLowerCase().trim());
          user = await User.create({
            name: employeeName.trim(),
            username: cleanUsername,
            passwordHash: bcrypt.hashSync('sci12345', 10),
            role: 'employee',
            hiddenFromAdmin: isHidden,
            mustChangePassword: true,
            active: true,
            createdAt: date,
          });
          userMap.set(employeeName.toLowerCase().trim(), user);
          userMap.set(cleanUsername, user);
          importedUsers++;
        }

        const checkIn = formatCellText(row.getCell(3).value);
        const checkOut = formatCellText(row.getCell(4).value);
        const rawHours = row.getCell(5).value;
        const hoursWorked = typeof rawHours === 'number' ? rawHours : Number(String(rawHours || '').replace(/[^0-9.]/g, '')) || 0;
        const morningUpdate = formatCellText(row.getCell(6).value);
        const eveningUpdate = formatCellText(row.getCell(7).value);
        const status = formatCellText(row.getCell(8).value) || 'Absent';
        const weeklyWork = formatCellText(row.getCell(9).value);
        const weeklyTargetStatus = formatCellText(row.getCell(10).value);

        // Check for duplicate row on compound key { date, userId }
        const existing = await Update.findOne({ date, userId: user._id });
        if (existing) {
          skippedRows++;
        } else {
          await Update.create({
            date,
            userId: user._id,
            employeeName: user.name,
            checkIn: checkIn || '',
            checkOut: checkOut || '',
            hoursWorked,
            morningUpdate: morningUpdate || '',
            eveningUpdate: eveningUpdate || '',
            status: ['Present', 'Partial', 'Absent'].includes(status) ? status : 'Absent',
            weeklyWork: weeklyWork || '',
            weeklyTargetStatus: weeklyTargetStatus || '',
          });
          importedRows++;
        }
      }
    }

    // Migrate Weekly Plans sheet if present
    const weeklyWs = wb.getWorksheet('Weekly Plans');
    if (weeklyWs) {
      for (let r = 2; r <= weeklyWs.rowCount; r++) {
        const row = weeklyWs.getRow(r);
        const empName = formatCellText(row.getCell(1).value);
        const startDate = formatCellDate(row.getCell(2).value);
        const endDate = formatCellDate(row.getCell(3).value);
        const weeklyWork = formatCellText(row.getCell(4).value);
        const targetStatus = formatCellText(row.getCell(5).value);

        if (!empName || !startDate) continue;
        const user = userMap.get(empName.toLowerCase().trim());
        if (user) {
          await WeeklyPlan.updateOne(
            { userId: user._id, startDate },
            {
              $setOnInsert: {
                userId: user._id,
                employeeName: user.name,
                startDate,
                endDate,
                weeklyWork: weeklyWork || '',
                targetStatus: targetStatus || '',
                updatedAtStr: new Date().toISOString(),
              },
            },
            { upsert: true }
          );
        }
      }
    }
  } else {
    console.log('No work_updates.xlsx file found to migrate.');
  }

  console.log('\n=================================================');
  console.log('           MIGRATION RESULTS SUMMARY             ');
  console.log('=================================================');
  console.log(` Users imported  : ${importedUsers}`);
  console.log(` Users skipped   : ${skippedUsers} (already in MongoDB)`);
  console.log(` Rows imported   : ${importedRows}`);
  console.log(` Rows skipped    : ${skippedRows} (duplicate date + employee)`);
  console.log('=================================================');
  console.log('Re-running this script is safe: duplicates are skipped automatically.\n');

  await mongoose.disconnect();
}

// Run immediately if called directly
runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

