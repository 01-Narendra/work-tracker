import { useState } from 'react';
import Login from './Login.jsx';
import Employee from './Employee.jsx';
import Admin from './Admin.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import ChangePassword from './ChangePassword.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('updates'); // for admin: 'my' | 'updates'; for superadmin: 'updates' | 'users'
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // Force Change Password screen if mustChangePassword is true
  if (user.mustChangePassword) {
    return (
      <ChangePassword
        forced
        onSuccess={(updatedUser) => {
          setUser((prev) => ({ ...prev, ...updatedUser, mustChangePassword: false }));
        }}
      />
    );
  }

  const roleLabel = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    employee: 'Employee',
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased">
      {/* Top Navigation Header */}
      <header className="border-b border-line bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-6">
            <span className="font-bold text-base tracking-tight text-ink">Daily Work Updates</span>

            {/* Admin Navigation Tabs (Can put updates & view assigned team) */}
            {user.role === 'admin' && (
              <nav className="flex items-center gap-1 bg-paper p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('my')}
                  className={`rounded-md px-3 py-1 transition-all cursor-pointer ${
                    activeTab === 'my'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  My Updates
                </button>
                <button
                  onClick={() => setActiveTab('updates')}
                  className={`rounded-md px-3 py-1 transition-all cursor-pointer ${
                    activeTab !== 'my'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  Team Updates
                </button>
              </nav>
            )}

            {/* Super Admin Navigation Tabs (Only Updates & Users) */}
            {user.role === 'superadmin' && (
              <nav className="flex items-center gap-1 bg-paper p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('updates')}
                  className={`rounded-md px-3 py-1 transition-all cursor-pointer ${
                    activeTab !== 'users'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  Updates
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`rounded-md px-3 py-1 transition-all cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  Users
                </button>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-semibold text-slate-800">{user.name}</span>
              <span className="rounded bg-slate-100 border border-line px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                {roleLabel[user.role] || user.role}
              </span>
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="rounded border border-line px-2.5 py-1 text-slate-700 hover:bg-paper transition-colors cursor-pointer"
            >
              Change Password
            </button>

            <button
              onClick={signOut}
              className="rounded border border-line px-2.5 py-1 text-slate-700 hover:bg-paper transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {user.role === 'employee' && <Employee />}
        {user.role === 'admin' && (
          activeTab === 'my' ? <Employee /> : <Admin userRole="admin" />
        )}
        {user.role === 'superadmin' && (
          activeTab === 'users' ? <UsersAdmin /> : <Admin userRole="superadmin" />
        )}
      </main>

      {/* Voluntary Password Change Modal */}
      {showPasswordModal && (
        <ChangePassword
          forced={false}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={(updatedUser) => {
            setUser((prev) => ({ ...prev, ...updatedUser }));
            setShowPasswordModal(false);
          }}
        />
      )}
    </div>
  );
}
