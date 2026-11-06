import { useCallback, useEffect, useState } from 'react';
import { api, downloadMyExcel, getCurrentWeekRange, longDate, shortDate } from './api.js';
import { useToast } from './Toast.jsx';

const chip = {
  Present: 'bg-green-100 text-green-800',
  Partial: 'bg-amber-100 text-amber-800',
  Absent: 'bg-red-100 text-red-800',
};

const targetStatusChip = {
  Completed: 'bg-green-100 text-green-800 border-green-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Delayed: 'bg-amber-100 text-amber-800 border-amber-200',
  'On Hold': 'bg-slate-100 text-slate-700 border-slate-200',
  'Partially Completed': 'bg-amber-100 text-amber-800 border-amber-200',
  'Not Completed': 'bg-red-100 text-red-800 border-red-200',
};

export default function Employee() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [m, setM] = useState('');
  const [e, setE] = useState('');
  const [selectedIn, setSelectedIn] = useState('');
  const [selectedOut, setSelectedOut] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busyIn, setBusyIn] = useState(false);
  const [busyOut, setBusyOut] = useState(false);
  const [busyM, setBusyM] = useState(false);
  const [busyE, setBusyE] = useState(false);
  const [loading, setLoading] = useState(true);

  // Weekly plan state (Monday to any day of the week)
  const [weeklyWork, setWeeklyWork] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetStatus, setTargetStatus] = useState('Completed');
  const [targetReason, setTargetReason] = useState('');
  const [busyWeekly, setBusyWeekly] = useState(false);
  const [isEditingWeekly, setIsEditingWeekly] = useState(false);

  // History state
  const [history, setHistory] = useState({ rows: [], counts: {} });
  const [histFilter, setHistFilter] = useState(() => getCurrentWeekRange());
  const [histLoading, setHistLoading] = useState(true);
  const [downloadingHist, setDownloadingHist] = useState(false);

  const loadToday = useCallback(() => {
    setLoading(true);
    setLoadError('');
    api('/my-today')
      .then((d) => {
        setData(d);
        setM(d.morning || '');
        setE(d.evening || '');
        if (d.defaultCheckIn && !d.checkIn) setSelectedIn(d.defaultCheckIn);
        if (d.defaultCheckOut && !d.checkOut) setSelectedOut(d.defaultCheckOut);

        // Weekly plan population
        if (d.weeklyPlan) {
          setWeeklyWork(d.weeklyPlan.weeklyWork || '');
          setStartDate(d.weeklyPlan.startDate || d.weekRange?.monday || '');
          setEndDate(d.weeklyPlan.endDate || d.weekRange?.friday || '');
          if (d.weeklyPlan.targetStatus) {
            setTargetStatus(d.weeklyPlan.targetStatus);
          }
          setTargetReason(d.weeklyPlan.targetStatusReason || d.weeklyTargetReason || '');
        }
      })
      .catch((ex) => {
        setLoadError(ex.message);
        toast.error(ex.message);
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    const qs = new URLSearchParams(Object.entries(histFilter).filter(([, v]) => v)).toString();
    const url = qs ? '/my-history?' + qs : '/my-history';
    api(url)
      .then((res) => setHistory(res))
      .catch((ex) => console.error('Failed to load history:', ex))
      .finally(() => setHistLoading(false));
  }, [histFilter]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleCheckIn() {
    const timeToSubmit = selectedIn || data?.defaultCheckIn;
    if (!timeToSubmit) return;
    setBusyIn(true);
    try {
      const res = await api('/check-in', {
        method: 'POST',
        body: { time: timeToSubmit },
      });
      setData((prev) => ({ ...prev, ...res }));
      toast.success(`Checked in at ${timeToSubmit}`);
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyIn(false);
    }
  }

  async function handleCheckOut() {
    const timeToSubmit = selectedOut || data?.defaultCheckOut;
    if (!timeToSubmit) return;
    setBusyOut(true);
    try {
      const res = await api('/check-out', {
        method: 'POST',
        body: { time: timeToSubmit },
      });
      setData((prev) => ({ ...prev, ...res }));
      toast.success(`Checked out at ${timeToSubmit}`);
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyOut(false);
    }
  }

  async function handleSaveMorning() {
    if (!m.trim()) {
      toast.error('Morning update cannot be empty.');
      return;
    }
    setBusyM(true);
    try {
      const res = await api('/update', {
        method: 'POST',
        body: { type: 'morning', text: m.trim() },
      });
      setData((prev) => ({ ...prev, ...res }));
      toast.success('Morning update saved successfully.');
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyM(false);
    }
  }

  async function handleSaveEvening() {
    if (!e.trim()) {
      toast.error('Evening update cannot be empty.');
      return;
    }
    setBusyE(true);
    try {
      const res = await api('/update', {
        method: 'POST',
        body: { type: 'evening', text: e.trim() },
      });
      setData((prev) => ({ ...prev, ...res }));
      toast.success('Evening update saved successfully.');
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyE(false);
    }
  }

  const startEditingWeeklyPlan = () => {
    setWeeklyWork(data?.weeklyPlan?.weeklyWork || '');
    setStartDate(data?.weeklyPlan?.startDate || data?.weekRange?.monday || '');
    setEndDate(data?.weeklyPlan?.endDate || data?.weekRange?.friday || '');
    setIsEditingWeekly(true);
  };

  const cancelEditingWeeklyPlan = () => {
    setIsEditingWeekly(false);
    setWeeklyWork(data?.weeklyPlan?.weeklyWork || '');
    setStartDate(data?.weeklyPlan?.startDate || data?.weekRange?.monday || '');
    setEndDate(data?.weeklyPlan?.endDate || data?.weekRange?.friday || '');
  };

  async function handleSaveWeeklyPlan(e) {
    if (e) e.preventDefault();
    if (!weeklyWork.trim()) {
      toast.error('Please enter your weekly work plan.');
      return;
    }
    setBusyWeekly(true);
    try {
      const res = await api('/weekly-plan', {
        method: 'POST',
        body: {
          startDate: startDate || data?.weeklyPlan?.startDate || data?.weekRange?.monday,
          endDate: endDate || data?.weeklyPlan?.endDate || data?.weekRange?.friday,
          weeklyWork: weeklyWork.trim(),
        },
      });
      setData((prev) => ({
        ...prev,
        weeklyPlan: {
          ...prev?.weeklyPlan,
          ...res.weeklyPlan,
        },
        weeklyWork: res.weeklyPlan?.weeklyWork || weeklyWork.trim(),
      }));
      setIsEditingWeekly(false);
      toast.success('Weekly work plan updated successfully.');
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyWeekly(false);
    }
  }

  async function handleSaveTargetStatus() {
    if (targetStatus !== 'Completed' && !targetReason.trim()) {
      toast.error('Please enter a reason for not completing the weekly target.');
      return;
    }
    setBusyWeekly(true);
    try {
      const res = await api('/weekly-target-status', {
        method: 'POST',
        body: {
          status: targetStatus,
          reason: targetStatus !== 'Completed' ? targetReason.trim() : '',
        },
      });
      setData((prev) => ({ ...prev, weeklyPlan: res.weeklyPlan }));
      toast.success(`Weekly target marked as "${targetStatus}".`);
      loadHistory();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusyWeekly(false);
    }
  }

  async function handleDownloadMyHistory() {
    setDownloadingHist(true);
    try {
      await downloadMyExcel(histFilter);
      toast.success('Excel download started.');
    } catch (ex) {
      toast.error(ex.message || 'Failed to download your Excel file.');
    } finally {
      setDownloadingHist(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-slate-500">
        <p>Loading today's updates…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <p className="text-red-700">{loadError || 'Could not load your work updates.'}</p>
        <button
          onClick={loadToday}
          className="mt-4 rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  const morningOpen = data.morningWindow?.open;
  const eveningOpen = data.eveningWindow?.open;

  const boxClass =
    'mt-2 h-28 w-full resize-y rounded border border-line bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* WEEKLY TARGET & PLAN CARD (Visible Every Day) */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">Weekly Target & Plan</h2>
              {data.isMonday ? (
                <span className="rounded bg-brand/10 text-brand px-2 py-0.5 text-xs font-semibold">
                  Monday — Planning
                </span>
              ) : data.isFriday ? (
                <span className="rounded bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-semibold">
                  Friday — Review
                </span>
              ) : (
                <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-semibold">
                  {data.dayName || 'This Week'}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Week of {shortDate(data.weeklyPlan?.startDate || data.weekRange?.monday)} –{' '}
              {shortDate(data.weeklyPlan?.endDate || data.weekRange?.friday)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {data.weeklyPlan?.targetStatus && (
                <span
                  className={`rounded px-2.5 py-0.5 text-xs font-semibold border ${
                    targetStatusChip[data.weeklyPlan.targetStatus] || 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  Target: {data.weeklyPlan.targetStatus}
                </span>
              )}
              {data.weeklyPlan?.weeklyWork && !data.weeklyPlan?.targetStatus && (
                <span className="rounded bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-semibold">
                  ✓ Plan Active
                </span>
              )}
              {!isEditingWeekly && (
                <button
                  type="button"
                  onClick={startEditingWeeklyPlan}
                  className="inline-flex items-center gap-1 rounded border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                  title="Update your weekly plan"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {data.weeklyPlan?.weeklyWork ? 'Edit' : 'Add Plan'}
                </button>
              )}
            </div>
            {data.weeklyPlan?.targetStatus && data.weeklyPlan?.targetStatus !== 'Completed' && data.weeklyPlan?.targetStatusReason && (
              <span className="text-[11px] text-slate-500 italic max-w-xs text-right">
                Reason: {data.weeklyPlan.targetStatusReason}
              </span>
            )}
          </div>
        </div>

        {/* Weekly Plan: Can be updated on any day of the week */}
        {isEditingWeekly ? (
          <form onSubmit={handleSaveWeeklyPlan} className="mt-4 space-y-4 rounded-lg border border-brand/20 bg-brand/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {data.weeklyPlan?.weeklyWork ? 'Edit Weekly Work Plan' : 'Add Weekly Work Plan'}
                </h3>
              </div>
              <span className="rounded bg-brand/10 text-brand px-2 py-0.5 text-[11px] font-semibold">
                Editing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Start Date
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  End Date
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Weekly Work / Target
                <textarea
                  required
                  rows={4}
                  className="mt-1 w-full rounded border border-line bg-white p-3 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Describe what you plan to accomplish this week…"
                  value={weeklyWork}
                  onChange={(e) => setWeeklyWork(e.target.value)}
                  autoFocus
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelEditingWeeklyPlan}
                disabled={busyWeekly}
                className="rounded border border-line bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyWeekly || !weeklyWork.trim()}
                className="rounded bg-brand px-5 py-2 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60 transition-colors cursor-pointer shadow-xs"
              >
                {busyWeekly ? 'Updating Plan…' : 'Update Weekly Plan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-lg bg-paper p-3.5 text-xs">
            <span className="font-semibold text-slate-700">
              Target Deliverables for this Week:
            </span>
            <p className="mt-1.5 whitespace-pre-wrap text-slate-800 font-medium">
              {data.weeklyPlan?.weeklyWork || (
                <span className="text-slate-400 italic">No weekly target recorded yet.</span>
              )}
            </p>
          </div>
        )}

        {/* WEEKLY TARGET CONFIRMATION (Active on Friday only) */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Weekly Target Confirmation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.isFriday
                  ? 'Confirm your weekly target completion status below.'
                  : 'Weekly target confirmation activates on Friday.'}
              </p>
            </div>
            {!data.isFriday && (
              <span className="rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
                Active on Friday only
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Target Status
                <select
                  disabled={!data.isFriday || busyWeekly}
                  className="mt-1 block rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                >
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Delayed">Delayed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </label>

              {targetStatus === 'Completed' && (
                <button
                  onClick={handleSaveTargetStatus}
                  disabled={!data.isFriday || busyWeekly || !targetStatus}
                  className="rounded bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {busyWeekly ? 'Saving…' : 'Confirm Weekly Target'}
                </button>
              )}
            </div>

            {targetStatus !== 'Completed' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-xl">
                <label className="flex-1 text-xs font-semibold text-slate-700">
                  Reason for not completing target <span className="text-red-500">*</span>
                  <input
                    type="text"
                    disabled={!data.isFriday || busyWeekly}
                    placeholder="Enter reason why target is not completed..."
                    className="mt-1 block w-full rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    value={targetReason}
                    onChange={(e) => setTargetReason(e.target.value)}
                  />
                </label>
                <button
                  onClick={handleSaveTargetStatus}
                  disabled={!data.isFriday || busyWeekly || !targetStatus || !targetReason.trim()}
                  className="rounded bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {busyWeekly ? 'Saving…' : 'Confirm Weekly Target'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S CARD */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{longDate(data.date)}</h1>
              {data.status && (
                <span className={`rounded px-2.5 py-0.5 text-xs font-semibold ${chip[data.status] || 'bg-slate-100 text-slate-800'}`}>
                  {data.status}
                </span>
              )}
              {data.isWeeklyOff && (
                <span className="rounded bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  Weekly Off
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data.hoursWorked && (
                <span className="ml-2 font-semibold text-brand">
                  Total: {data.hoursWorked} worked
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadToday}
            className="rounded border border-line px-3 py-1 text-xs font-medium text-slate-600 hover:bg-paper"
          >
            Refresh status
          </button>
        </div>

        {/* Windows & Actions Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* MORNING SECTION */}
          <div className={`rounded-lg border p-4 transition-colors ${morningOpen ? 'border-brand/40 bg-brand/5' : 'border-line bg-paper/50'}`}>
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h2 className="font-semibold text-ink">Morning Window</h2>
                <span className="text-xs text-slate-500">9:00 AM – 1:00 PM</span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  morningOpen ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {morningOpen ? 'Open Now' : 'Closed'}
              </span>
            </div>

            {/* Check-In Controls */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Check-In Time
              </label>
              {data.checkIn ? (
                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-green-800 bg-green-50 p-2.5 rounded border border-green-200">
                  <span>✓</span>
                  <span>Checked in at <strong>{data.checkIn}</strong></span>
                </div>
              ) : morningOpen ? (
                <div className="mt-1.5 flex gap-2">
                  <select
                    className="flex-1 rounded border border-line bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={selectedIn || data.defaultCheckIn}
                    onChange={(e) => setSelectedIn(e.target.value)}
                  >
                    {data.checkInSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCheckIn}
                    disabled={busyIn || !(selectedIn || data.defaultCheckIn)}
                    className="rounded bg-brand px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {busyIn ? 'Saving…' : 'Confirm check-in'}
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500 italic bg-slate-100 p-2 rounded">
                  Morning check-in opens 9:00 AM to 1:00 PM.
                </p>
              )}
            </div>

            {/* Morning Update Box */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label htmlFor="morning-text" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Morning Update
                </label>
                <span className="text-xs text-slate-400">{m.length} / 2000</span>
              </div>
              <textarea
                id="morning-text"
                disabled={!morningOpen}
                className={boxClass}
                placeholder={morningOpen ? 'What will you work on today?' : 'Morning updates open 9:00 AM to 1:00 PM.'}
                value={m}
                maxLength={2000}
                onChange={(e) => setM(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleSaveMorning}
                  disabled={!morningOpen || busyM || !m.trim()}
                  className="rounded bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {busyM ? 'Saving…' : 'Save morning update'}
                </button>
              </div>
            </div>
          </div>

          {/* EVENING SECTION */}
          <div className={`rounded-lg border p-4 transition-colors ${eveningOpen ? 'border-brand/40 bg-brand/5' : 'border-line bg-paper/50'}`}>
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h2 className="font-semibold text-ink">Evening Window</h2>
                <span className="text-xs text-slate-500">1:00 PM – 11:55 PM</span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  eveningOpen ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {eveningOpen ? 'Open Now' : 'Closed'}
              </span>
            </div>

            {/* Check-Out Controls */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Check-Out Time
              </label>
              {data.checkOut ? (
                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-green-800 bg-green-50 p-2.5 rounded border border-green-200">
                  <span>✓</span>
                  <span>Checked out at <strong>{data.checkOut}</strong></span>
                </div>
              ) : eveningOpen ? (
                <div className="mt-1.5 flex gap-2">
                  <select
                    className="flex-1 rounded border border-line bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={selectedOut || data.defaultCheckOut}
                    onChange={(e) => setSelectedOut(e.target.value)}
                  >
                    {data.checkOutSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCheckOut}
                    disabled={busyOut || !(selectedOut || data.defaultCheckOut)}
                    className="rounded bg-brand px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {busyOut ? 'Saving…' : 'Confirm check-out'}
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500 italic bg-slate-100 p-2 rounded">
                  Evening check-out opens at 1:00 PM and runs until 11:55 PM.
                </p>
              )}
            </div>

            {/* Evening Update Box */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label htmlFor="evening-text" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Evening Update
                </label>
                <span className="text-xs text-slate-400">{e.length} / 2000</span>
              </div>
              <textarea
                id="evening-text"
                disabled={!eveningOpen}
                className={boxClass}
                placeholder={eveningOpen ? 'What did you finish today?' : 'Evening updates open 1:00 PM to 11:55 PM.'}
                value={e}
                maxLength={2000}
                onChange={(e) => setE(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleSaveEvening}
                  disabled={!eveningOpen || busyE || !e.trim()}
                  className="rounded bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {busyE ? 'Saving…' : 'Save evening update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MY HISTORY SECTION */}
      <div className="rounded-xl border border-line bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="text-xl font-bold text-ink">My History</h2>
            <p className="text-xs text-slate-500">View and download your previous work logs and attendance records.</p>
          </div>
          <button
            onClick={handleDownloadMyHistory}
            disabled={downloadingHist}
            className="rounded bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60 transition-colors"
          >
            {downloadingHist ? 'Downloading…' : 'Download my Excel'}
          </button>
        </div>

        {/* History Filters & Counts */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {['Present', 'Partial', 'Absent'].map((s) => (
              <span key={s} className={`rounded px-3 py-1 text-xs font-medium ${chip[s]}`}>
                {s}: {history.counts?.[s] ?? 0}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1 font-medium text-slate-600">
              From:
              <input
                type="date"
                max={histFilter.to || undefined}
                className="rounded border border-line px-2 py-1 text-xs"
                value={histFilter.from}
                onChange={(e) => setHistFilter({ ...histFilter, from: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1 font-medium text-slate-600">
              To:
              <input
                type="date"
                min={histFilter.from || undefined}
                className="rounded border border-line px-2 py-1 text-xs"
                value={histFilter.to}
                onChange={(e) => setHistFilter({ ...histFilter, to: e.target.value })}
              />
            </label>
            <button
              type="button"
              onClick={() => setHistFilter(getCurrentWeekRange())}
              className="text-brand font-medium hover:underline cursor-pointer"
              title="Reset to current week"
            >
              This Week
            </button>
            {(histFilter.from || histFilter.to) && (
              <button
                type="button"
                onClick={() => setHistFilter({ from: '', to: '' })}
                className="text-slate-500 underline hover:opacity-80 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-line bg-paper text-slate-700 font-semibold">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Check-In</th>
                <th className="p-2.5">Check-Out</th>
                <th className="p-2.5">Hours</th>
                <th className="p-2.5">Morning Update</th>
                <th className="p-2.5">Evening Update</th>
                <th className="p-2.5">Weekly Work</th>
                <th className="p-2.5">Target Status</th>
                <th className="p-2.5">Target Reason</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {histLoading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    Loading your history…
                  </td>
                </tr>
              ) : history.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    No history records found.
                  </td>
                </tr>
              ) : (
                history.rows.map((r, idx) => (
                  <tr key={`${r.date}-${idx}`} className="border-b border-line align-top last:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap p-2.5 font-mono">{shortDate(r.date) || '-'}</td>
                    <td className="whitespace-nowrap p-2.5 font-medium text-slate-700">{r.checkIn || '-'}</td>
                    <td className="whitespace-nowrap p-2.5 font-medium text-slate-700">{r.checkOut || '-'}</td>
                    <td className="whitespace-nowrap p-2.5 text-brand font-semibold">{r.hoursWorked || '-'}</td>
                    <td className="max-w-xs whitespace-pre-wrap p-2.5 text-slate-600">{r.morning || '-'}</td>
                    <td className="max-w-xs whitespace-pre-wrap p-2.5 text-slate-600">{r.evening || '-'}</td>
                    <td className="max-w-xs whitespace-pre-wrap p-2.5 text-slate-600 font-medium">
                      {r.weeklyWork || '-'}
                    </td>
                    <td className="whitespace-nowrap p-2.5">
                      {r.weeklyTargetStatus ? (
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${targetStatusChip[r.weeklyTargetStatus] || 'bg-slate-100 text-slate-800'}`}>
                          {r.weeklyTargetStatus}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="max-w-xs whitespace-pre-wrap p-2.5 text-slate-600 italic">
                      {r.weeklyTargetReason || <span className="not-italic">-</span>}
                    </td>
                    <td className="p-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${chip[r.status] || 'bg-slate-100 text-slate-800'}`}>
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
    </div>
  );
}
