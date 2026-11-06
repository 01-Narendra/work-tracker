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
  isDateInCurrentWeek,
  getCurrentWeekDays,
  getDayOfWeek,
  getDayName,
} from '../utils/time.js';
import { isCurrentWeekUpdatesAllowed } from '../services/settingService.js';

async function getEmployeeUser(req) {
  if (req.user.userId) {
    const u = await User.findById(req.user.userId);
    if (u) return u;
  }
  return User.findOne({ username: req.user.username });
}

async function formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates }) {
  const isTargetToday = targetDate === win.workDate;
  const isPastDayOfCurrentWeek = targetDate < win.workDate && isDateInCurrentWeek(targetDate);
  const weekInfo = getCurrentWeekDays();

  const entry = await Update.findOne({ date: targetDate, userId: user._id }).lean();
  const weeklyPlan = await WeeklyPlan.findOne({
    userId: user._id,
    startDate: win.weekRange.monday,
  }).lean();

  const weekRecords = await Update.find({
    userId: user._id,
    date: { $gte: weekInfo.monday, $lte: win.workDate },
  })
    .select('date checkIn checkOut status morningUpdate eveningUpdate hoursWorked')
    .lean();

  const recordMap = new Map(weekRecords.map((r) => [r.date, r]));

  const currentWeekDays = weekInfo.days.map((d) => {
    const rec = recordMap.get(d.date);
    return {
      ...d,
      status: rec?.status || (d.isFuture ? 'Upcoming' : 'Not Filled'),
      checkIn: rec?.checkIn || '',
      checkOut: rec?.checkOut || '',
      hasMorning: Boolean(rec?.morningUpdate),
      hasEvening: Boolean(rec?.eveningUpdate),
      hoursWorked: rec?.hoursWorked ? formatHoursWorked(rec.hoursWorked) : '',
    };
  });

  const hoursWorkedStr = entry?.hoursWorked ? formatHoursWorked(entry.hoursWorked) : '';

  let morningWindow = { ...win.morningWindow };
  let eveningWindow = { ...win.eveningWindow };

  if (allowCurrentWeekUpdates) {
    morningWindow.open = true;
    morningWindow.message = isTargetToday
      ? 'Current week updates enabled by Super Admin: Check-in and morning updates are open anytime.'
      : `Past day update (${targetDate}): Morning check-in and updates enabled by Super Admin.`;
    eveningWindow.open = true;
    eveningWindow.message = isTargetToday
      ? 'Current week updates enabled by Super Admin: Check-out and evening updates are open anytime.'
      : `Past day update (${targetDate}): Evening check-out and updates enabled by Super Admin.`;
  }

  const targetDow = getDayOfWeek(targetDate);
  const targetDayName = getDayName(targetDow);

  return {
    date: targetDate,
    workDate: win.workDate,
    isTargetToday,
    isPastDayOfCurrentWeek,
    allowCurrentWeekUpdates,
    closesOn: win.closesOn,
    dayOfWeek: targetDow,
    dayName: targetDayName,
    isMonday: targetDow === 1,
    isFriday: targetDow === 5,
    weekRange: win.weekRange,
    currentWeekDays,
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
    morningWindow,
    eveningWindow,
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
    weeklyWork: weeklyPlan?.weeklyWork || entry?.weeklyWork || '',
    weeklyTargetStatus: weeklyPlan?.targetStatus || entry?.weeklyTargetStatus || '',
    weeklyTargetReason: weeklyPlan?.targetStatusReason || entry?.weeklyTargetReason || '',
    isWeeklyOff: isWeeklyOff(targetDate),
  };
}

export const getMyToday = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const win = getWindowInfo();
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();

  let targetDate = win.workDate;
  if (req.query?.date) {
    const requested = String(req.query.date).slice(0, 10);
    if (allowCurrentWeekUpdates) {
      if (isDateInCurrentWeek(requested)) {
        targetDate = requested;
      }
    } else {
      if (requested === win.workDate) {
        targetDate = requested;
      }
    }
  }

  const payload = await formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates });
  res.json(payload);
};

