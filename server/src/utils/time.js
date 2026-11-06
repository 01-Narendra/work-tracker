import { TZ, WEEKLY_OFF } from '../config/env.js';

let fmt;
try {
  fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
} catch {
  fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

export { TZ };

export function getTimeParts(d = new Date()) {
  const p = {};
  fmt.formatToParts(d).forEach((x) => (p[x.type] = x.value));
  const year = p.year;
  const month = p.month;
  const day = p.day;
  const hour = Number(p.hour);
  const minute = Number(p.minute);
  const dateStr = `${year}-${month}-${day}`;
  return { year, month, day, hour, minute, dateStr };
}

export function addDays(s, n) {
  if (!s || typeof s !== 'string') return '';
  const clean = s.slice(0, 10);
  const d = new Date(clean + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function getDayOfWeek(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
}

export function getDayName(dow) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dow] || '';
}

export function getWeekRange(dateStr) {
  const dow = getDayOfWeek(dateStr);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(dateStr, diffToMonday);
  const friday = addDays(monday, 4);
  return {
    monday,
    friday,
    dayOfWeek: dow,
    dayName: getDayName(dow),
    isMonday: dow === 1,
    isFriday: dow === 5,
  };
}

// Work day runs from 9:00 AM to 11:55 PM on date D.
// Before 9:00 AM, it refers to the previous work day.
export function currentWorkDate(now = new Date()) {
  const { hour, dateStr } = getTimeParts(now);
  return hour < 9 ? addDays(dateStr, -1) : dateStr;
}

export const isWeeklyOff = (date) => {
  if (!date) return false;
  const offDays = (WEEKLY_OFF ?? '0,6')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const clean = String(date).slice(0, 10);
  const d = new Date(clean + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  return offDays.includes(String(d.getUTCDay()));
};

// Formats hour and minute into 12-hour format e.g. "9:15 AM" or "1:00 PM"
export function formatTime12(h, m) {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mStr = String(m).padStart(2, '0');
  return `${h12}:${mStr} ${period}`;
}

// Parses 12-hour format into relative minutes from 00:00 of the same day
export function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return null;
  const clean = str.replace(/\(next day\)/i, '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let h = Number(match[1]);
  const m = Number(match[2]);
  const period = match[3].toUpperCase();

  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;

  return h * 60 + m;
}

// All slots for Morning window: 9:00 AM to 1:00 PM (540 to 780 mins)
export const ALL_CHECK_IN_SLOTS = [];
for (let mins = 540; mins <= 780; mins += 15) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  ALL_CHECK_IN_SLOTS.push(formatTime12(h, m));
}

// All slots for Evening window: 1:00 PM to 11:55 PM (780 to 1435 mins)
export const ALL_CHECK_OUT_SLOTS = [];
for (let mins = 780; mins <= 1425; mins += 15) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  ALL_CHECK_OUT_SLOTS.push(formatTime12(h, m));
}
// Include 11:50 PM and 11:55 PM closing slot
if (!ALL_CHECK_OUT_SLOTS.includes('11:50 PM')) ALL_CHECK_OUT_SLOTS.push('11:50 PM');
if (!ALL_CHECK_OUT_SLOTS.includes('11:55 PM')) ALL_CHECK_OUT_SLOTS.push('11:55 PM');

// Hours worked calculation returning Number (e.g. 8.5)
export function calculateHoursWorkedNumber(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const inMins = parseTimeToMinutes(checkIn);
  const outMins = parseTimeToMinutes(checkOut);
  if (inMins === null || outMins === null || outMins < inMins) return 0;
  const diffMins = outMins - inMins;
  return Math.round((diffMins / 60) * 100) / 100;
}

// Formats hours worked into human readable text e.g. "8 hrs" or "8h 30m"
export function formatHoursWorked(hours) {
  if (hours == null || hours === 0 || isNaN(hours)) return '';
  const totalMins = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m === 0) return `${h} hrs`;
  return `${h}h ${m}m`;
}

export function calculateHoursWorked(checkIn, checkOut) {
  const num = calculateHoursWorkedNumber(checkIn, checkOut);
  return formatHoursWorked(num);
}

// Status rules:
// - Present: checked in, checked out, and both updates written.
// - Partial: anything in between.
// - Absent: nothing by end of day.
export function calculateStatus({ checkIn, checkOut, morningUpdate, eveningUpdate }) {
  const hasIn = Boolean(checkIn && String(checkIn).trim());
  const hasOut = Boolean(checkOut && String(checkOut).trim());
  const hasM = Boolean(morningUpdate && String(morningUpdate).trim());
  const hasE = Boolean(eveningUpdate && String(eveningUpdate).trim());

  if (hasIn && hasOut && hasM && hasE) return 'Present';
  if (hasIn || hasOut || hasM || hasE) return 'Partial';
  return 'Absent';
}

export const statusOf = calculateStatus;

export function getCurrentServerMinutes(now = new Date()) {
  const parts = getTimeParts(now);
  return parts.hour * 60 + parts.minute;
}

