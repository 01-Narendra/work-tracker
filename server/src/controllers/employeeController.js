import Update from '../models/Update.js';
import User from '../models/User.js';
import WeeklyPlan from '../models/WeeklyPlan.js';
import { MAX_UPDATE_LEN } from '../config/env.js';
import { streamExcelExport } from '../services/excelService.js';
import {
  getWindowInfo,
  validateCheckInTime,
  validateCheckOutTime,
  isWeeklyOff,
  calculateHoursWorkedNumber,
  formatHoursWorked,
  calculateStatus,
  parseTimeToMinutes,
} from '../utils/time.js';

async function getEmployeeUser(req) {
  if (req.user.userId) {
    const u = await User.findById(req.user.userId);
    if (u) return u;
  }
  return User.findOne({ username: req.user.username });
}

export const getMyToday = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const win = getWindowInfo();
  const date = win.workDate;

  const entry = await Update.findOne({ date, userId: user._id }).lean();
  const weeklyPlan = await WeeklyPlan.findOne({
    userId: user._id,
    startDate: win.weekRange.monday,
  }).lean();

  const hoursWorkedStr = entry?.hoursWorked ? formatHoursWorked(entry.hoursWorked) : '';

  res.json({
    date,
    closesOn: win.closesOn,
    dayOfWeek: win.dayOfWeek,
    dayName: win.dayName,
    isMonday: win.isMonday,
    isFriday: win.isFriday,
    weekRange: win.weekRange,
    weeklyPlan: weeklyPlan
      ? {
          startDate: weeklyPlan.startDate,
          endDate: weeklyPlan.endDate,
          weeklyWork: weeklyPlan.weeklyWork || '',
          targetStatus: weeklyPlan.targetStatus || '',
          targetStatusReason: weeklyPlan.targetStatusReason || '',
          updatedAt: weeklyPlan.updatedAtStr || '',
        }
      : {
          startDate: win.weekRange.monday,
          endDate: win.weekRange.friday,
          weeklyWork: entry?.weeklyWork || '',
          targetStatus: entry?.weeklyTargetStatus || '',
          targetStatusReason: entry?.weeklyTargetReason || '',
          updatedAt: '',
        },
    morningWindow: win.morningWindow,
    eveningWindow: win.eveningWindow,
    checkInSlots: win.checkInSlots,
    defaultCheckIn: win.defaultCheckIn,
    checkOutSlots: win.checkOutSlots,
    defaultCheckOut: win.defaultCheckOut,
    checkIn: entry?.checkIn || '',
    checkOut: entry?.checkOut || '',
    hoursWorked: hoursWorkedStr,
    morning: entry?.morningUpdate || '',
    morningUpdate: entry?.morningUpdate || '',
    evening: entry?.eveningUpdate || '',
    eveningUpdate: entry?.eveningUpdate || '',
    status: entry?.status || '',
    weeklyWork: entry?.weeklyWork || weeklyPlan?.weeklyWork || '',
    weeklyTargetStatus: entry?.weeklyTargetStatus || weeklyPlan?.targetStatus || '',
    weeklyTargetReason: entry?.weeklyTargetReason || weeklyPlan?.targetStatusReason || '',
    isWeeklyOff: isWeeklyOff(date),
  });
};

export const checkIn = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const time = String(req.body?.time || '').trim();
  if (!time) {
    return res.status(400).json({ error: 'Please select a check-in time.' });
  }

  validateCheckInTime(time);

  const win = getWindowInfo();
  const date = win.workDate;

  const existing = await Update.findOne({ date, userId: user._id });
  if (existing && existing.checkIn) {
    return res.status(400).json({ error: `You have already confirmed check-in for today at ${existing.checkIn}.` });
  }

  const hoursWorked = calculateHoursWorkedNumber(time, existing?.checkOut);
  const status = calculateStatus({
    checkIn: time,
    checkOut: existing?.checkOut,
    morningUpdate: existing?.morningUpdate,
    eveningUpdate: existing?.eveningUpdate,
  });

  const updated = await Update.findOneAndUpdate(
    { date, userId: user._id },
    {
      $set: {
        checkIn: time,
        hoursWorked,
        status,
        employeeName: user.name,
      },
      $setOnInsert: {
        date,
        userId: user._id,
        checkOut: '',
        morningUpdate: '',
        eveningUpdate: '',
        weeklyWork: '',
        weeklyTargetStatus: '',
        weeklyTargetReason: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    ...win,
    ...updated,
    name: updated.employeeName,
    morning: updated.morningUpdate,
    evening: updated.eveningUpdate,
    hoursWorked: updated.hoursWorked ? formatHoursWorked(updated.hoursWorked) : '',
    isWeeklyOff: isWeeklyOff(date),
  });
};

