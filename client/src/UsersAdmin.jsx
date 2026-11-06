import { useCallback, useEffect, useState } from 'react';
import { api, getSystemSettings, toggleCurrentWeekUpdates, shortDate } from './api.js';
import { useToast } from './Toast.jsx';

export default function UsersAdmin() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Current week updates toggle state
  const [allowCurrentWeekUpdates, setAllowCurrentWeekUpdates] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);

  // New user form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('employee');
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [busyAdd, setBusyAdd] = useState(false);
  const [addErr, setAddErr] = useState('');

  const loadSettings = useCallback(() => {
    getSystemSettings()
      .then((d) => {
        setAllowCurrentWeekUpdates(Boolean(d.allowCurrentWeekUpdates));
      })
      .catch((ex) => console.error('Failed to load system settings:', ex));
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api('/superadmin/users')
      .then((d) => {
        setUsers(d.users || []);
        setAdmins(d.admins || []);
        setErr('');
      })
      .catch((ex) => setErr(ex.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
    loadSettings();
  }, [loadUsers, loadSettings]);

  async function handleToggleCurrentWeek() {
    const nextVal = !allowCurrentWeekUpdates;
    setBusyToggle(true);
    try {
      const res = await toggleCurrentWeekUpdates(nextVal);
      setAllowCurrentWeekUpdates(Boolean(res.allowCurrentWeekUpdates));
      toast.success(res.message);
    } catch (ex) {
      toast.error(ex.message || 'Failed to update setting.');
    } finally {
      setBusyToggle(false);
    }
  }

  async function handleResetPassword(u) {
    if (!window.confirm(`Reset password for "${u.name}" (${u.username}) to the default "sci12345"?`)) {
      return;
    }
    setErr('');
    try {
      const res = await api('/superadmin/reset-password', {
        method: 'POST',
        body: { username: u.username },
      });
      toast.success(res.message || 'Password reset successfully.');
      loadUsers();
    } catch (ex) {
      toast.error(ex.message);
    }
  }

  async function handleAssignAdmin(employee, adminIdToAssign) {
    if (!adminIdToAssign) return;
    const currentAdminIds = (employee.assignedAdmins || []).map((a) => a._id);
    if (currentAdminIds.includes(adminIdToAssign)) return;
    const nextAdminIds = [...currentAdminIds, adminIdToAssign];

    setErr('');
    try {
      await api(`/superadmin/users/${employee.username}`, {
        method: 'PATCH',
        body: { assignedAdmins: nextAdminIds },
      });
      toast.success(`Assigned admin to "${employee.name}".`);
      loadUsers();
    } catch (ex) {
      toast.error(ex.message);
    }
  }

  async function handleRemoveAdmin(employee, adminIdToRemove) {
    const currentAdminIds = (employee.assignedAdmins || []).map((a) => a._id);
    const nextAdminIds = currentAdminIds.filter((id) => id !== adminIdToRemove);

    setErr('');
    try {
      await api(`/superadmin/users/${employee.username}`, {
        method: 'PATCH',
        body: { assignedAdmins: nextAdminIds },
      });
      toast.success(`Removed assigned admin from "${employee.name}".`);
      loadUsers();
    } catch (ex) {
      toast.error(ex.message);
    }
  }

  async function handleToggleActive(u) {
    const nextActive = u.active === false ? true : false;
    const actionName = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionName} user "${u.name}" (@${u.username})?`)) {
      return;
    }
    setErr('');
    try {
      await api(`/superadmin/users/${u.username}`, {
        method: 'PATCH',
        body: { active: nextActive },
      });
      toast.success(`User "${u.name}" has been ${nextActive ? 'activated' : 'deactivated'}.`);
      loadUsers();
    } catch (ex) {
      toast.error(ex.message);
    }
  }

  async function handleRoleChange(u, nextRole) {
    if (u.role === nextRole) return;
    setErr('');
    try {
      await api(`/superadmin/users/${u.username}`, {
        method: 'PATCH',
        body: { role: nextRole },
      });
      toast.success(`Updated role for ${u.name} to ${nextRole}.`);
      loadUsers();
    } catch (ex) {
      toast.error(ex.message);
    }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    setAddErr('');
    setBusyAdd(true);
    try {
      await api('/superadmin/users', {
        method: 'POST',
        body: {
          name: name.trim(),
          username: username.trim(),
          role,
          assignedAdmins: role !== 'superadmin' ? selectedAdmins : [],
        },
      });
      toast.success(`User "${name}" created successfully with default password sci12345.`);
      setShowAddModal(false);
      setName('');
      setUsername('');
      setRole('employee');
      setSelectedAdmins([]);
      loadUsers();
    } catch (ex) {
      setAddErr(ex.message);
    } finally {
      setBusyAdd(false);
    }
  }

  const roleBadge = {
    superadmin: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    employee: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">User Management & Admin Assignment</h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage system users, assign employees to specific Admins, reset passwords, and toggle account activation.
          </p>
        </div>
        <button
          onClick={() => {
            setAddErr('');
            setSelectedAdmins([]);
            setShowAddModal(true);
          }}
          className="rounded bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-dark transition-colors"
        >
          + Add User
        </button>
      </div>

      {err && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {err}
        </div>
      )}

      {/* SYSTEM CONTROLS: Current Week Updates Window */}
      <div className="rounded-xl border border-line bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-ink">Current Week Updates Window</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  allowCurrentWeekUpdates
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    allowCurrentWeekUpdates ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                  }`}
                ></span>
                {allowCurrentWeekUpdates ? 'Enabled (Grace Mode Active)' : 'Disabled (Strict Windows)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              {allowCurrentWeekUpdates ? (
                <span className="text-amber-900 font-medium">
                  Enabled: Employees and Admins can now add or update their check-in, check-out, and updates for any day of the current week, even outside standard morning (9 AM–1 PM) and evening (1 PM–11:55 PM) windows.
                </span>
              ) : (
                <span>
                  Strict Mode: Users cannot add or update their check-in, check-out, or updates outside the morning (9 AM–1 PM) and evening (1 PM–11:55 PM) windows of the current day.
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleCurrentWeek}
            disabled={busyToggle}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap ${
              allowCurrentWeekUpdates
                ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                : 'bg-brand text-white hover:bg-brand-dark'
            } disabled:opacity-60`}
          >
            {busyToggle ? (
              <span>Updating…</span>
            ) : allowCurrentWeekUpdates ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>Disable Current Week Updates</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                </svg>
                <span>Enable Current Week Updates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-xs">
        <table className="w-full min-w-[950px] text-left text-xs">
          <thead className="border-b border-line bg-paper text-slate-700 font-semibold">
            <tr>
              <th className="p-3">Full Name</th>
              <th className="p-3">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3">Assigned Admin(s)</th>
              <th className="p-3">Account Status</th>
              <th className="p-3">Password Status</th>
              <th className="p-3">Registered</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const assigned = u.assignedAdmins || [];
                const assignedIds = assigned.map((a) => a._id);
                const unassignedAdmins = admins.filter(
                  (a) => !assignedIds.includes(a._id) && a._id !== u._id
                );

                return (
                  <tr
                    key={u.username}
                    className={`border-b border-line align-top last:border-0 hover:bg-slate-50 ${
                      u.active === false ? 'opacity-60 bg-slate-50/70' : ''
                    }`}
                  >
                    <td className="p-3 font-semibold text-ink whitespace-nowrap">{u.name}</td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">@{u.username}</td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className={`rounded px-2 py-0.5 text-xs font-semibold border border-line cursor-pointer ${
                          roleBadge[u.role] || 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                    </td>

                    {/* ASSIGNED ADMIN(S) COLUMN */}
                    <td className="p-3">
                      {u.role !== 'superadmin' ? (
                        <div className="space-y-1.5 min-w-[220px]">
                          {/* Badges of currently assigned admins */}
                          <div className="flex flex-wrap gap-1 items-center">
                            {assigned.length > 0 ? (
                              assigned.map((adm) => (
                                <span
                                  key={adm._id}
                                  className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-800"
                                >
                                  <span>{adm.name || adm.username}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAdmin(u, adm._id)}
                                    className="text-blue-500 hover:text-red-700 font-bold ml-0.5 text-xs cursor-pointer"
                                    title={`Unassign ${adm.name || adm.username}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Unassigned (Super Admin only)
                              </span>
                            )}
                          </div>

                          {/* Dropdown to assign an additional Admin */}
                          {unassignedAdmins.length > 0 ? (
                            <select
                              className="w-full rounded border border-line bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-brand focus:outline-none cursor-pointer"
                              value=""
                              onChange={(e) => handleAssignAdmin(u, e.target.value)}
                            >
                              <option value="">+ Assign to Admin...</option>
                              {unassignedAdmins.map((adm) => (
                                <option key={adm._id} value={adm._id}>
                                  Assign: {adm.name} (@{adm.username})
                                </option>
                              ))}
                            </select>
                          ) : admins.length > 0 && assigned.length === admins.length ? (
                            <span className="text-[10px] text-green-700 font-medium block">
                              ✓ Assigned to all available Admins
                            </span>
                          ) : admins.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic block">
                              No Admin accounts created yet
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      {u.active !== false ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.mustChangePassword ? (
                        <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                          Default (sci12345)
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Updated
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 font-mono whitespace-nowrap">
                      {u.createdAt ? shortDate(u.createdAt) : '—'}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="rounded border border-line px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-paper focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                          u.active !== false
                            ? 'border-red-200 text-red-700 hover:bg-red-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {u.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-ink">Add New User</h2>
            <p className="mt-1 text-xs text-slate-500">
              New users are assigned the initial password <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">sci12345</code> and will be required to change it on their first login.
            </p>

            {addErr && (
              <div role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {addErr}
              </div>
            )}

            <form onSubmit={handleAddUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Full Name
                  <input
                    type="text"
                    required
                    className="mt-1 w-full rounded border border-line px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Username
                  <input
                    type="text"
                    required
                    className="mt-1 w-full rounded border border-line px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="e.g. jdoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Role
                  <select
                    className="mt-1 w-full rounded border border-line px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </label>
              </div>

              {/* Assign to Admins on Creation */}
              {role !== 'superadmin' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Assign to Admin(s)
                  </label>
                  {admins.length > 0 ? (
                    <div className="mt-1 max-h-32 overflow-y-auto rounded border border-line p-2 space-y-1 bg-white">
                      {admins.map((adm) => (
                        <label key={adm._id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={selectedAdmins.includes(adm._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAdmins([...selectedAdmins, adm._id]);
                              } else {
                                setSelectedAdmins(selectedAdmins.filter((id) => id !== adm._id));
                              }
                            }}
                            className="rounded border-line text-brand focus:ring-brand"
                          />
                          <span className="font-medium">{adm.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">(@{adm.username})</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400 italic">
                      No admin accounts found yet. You can assign admins anytime later.
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    One employee can be assigned to multiple admins. Unassigned employees are visible only to Super Admin.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={busyAdd}
                  className="rounded border border-line px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAdd}
                  className="rounded bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {busyAdd ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
