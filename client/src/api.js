const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

const defaultHeaders = () => {
  const t = localStorage.getItem('token');
  const h = {};
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
};

async function send(path, opts = {}) {
  const headers = { ...defaultHeaders(), ...(opts.headers || {}) };
  let body = opts.body;
  if (body !== undefined && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, { ...opts, headers, body });
  if (res.status === 401 && path !== '/login') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
  }
  return res;
}

export async function api(path, opts) {
  const res = await send(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function downloadExcel(filters = {}, filename = 'work_updates.xlsx') {
  let url = '/admin/download';
  let targetFilename = filename;
  if (typeof filters === 'string') {
    targetFilename = filters;
  } else if (filters && typeof filters === 'object') {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const qs = params.toString();
    if (qs) url += '?' + qs;
  }

  const res = await send(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not download the file');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = targetFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export async function downloadMyExcel(filters = {}, filename = 'my_work_updates.xlsx') {
  let url = '/my-download';
  let targetFilename = filename;
  if (typeof filters === 'string') {
    targetFilename = filters;
  } else if (filters && typeof filters === 'object') {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const qs = params.toString();
    if (qs) url += '?' + qs;
  }

  const res = await send(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not download your work updates file');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = targetFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function parseCalendarDate(d) {
  if (!d) return null;
  const str = String(d).trim();
  const parts = str.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, day] = parts.map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
      return new Date(y, m - 1, day);
    }
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export const longDate = (d) => {
  const dt = parseCalendarDate(d);
  if (!dt) return String(d || '');
  return dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const shortDate = (d) => {
  const dt = parseCalendarDate(d);
  if (!dt) return String(d || '');
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function getCurrentWeekRange() {
  const now = new Date();
  let year, month, day, hour = 12;
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const p = {};
    fmt.formatToParts(now).forEach((x) => (p[x.type] = x.value));
    year = Number(p.year);
    month = Number(p.month);
    day = Number(p.day);
    hour = Number(p.hour || 12);
  } catch {
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
    hour = now.getHours();
  }

  // Work day before 9:00 AM refers to previous work day
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (hour < 9) {
    dt.setUTCDate(dt.getUTCDate() - 1);
  }

  const dow = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;

  const mon = new Date(dt);
  mon.setUTCDate(dt.getUTCDate() + diffToMonday);

  const fri = new Date(mon);
  fri.setUTCDate(mon.getUTCDate() + 4);

  const format = (d) => d.toISOString().slice(0, 10);

  return {
    from: format(mon),
    to: format(fri),
  };
}