export const checkOut = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const time = String(req.body?.time || '').trim();
  if (!time) {
    return res.status(400).json({ error: 'Please select a check-out time.' });
  }

  validateCheckOutTime(time);

  const win = getWindowInfo();
  const date = win.workDate;

  const existing = await Update.findOne({ date, userId: user._id });
  if (existing && existing.checkOut) {
    return res.status(400).json({ error: `You have already confirmed check-out for today at ${existing.checkOut}.` });
  }

  // Validate check-out is not earlier than check-in
  if (existing?.checkIn) {
    const inMins = parseTimeToMinutes(existing.checkIn, false);
    const outMins = parseTimeToMinutes(time, true);
    if (inMins !== null && outMins !== null && outMins < inMins) {
      return res.status(400).json({ error: `Check-out time (${time}) cannot be earlier than check-in time (${existing.checkIn}).` });
    }
  }

  const hoursWorked = calculateHoursWorkedNumber(existing?.checkIn, time);
  const status = calculateStatus({
    checkIn: existing?.checkIn,
    checkOut: time,
    morningUpdate: existing?.morningUpdate,
    eveningUpdate: existing?.eveningUpdate,
  });

  const updated = await Update.findOneAndUpdate(
    { date, userId: user._id },
    {
      $set: {
        checkOut: time,
        hoursWorked,
        status,
        employeeName: user.name,
      },
      $setOnInsert: {
        date,
        userId: user._id,
        checkIn: '',
        morningUpdate: '',
        eveningUpdate: '',
        weeklyWork: '',
        weeklyTargetStatus: '',
        weeklyTargetReason: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    ...win,
    ...updated,
    name: updated.employeeName,
    morning: updated.morningUpdate,
    evening: updated.eveningUpdate,
    hoursWorked: updated.hoursWorked ? formatHoursWorked(updated.hoursWorked) : '',
    isWeeklyOff: isWeeklyOff(date),
  });
};

