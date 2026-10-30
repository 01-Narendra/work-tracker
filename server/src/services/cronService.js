import cron from 'node-cron';
import { TZ, isWeeklyOff, addDays, currentWorkDate } from '../utils/time.js';
import User from '../models/User.js';
import Update from '../models/Update.js';

export async function closeFinishedDays() {
  try {
    const employees = await User.find({ role: 'employee', active: { $ne: false } }).lean();
    if (!employees.length) return 0;

    const today = currentWorkDate();
    const earliestInDb = await Update.findOne({}).sort({ date: 1 }).select('date').lean();
    const floor = addDays(today, -14);
    const earliestDate = earliestInDb?.date;

    const baseStart =
      earliestDate && earliestDate < today
        ? earliestDate < floor
          ? floor
          : earliestDate
        : addDays(today, -1);

    const dates = [];
    for (let d = baseStart; d < today; d = addDays(d, 1)) {
      if (!isWeeklyOff(d)) dates.push(d);
    }
    if (!dates.length) return 0;

    const operations = [];
    for (const date of dates) {
      for (const emp of employees) {
        if (!emp.createdAt || emp.createdAt <= date) {
          operations.push({
            updateOne: {
              filter: { date, userId: emp._id },
              update: {
                $setOnInsert: {
                  date,
                  userId: emp._id,
                  employeeName: emp.name,
                  checkIn: '',
                  checkOut: '',
                  hoursWorked: 0,
                  morningUpdate: '',
                  eveningUpdate: '',
                  status: 'Absent',
                  weeklyWork: '',
                  weeklyTargetStatus: '',
                  weeklyTargetReason: '',
                },
              },
              upsert: true,
            },
          });
        }
      }
    }

    if (operations.length > 0) {
      const result = await Update.bulkWrite(operations, { ordered: false });
      const added = result.upsertedCount || 0;
      if (added > 0) {
        console.log(`[Absent Cron Job] Marked ${added} absent record(s) across past unfinished days.`);
      }
      return added;
    }
    return 0;
  } catch (err) {
    console.error('[Absent Cron Job Error]:', err.message);
    return 0;
  }
}

export function initCronJobs() {
  cron.schedule('0 9 * * *', closeFinishedDays, { timezone: TZ });
  closeFinishedDays(); // catch up on startup
}