export function getWindowInfo(now = new Date()) {
  const parts = getTimeParts(now);
  const workDate = currentWorkDate(now);
  const currentTotalMins = getCurrentServerMinutes(now);

  // Morning window: 9:00 AM (540 mins) to 1:00 PM (780 mins)
  const morningOpen = currentTotalMins >= 540 && currentTotalMins < 780;
  // Evening window: 1:00 PM (780 mins) to 11:55 PM (1435 mins)
  const eveningOpen = currentTotalMins >= 780 && currentTotalMins <= 1435;

  // Preselect nearest check-in slot to current time
  let defaultCheckIn = ALL_CHECK_IN_SLOTS[0];
  let minDiffIn = Infinity;
  for (const s of ALL_CHECK_IN_SLOTS) {
    const sMins = parseTimeToMinutes(s);
    const diff = Math.abs(sMins - currentTotalMins);
    if (diff < minDiffIn) {
      minDiffIn = diff;
      defaultCheckIn = s;
    }
  }

  // Preselect nearest check-out slot to current time
  let defaultCheckOut = ALL_CHECK_OUT_SLOTS[0];
  let minDiffOut = Infinity;
  for (const s of ALL_CHECK_OUT_SLOTS) {
    const sMins = parseTimeToMinutes(s);
    const diff = Math.abs(sMins - currentTotalMins);
    if (diff < minDiffOut) {
      minDiffOut = diff;
      defaultCheckOut = s;
    }
  }

  const weekRange = getWeekRange(workDate);

  return {
    workDate,
    closesOn: workDate,
    closeTime: '11:55 PM',
    dayOfWeek: weekRange.dayOfWeek,
    dayName: weekRange.dayName,
    isMonday: weekRange.isMonday,
    isFriday: weekRange.isFriday,
    weekRange: {
      monday: weekRange.monday,
      friday: weekRange.friday,
    },
    morningWindow: {
      open: morningOpen,
      start: '9:00 AM',
      end: '1:00 PM',
      message: morningOpen
        ? 'Morning window is open until 1:00 PM.'
        : 'Morning updates and check-in open 9:00 AM to 1:00 PM.',
    },
    eveningWindow: {
      open: eveningOpen,
      start: '1:00 PM',
      end: '11:55 PM',
      message: eveningOpen
        ? 'Evening window is open until 11:55 PM.'
        : 'Evening updates and check-out open 1:00 PM to 11:55 PM.',
    },
    // Deliver all times for morning window (9:00 AM to 1:00 PM)
    checkInSlots: ALL_CHECK_IN_SLOTS,
    defaultCheckIn,
    // Deliver all times for evening window (1:00 PM to 11:55 PM)
    checkOutSlots: ALL_CHECK_OUT_SLOTS,
    defaultCheckOut,
  };
}

export function isDateInCurrentWeek(dateStr, now = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const clean = dateStr.slice(0, 10);
  const workDate = currentWorkDate(now);
  const weekRange = getWeekRange(workDate);
  const monday = weekRange.monday;
  const sunday = addDays(monday, 6);
  // Current week only: Monday through Sunday of current week, but not future dates beyond workDate
  return clean >= monday && clean <= sunday && clean <= workDate;
}

export function getCurrentWeekDays(now = new Date()) {
  const workDate = currentWorkDate(now);
  const weekRange = getWeekRange(workDate);
  const days = [];
  // Monday through Friday of the work week
  for (let i = 0; i < 5; i++) {
    const d = addDays(weekRange.monday, i);
    const dow = getDayOfWeek(d);
    days.push({
      date: d,
      dayOfWeek: dow,
      dayName: getDayName(dow),
      isToday: d === workDate,
      isPast: d < workDate,
      isFuture: d > workDate,
    });
  }
  // If workDate is Saturday or Sunday, also include those:
  const workDow = getDayOfWeek(workDate);
  if (workDow === 6 || workDow === 0) {
    if (!days.find((d) => d.date === workDate)) {
      days.push({
        date: workDate,
        dayOfWeek: workDow,
        dayName: getDayName(workDow),
        isToday: true,
        isPast: false,
        isFuture: false,
      });
    }
  }
  return {
    monday: weekRange.monday,
    friday: weekRange.friday,
    workDate,
    days,
  };
}

export function validateCheckInTime(timeString, now = new Date(), options = {}) {
  const { bypassWindow = false } = options;
  const win = getWindowInfo(now);
  if (!bypassWindow) {
    if (!win.morningWindow.open) {
      throw new Error('Morning window closed. Check-in is only allowed between 9:00 AM and 1:00 PM.');
    }
    if (!ALL_CHECK_IN_SLOTS.includes(timeString)) {
      throw new Error('Invalid check-in time. Please select a valid option from the morning window (9:00 AM to 1:00 PM).');
    }
  } else {
    // In grace mode: allow any valid work time slot
    if (!ALL_CHECK_IN_SLOTS.includes(timeString) && !ALL_CHECK_OUT_SLOTS.includes(timeString)) {
      throw new Error('Invalid check-in time. Please select a valid time slot.');
    }
  }
}

export function validateCheckOutTime(timeString, now = new Date(), options = {}) {
  const { bypassWindow = false } = options;
  const win = getWindowInfo(now);
  if (!bypassWindow) {
    if (!win.eveningWindow.open) {
      throw new Error('Evening window closed. Check-out is only allowed between 1:00 PM and 11:55 PM.');
    }
    if (!ALL_CHECK_OUT_SLOTS.includes(timeString)) {
      throw new Error('Invalid check-out time. Please select a valid option from the evening window (1:00 PM to 11:55 PM).');
    }
  } else {
    // In grace mode: allow any valid work time slot
    if (!ALL_CHECK_OUT_SLOTS.includes(timeString) && !ALL_CHECK_IN_SLOTS.includes(timeString)) {
      throw new Error('Invalid check-out time. Please select a valid time slot.');
    }
  }
}
