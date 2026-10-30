import { useState } from 'react';
import { api } from './api.js';

export default function Login({ onLogin }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const cleanUsername = f.username.trim();
    if (!cleanUsername || !f.password) {
      setErr('Please enter both username and password');
      return;
    }

    setBusy(true);
    setErr('');
    try {
      const { token, user } = await api('/login', {
        method: 'POST',
        body: { username: cleanUsername, password: f.password },
      });
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    'mt-1 w-full rounded border border-line bg-white px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">Sign in</h1>
        <label className="block text-sm font-medium text-slate-700">
          Username
          <input
            className={input}
            autoFocus
            autoComplete="username"
            required
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            required
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </label>
        {err && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">
            {err}
          </p>
        )}
        <button
          disabled={busy}
          type="submit"
          className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
