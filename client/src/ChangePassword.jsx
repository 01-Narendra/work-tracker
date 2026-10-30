import { useState } from 'react';
import { api } from './api.js';
import { useToast } from './Toast.jsx';

export default function ChangePassword({ forced = false, onClose, onSuccess }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (newPassword.length < 8) {
      setErr('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === 'sci12345') {
      setErr('New password must differ from the default password (sci12345).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await api('/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword, confirmPassword },
      });
      if (res.token) localStorage.setItem('token', res.token);
      if (res.user) localStorage.setItem('user', JSON.stringify(res.user));
      setMsg('Password updated successfully!');
      toast.success('Password updated successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess(res.user);
        if (onClose) onClose();
      }, 700);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          {forced ? 'Set your new password' : 'Change password'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {forced
            ? 'For security, you must change your default password before accessing the system.'
            : 'Enter your current password and choose a new password.'}
        </p>
      </div>

      {err && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {err}
        </div>
      )}

      {msg && (
        <div role="status" className="rounded border border-green-200 bg-green-50 p-2.5 text-xs text-green-700">
          {msg}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-700">
          Current password
          <input
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={forced ? 'Default password (sci12345)' : 'Enter current password'}
          />
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700">
          New password
          <input
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters (different from sci12345)"
          />
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700">
          Confirm new password
          <input
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {!forced && onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border border-line px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-paper"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
        >
          {busy ? 'Updating…' : 'Save password'}
        </button>
      </div>
    </form>
  );

  if (forced) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-md">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-lg">
        {content}
      </div>
    </div>
  );
}