export const updateText = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const win = getWindowInfo();
  const date = win.workDate;

  let morning = req.body?.morning !== undefined ? String(req.body.morning).trim() : undefined;
  let evening = req.body?.evening !== undefined ? String(req.body.evening).trim() : undefined;

  if (req.body?.type === 'morning') {
    morning = String(req.body.text ?? '').trim();
  } else if (req.body?.type === 'evening') {
    evening = String(req.body.text ?? '').trim();
  }

  if (morning === undefined && evening === undefined) {
    return res.status(400).json({ error: 'No update content provided.' });
  }

  if (morning !== undefined) {
    if (!win.morningWindow.open) {
      return res.status(400).json({ error: 'Morning update can only be edited between 9:00 AM and 1:00 PM.' });
    }
    if (!morning) {
      return res.status(400).json({ error: 'Morning update cannot be empty.' });
    }
    if (morning.length > MAX_UPDATE_LEN) {
      return res.status(400).json({ error: `Morning update can be up to ${MAX_UPDATE_LEN} characters.` });
    }
  }

  if (evening !== undefined) {
    if (!win.eveningWindow.open) {
      return res.status(400).json({
        error: 'Evening update can only be edited during the evening window (1:00 PM to 11:55 PM).',
      });
    }
    if (!evening) {
      return res.status(400).json({ error: 'Evening update cannot be empty.' });
    }
    if (evening.length > MAX_UPDATE_LEN) {
      return res.status(400).json({ error: `Evening update can be up to ${MAX_UPDATE_LEN} characters.` });
    }
  }

  const existing = await Update.findOne({ date, userId: user._id });

  const finalMorning = morning !== undefined ? morning : (existing?.morningUpdate || '');
  const finalEvening = evening !== undefined ? evening : (existing?.eveningUpdate || '');
  const finalCheckIn = existing?.checkIn || '';
  const finalCheckOut = existing?.checkOut || '';

  const status = calculateStatus({
    checkIn: finalCheckIn,
    checkOut: finalCheckOut,
    morningUpdate: finalMorning,
    eveningUpdate: finalEvening,
  });

  const updateFields = {
    status,
    employeeName: user.name,
  };
  if (morning !== undefined) updateFields.morningUpdate = morning;
  if (evening !== undefined) updateFields.eveningUpdate = evening;

  const updated = await Update.findOneAndUpdate(
    { date, userId: user._id },
    {
      $set: updateFields,
      $setOnInsert: {
        date,
        userId: user._id,
        checkIn: '',
        checkOut: '',
        hoursWorked: 0,
        weeklyWork: '',
        weeklyTargetStatus: '',
        weeklyTargetReason: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({
    ...win,
    ...updated,
    name: updated.employeeName,
    morning: updated.morningUpdate,
    evening: updated.eveningUpdate,
    hoursWorked: updated.hoursWorked ? formatHoursWorked(updated.hoursWorked) : '',
    isWeeklyOff: isWeeklyOff(date),
  });
};

export const saveWeeklyPlan = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { startDate, endDate, weeklyWork } = req.body || {};
  const text = String(weeklyWork || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Please enter your weekly work plan.' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required.' });
  }

  const cleanStart = String(startDate).slice(0, 10);
  const cleanEnd = String(endDate).slice(0, 10);

  const plan = await WeeklyPlan.findOneAndUpdate(
    { userId: user._id, startDate: cleanStart },
    {
      $set: {
        userId: user._id,
        employeeName: user.name,
        startDate: cleanStart,
        endDate: cleanEnd,
        weeklyWork: text,
        updatedAtStr: new Date().toISOString(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Also reflect into Monday's update row if exists or on creation
  await Update.updateOne(
    { date: cleanStart, userId: user._id },
    { $set: { weeklyWork: text, employeeName: user.name } },
    { upsert: false }
  );

  res.json({
    ok: true,
    message: 'Weekly work plan saved successfully.',
    weeklyPlan: {
      startDate: plan.startDate,
      endDate: plan.endDate,
      weeklyWork: plan.weeklyWork,
      targetStatus: plan.targetStatus || '',
      updatedAt: plan.updatedAtStr,
    },
  });
};

export const submitWeeklyTargetStatus = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const win = getWindowInfo();
  if (!win.isFriday) {
    return res.status(400).json({
      error: 'Weekly target status confirmation is only allowed on Friday.',
    });
  }

  const { status, reason } = req.body || {};
  const cleanStatus = String(status || '').trim();
  const cleanReason = String(reason || '').trim();
  const statusMap = {
    completed: 'Completed',
    'in progress': 'In Progress',
    delayed: 'Delayed',
    'on hold': 'On Hold',
  };

  const canonicalStatus = statusMap[cleanStatus.toLowerCase()];
  if (!canonicalStatus) {
    return res.status(400).json({
      error: 'Invalid target status. Please choose Completed, In Progress, Delayed, or On Hold.',
    });
  }

  if (canonicalStatus !== 'Completed' && !cleanReason) {
    return res.status(400).json({
      error: 'Please enter a reason for not completing the weekly target.',
    });
  }

  const finalReason = canonicalStatus === 'Completed' ? '' : cleanReason;

  const plan = await WeeklyPlan.findOneAndUpdate(
    { userId: user._id, startDate: win.weekRange.monday },
    {
      $set: {
        userId: user._id,
        employeeName: user.name,
        startDate: win.weekRange.monday,
        endDate: win.weekRange.friday,
        targetStatus: canonicalStatus,
        targetStatusReason: finalReason,
        updatedAtStr: new Date().toISOString(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Also reflect into Friday's update row if exists
  await Update.updateOne(
    { date: win.weekRange.friday, userId: user._id },
    {
      $set: {
        weeklyTargetStatus: canonicalStatus,
        weeklyTargetReason: finalReason,
        employeeName: user.name,
      },
    },
    { upsert: false }
  );

  res.json({
    ok: true,
    message: `Weekly target status recorded as "${canonicalStatus}".`,
    weeklyPlan: {
      startDate: plan.startDate,
      endDate: plan.endDate,
      weeklyWork: plan.weeklyWork || '',
      targetStatus: plan.targetStatus,
      targetStatusReason: plan.targetStatusReason || '',
      updatedAt: plan.updatedAtStr,
    },
  });
};

export const getMyHistory = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { from, to } = req.query;
  const query = { userId: user._id };

  if (from && to) {
    query.date = { $gte: String(from).slice(0, 10), $lte: String(to).slice(0, 10) };
  } else if (from) {
    query.date = { $gte: String(from).slice(0, 10) };
  } else if (to) {
    query.date = { $lte: String(to).slice(0, 10) };
  }

  const rawRows = await Update.find(query).sort({ date: -1 }).lean();

  // Counts strictly for employee's history matching date filters
  const countMatch = { userId: user._id };
  if (query.date) countMatch.date = query.date;

  const countsAgg = await Update.aggregate([
    { $match: countMatch },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = { Present: 0, Partial: 0, Absent: 0 };
  countsAgg.forEach((c) => {
    if (counts[c._id] !== undefined) counts[c._id] = c.count;
  });

  const rows = rawRows.map((r) => ({
    ...r,
    name: r.employeeName,
    morning: r.morningUpdate,
    evening: r.eveningUpdate,
    hoursWorked: r.hoursWorked ? formatHoursWorked(r.hoursWorked) : '',
    weeklyTargetStatus: r.weeklyTargetStatus || '',
    weeklyTargetReason: r.weeklyTargetReason || '',
  }));

  res.json({ rows, counts });
};

export const downloadMyExcel = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { from, to } = req.query;
  const query = { userId: user._id };

  if (from && to) {
    query.date = { $gte: String(from).slice(0, 10), $lte: String(to).slice(0, 10) };
  } else if (from) {
    query.date = { $gte: String(from).slice(0, 10) };
  } else if (to) {
    query.date = { $lte: String(to).slice(0, 10) };
  }

  const cursor = Update.find(query).sort({ date: -1 }).cursor();
  const safeName = user.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  await streamExcelExport({
    res,
    filename: `work_updates_${safeName}.xlsx`,
    cursor,
  });
};
