import { useCallback, useEffect, useState } from 'react';
import { api, downloadExcel, getCurrentWeekRange, shortDate } from './api.js';
import { useToast } from './Toast.jsx';

const chip = {
  Present: 'bg-green-100 text-green-800',
  Partial: 'bg-amber-100 text-amber-800',
  Absent: 'bg-red-100 text-red-800',
};

const targetStatusChip = {
  Completed: 'bg-green-100 text-green-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Delayed: 'bg-amber-100 text-amber-800',
  'On Hold': 'bg-slate-100 text-slate-700',
  'Partially Completed': 'bg-amber-100 text-amber-800',
  'Not Completed': 'bg-red-100 text-red-800',
};

export default function Admin({ userRole }) {
  const { toast } = useToast();
  const [f, setF] = useState(() => {
    const range = getCurrentWeekRange();
    return { from: range.from, to: range.to, name: '', status: '' };
  });
  const [data, setData] = useState({ rows: [], counts: {}, employees: [] });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    const qs = params.toString();
    const url = qs ? '/admin/updates?' + qs : '/admin/updates';

    api(url)
      .then((d) => {
        setData(d);
        setErr('');
      })
      .catch((ex) => setErr(ex.message))
      .finally(() => setLoading(false));
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    const qs = params.toString();
    const url = qs ? '/admin/updates?' + qs : '/admin/updates';

    api(url)
      .then((d) => {
        setData(d);
        setErr('');
        toast.success('Updates refreshed.');
      })
      .catch((ex) => {
        setErr(ex.message);
        toast.error(ex.message || 'Failed to refresh updates.');
      })
      .finally(() => setLoading(false));
  };

  const handleDownload = async () => {
    setDownloading(true);
    setErr('');
    try {
      await downloadExcel(f, 'work_updates.xlsx');
      toast.success('Excel download started.');
    } catch (ex) {
      setErr(ex.message);
      toast.error(ex.message || 'Failed to download Excel file.');
    } finally {
      setDownloading(false);
    }
  };

  const toggleStatusFilter = (status) => {
    setF((prev) => ({ ...prev, status: prev.status === status ? '' : status }));
  };

  const field =
    'rounded border border-line bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">Team Updates</h1>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 uppercase">
              {userRole === 'superadmin' ? 'Super Admin View' : 'Admin View'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {userRole === 'superadmin'
              ? 'Viewing all team updates including confidential entries.'
              : 'Viewing team updates (restricted users are hidden).'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-ink disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
            title="Refresh updates"
          >
            <svg
              className={`w-3.5 h-3.5 stroke-current ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors shadow-xs cursor-pointer"
          >
            {downloading ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* Summary Counts & Quick Filter */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs uppercase font-semibold text-slate-400">Filter by status:</span>
        {['Present', 'Partial', 'Absent'].map((s) => {
          const isActive = f.status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatusFilter(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-all ${
                chip[s] || 'bg-slate-100 text-slate-800'
              } ${
                isActive
                  ? 'ring-2 ring-brand ring-offset-1 font-bold shadow-xs'
                  : 'hover:opacity-80'
              }`}
              title={`Click to toggle ${s} filter`}
            >
              {s}: {data.counts[s] ?? 0}
            </button>
          );
        })}
        {f.status && (
          <button
            type="button"
            onClick={() => setF((prev) => ({ ...prev, status: '' }))}
            className="text-xs text-brand hover:underline font-medium ml-1"
          >
            Show all statuses
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 shadow-xs">
        <label className="text-xs font-medium text-slate-700">
          From Date
          <br />
          <input
            type="date"
            max={f.to || undefined}
            className={field}
            value={f.from}
            onChange={(e) => setF({ ...f, from: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          To Date
          <br />
          <input
            type="date"
            min={f.from || undefined}
            className={field}
            value={f.to}
            onChange={(e) => setF({ ...f, to: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Employee
          <br />
          <select
            className={field}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          >
            <option value="">All Employees</option>
            {data.employees.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Status
          <br />
          <select
            className={field}
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Partial">Partial</option>
            <option value="Absent">Absent</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const range = getCurrentWeekRange();
            setF((prev) => ({ ...prev, from: range.from, to: range.to }));
          }}
          className="px-3 py-1.5 text-xs text-brand font-medium hover:underline self-end cursor-pointer"
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => setF({ from: '', to: '', name: '', status: '' })}
          className="px-3 py-1.5 text-xs text-slate-500 font-medium hover:underline self-end cursor-pointer"
        >
          Clear filters
        </button>
      </div>

      {err && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {err}
        </div>
      )}

      {/* Main Updates Table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-xs">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="border-b border-line bg-paper text-slate-700 font-semibold">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Check-In</th>
              <th className="p-3">Check-Out</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Morning Update</th>
              <th className="p-3">Evening Update</th>
              <th className="p-3">Weekly Work</th>
              <th className="p-3">Weekly Target Status</th>
              <th className="p-3">Weekly Target Reason</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  Loading updates…
                </td>
              </tr>
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  No updates match these filters.
                </td>
              </tr>
            ) : (
              data.rows.map((r, idx) => (
                <tr
                  key={`${r.date}-${r.name}-${idx}`}
                  className="border-b border-line align-top last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="whitespace-nowrap p-3 font-mono">{shortDate(r.date) || '-'}</td>
                  <td className="whitespace-nowrap p-3 font-semibold text-ink">{r.name || '-'}</td>
                  <td className="whitespace-nowrap p-3 text-slate-700">{r.checkIn || '-'}</td>
                  <td className="whitespace-nowrap p-3 text-slate-700">{r.checkOut || '-'}</td>
                  <td className="whitespace-nowrap p-3 font-medium text-brand">{r.hoursWorked || '-'}</td>
                  <td className="max-w-xs whitespace-pre-wrap p-3 text-slate-600">
                    {r.morning || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap p-3 text-slate-600">
                    {r.evening || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap p-3 text-slate-700 font-medium">
                    {r.weeklyWork || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {r.weeklyTargetStatus ? (
                      <span
                        className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                          targetStatusChip[r.weeklyTargetStatus] || 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {r.weeklyTargetStatus}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap p-3 text-slate-600 italic">
                    {r.weeklyTargetReason || <span className="text-slate-400 not-italic">-</span>}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                        chip[r.status] || 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {r.status || '-'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