export const checkIn = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const time = String(req.body?.time || '').trim();
  if (!time) {
    return res.status(400).json({ error: 'Please select a check-in time.' });
  }

  const win = getWindowInfo();
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();
  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : win.workDate;

  if (!allowCurrentWeekUpdates) {
    if (targetDate !== win.workDate) {
      return res.status(400).json({
        error: 'Check-in is only allowed for today\'s work date outside the grace period.',
      });
    }
    validateCheckInTime(time);
    const existing = await Update.findOne({ date: targetDate, userId: user._id });
    if (existing && existing.checkIn) {
      return res.status(400).json({
        error: `You have already confirmed check-in for today at ${existing.checkIn}.`,
      });
    }
  } else {
    // Current week grace mode is active
    if (!isDateInCurrentWeek(targetDate)) {
      return res.status(400).json({
        error: 'Check-in can only be added or modified for the current week.',
      });
    }
    validateCheckInTime(time, new Date(), { bypassWindow: true });
  }

  const existing = await Update.findOne({ date: targetDate, userId: user._id });

  // If check-out already exists on that date, ensure check-in is not later than check-out
  if (existing?.checkOut) {
    const inMins = parseTimeToMinutes(time, false);
    const outMins = parseTimeToMinutes(existing.checkOut, true);
    if (inMins !== null && outMins !== null && outMins < inMins) {
      return res.status(400).json({
        error: `Check-in time (${time}) cannot be later than existing check-out time (${existing.checkOut}).`,
      });
    }
  }

  const hoursWorked = calculateHoursWorkedNumber(time, existing?.checkOut);
  const status = calculateStatus({
    checkIn: time,
    checkOut: existing?.checkOut,
    morningUpdate: existing?.morningUpdate,
    eveningUpdate: existing?.eveningUpdate,
  });

  const updated = await Update.findOneAndUpdate(
    { date: targetDate, userId: user._id },
    {
      $set: {
        checkIn: time,
        hoursWorked,
        status,
        employeeName: user.name,
      },
      $setOnInsert: {
        date: targetDate,
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

  const payload = await formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates });
  res.json(payload);
};

export const checkOut = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const time = String(req.body?.time || '').trim();
  if (!time) {
    return res.status(400).json({ error: 'Please select a check-out time.' });
  }

  const win = getWindowInfo();
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();
  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : win.workDate;

  if (!allowCurrentWeekUpdates) {
    if (targetDate !== win.workDate) {
      return res.status(400).json({
        error: 'Check-out is only allowed for today\'s work date outside the grace period.',
      });
    }
    validateCheckOutTime(time);
    const existing = await Update.findOne({ date: targetDate, userId: user._id });
    if (existing && existing.checkOut) {
      return res.status(400).json({
        error: `You have already confirmed check-out for today at ${existing.checkOut}.`,
      });
    }
  } else {
    // Current week grace mode is active
    if (!isDateInCurrentWeek(targetDate)) {
      return res.status(400).json({
        error: 'Check-out can only be added or modified for the current week.',
      });
    }
    validateCheckOutTime(time, new Date(), { bypassWindow: true });
  }

  const existing = await Update.findOne({ date: targetDate, userId: user._id });

  // Validate check-out is not earlier than check-in
  if (existing?.checkIn) {
    const inMins = parseTimeToMinutes(existing.checkIn, false);
    const outMins = parseTimeToMinutes(time, true);
    if (inMins !== null && outMins !== null && outMins < inMins) {
      return res.status(400).json({
        error: `Check-out time (${time}) cannot be earlier than check-in time (${existing.checkIn}).`,
      });
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
    { date: targetDate, userId: user._id },
    {
      $set: {
        checkOut: time,
        hoursWorked,
        status,
        employeeName: user.name,
      },
      $setOnInsert: {
        date: targetDate,
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

  const payload = await formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates });
  res.json(payload);
};

export const updateText = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const win = getWindowInfo();
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();
  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : win.workDate;

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

  if (!allowCurrentWeekUpdates) {
    if (targetDate !== win.workDate) {
      return res.status(400).json({
        error: 'Work updates can only be submitted for today outside the grace period.',
      });
    }
    if (morning !== undefined) {
      if (!win.morningWindow.open) {
        return res.status(400).json({
          error: 'Morning update can only be edited between 9:00 AM and 1:00 PM.',
        });
      }
    }
    if (evening !== undefined) {
      if (!win.eveningWindow.open) {
        return res.status(400).json({
          error: 'Evening update can only be edited during the evening window (1:00 PM to 11:55 PM).',
        });
      }
    }
  } else {
    // Current week grace mode is active
    if (!isDateInCurrentWeek(targetDate)) {
      return res.status(400).json({
        error: 'Work updates can only be added or modified for the current week.',
      });
    }
  }

  if (morning !== undefined) {
    if (!morning) {
      return res.status(400).json({ error: 'Morning update cannot be empty.' });
    }
    if (morning.length > MAX_UPDATE_LEN) {
      return res.status(400).json({ error: `Morning update can be up to ${MAX_UPDATE_LEN} characters.` });
    }
  }

  if (evening !== undefined) {
    if (!evening) {
      return res.status(400).json({ error: 'Evening update cannot be empty.' });
    }
    if (evening.length > MAX_UPDATE_LEN) {
      return res.status(400).json({ error: `Evening update can be up to ${MAX_UPDATE_LEN} characters.` });
    }
  }

  const existing = await Update.findOne({ date: targetDate, userId: user._id });

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
    { date: targetDate, userId: user._id },
    {
      $set: updateFields,
      $setOnInsert: {
        date: targetDate,
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

  const payload = await formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates });
  res.json(payload);
};

export const updateDay = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const win = getWindowInfo();
  const allowCurrentWeekUpdates = await isCurrentWeekUpdatesAllowed();
  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : win.workDate;

  if (!allowCurrentWeekUpdates) {
    if (targetDate !== win.workDate) {
      return res.status(400).json({
        error: 'Updates are only allowed for today\'s work date outside the grace period.',
      });
    }
  } else {
    if (!isDateInCurrentWeek(targetDate)) {
      return res.status(400).json({
        error: 'Updates can only be modified for the current week.',
      });
    }
  }

  const existing = await Update.findOne({ date: targetDate, userId: user._id });

  let checkInVal = req.body?.checkIn !== undefined ? String(req.body.checkIn).trim() : (existing?.checkIn || '');
  let checkOutVal = req.body?.checkOut !== undefined ? String(req.body.checkOut).trim() : (existing?.checkOut || '');
  let morningVal = req.body?.morningUpdate !== undefined
    ? String(req.body.morningUpdate).trim()
    : req.body?.morning !== undefined
    ? String(req.body.morning).trim()
    : (existing?.morningUpdate || '');
  let eveningVal = req.body?.eveningUpdate !== undefined
    ? String(req.body.eveningUpdate).trim()
    : req.body?.evening !== undefined
    ? String(req.body.evening).trim()
    : (existing?.eveningUpdate || '');

  // Validate checkIn if provided
  if (req.body?.checkIn !== undefined && checkInVal) {
    validateCheckInTime(checkInVal, new Date(), { bypassWindow: allowCurrentWeekUpdates });
  }

  // Validate checkOut if provided
  if (req.body?.checkOut !== undefined && checkOutVal) {
    validateCheckOutTime(checkOutVal, new Date(), { bypassWindow: allowCurrentWeekUpdates });
  }

  // Check ordering if both checkIn and checkOut are present
  if (checkInVal && checkOutVal) {
    const inMins = parseTimeToMinutes(checkInVal, false);
    const outMins = parseTimeToMinutes(checkOutVal, true);
    if (inMins !== null && outMins !== null && outMins < inMins) {
      return res.status(400).json({
        error: `Check-out time (${checkOutVal}) cannot be earlier than check-in time (${checkInVal}).`,
      });
    }
  }

  if (morningVal && morningVal.length > MAX_UPDATE_LEN) {
    return res.status(400).json({ error: `Morning update can be up to ${MAX_UPDATE_LEN} characters.` });
  }
  if (eveningVal && eveningVal.length > MAX_UPDATE_LEN) {
    return res.status(400).json({ error: `Evening update can be up to ${MAX_UPDATE_LEN} characters.` });
  }

  // If outside grace window, enforce strict window rules for editing today
  if (!allowCurrentWeekUpdates) {
    if (req.body?.checkIn !== undefined && req.body.checkIn !== (existing?.checkIn || '')) {
      if (!win.morningWindow.open) {
        return res.status(400).json({ error: 'Check-in is only allowed between 9:00 AM and 1:00 PM.' });
      }
      if (existing?.checkIn) {
        return res.status(400).json({ error: `You have already confirmed check-in for today at ${existing.checkIn}.` });
      }
    }
    if (req.body?.checkOut !== undefined && req.body.checkOut !== (existing?.checkOut || '')) {
      if (!win.eveningWindow.open) {
        return res.status(400).json({ error: 'Check-out is only allowed between 1:00 PM and 11:55 PM.' });
      }
      if (existing?.checkOut) {
        return res.status(400).json({ error: `You have already confirmed check-out for today at ${existing.checkOut}.` });
      }
    }
    if (req.body?.morningUpdate !== undefined && req.body.morningUpdate !== (existing?.morningUpdate || '') && !win.morningWindow.open) {
      return res.status(400).json({ error: 'Morning update can only be edited between 9:00 AM and 1:00 PM.' });
    }
    if (req.body?.eveningUpdate !== undefined && req.body.eveningUpdate !== (existing?.eveningUpdate || '') && !win.eveningWindow.open) {
      return res.status(400).json({ error: 'Evening update can only be edited during the evening window (1:00 PM to 11:55 PM).' });
    }
  }

  const hoursWorked = calculateHoursWorkedNumber(checkInVal, checkOutVal);
  const status = calculateStatus({
    checkIn: checkInVal,
    checkOut: checkOutVal,
    morningUpdate: morningVal,
    eveningUpdate: eveningVal,
  });

  const updated = await Update.findOneAndUpdate(
    { date: targetDate, userId: user._id },
    {
      $set: {
        checkIn: checkInVal,
        checkOut: checkOutVal,
        morningUpdate: morningVal,
        eveningUpdate: eveningVal,
        hoursWorked,
        status,
        employeeName: user.name,
      },
      $setOnInsert: {
        date: targetDate,
        userId: user._id,
        weeklyWork: '',
        weeklyTargetStatus: '',
        weeklyTargetReason: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const payload = await formatDayResponse({ user, targetDate, win, allowCurrentWeekUpdates });
  res.json({
    ...payload,
    message: `Work updates for ${targetDate} saved successfully.`,
  });
};

export const saveWeeklyPlan = async (req, res) => {
  const user = await getEmployeeUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const win = getWindowInfo();
  const { startDate, endDate, weeklyWork } = req.body || {};
  const text = String(weeklyWork || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Please enter your weekly work plan.' });
  }

  const cleanStart = String(startDate || win.weekRange.monday).slice(0, 10);
  const cleanEnd = String(endDate || win.weekRange.friday).slice(0, 10);

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

  // Reflect into Monday's update row if exists
  await Update.updateOne(
    { date: cleanStart, userId: user._id },
    { $set: { weeklyWork: text, employeeName: user.name } },
    { upsert: false }
  );

  // Reflect into current work date's update row if exists and falls within the week
  if (win.workDate && win.workDate >= cleanStart && win.workDate <= cleanEnd && win.workDate !== cleanStart) {
    await Update.updateOne(
      { date: win.workDate, userId: user._id },
      { $set: { weeklyWork: text, employeeName: user.name } },
      { upsert: false }
    );
  }

  // Also reflect into any existing update rows for this user in this week that already had weeklyWork
  await Update.updateMany(
    {
      userId: user._id,
      date: { $gte: cleanStart, $lte: cleanEnd },
      weeklyWork: { $exists: true, $ne: '' },
    },
    { $set: { weeklyWork: text } }
  );

  res.json({
    ok: true,
    message: 'Weekly work plan saved successfully.',
    weeklyPlan: {
      startDate: plan.startDate,
      endDate: plan.endDate,
      weeklyWork: plan.weeklyWork,
      targetStatus: plan.targetStatus || '',
      targetStatusReason: plan.targetStatusReason || '',
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
