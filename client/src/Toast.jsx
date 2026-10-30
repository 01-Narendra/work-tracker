import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    if (!message) return;
    const id = ++toastIdCounter;
    const canonicalType =
      type === 'ok' || type === 'success'
        ? 'success'
        : type === 'err' || type === 'error'
        ? 'error'
        : 'info';

    // Errors stay slightly longer (4.5s) to allow reading
    const effectiveDuration = canonicalType === 'error' ? Math.max(duration, 4500) : duration;

    setToasts((prev) => [...prev, { id, message, type: canonicalType }]);

    setTimeout(() => {
      removeToast(id);
    }, effectiveDuration);

    return id;
  }, [removeToast]);

  const toast = {
    show: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    ok: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    err: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={{ toast, showToast: addToast, removeToast }}>
      {children}
      {/* Fixed Toast Container at Top-Right of the Screen */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`toast-slide-in pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg backdrop-blur-sm transition-all duration-200 ${
              t.type === 'success'
                ? 'border-emerald-300 bg-white/95 text-emerald-950 shadow-emerald-900/10'
                : t.type === 'error'
                ? 'border-rose-300 bg-white/95 text-rose-950 shadow-rose-900/10'
                : 'border-sky-300 bg-white/95 text-sky-950 shadow-sky-900/10'
            }`}
          >
            {/* Status Icon */}
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">
                  <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
              {t.type === 'error' && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-xs">
                  <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z" />
                  </svg>
                </div>
              )}
              {t.type === 'info' && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-600 font-bold text-xs">
                  <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Notification Text */}
            <div className="flex-1 text-xs font-medium leading-relaxed break-words">
              {t.message}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 text-sm font-bold leading-none p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: {
        show: (msg) => console.log('[Toast]:', msg),
        success: (msg) => console.log('[Toast Success]:', msg),
        ok: (msg) => console.log('[Toast OK]:', msg),
        error: (msg) => console.error('[Toast Error]:', msg),
        err: (msg) => console.error('[Toast Error]:', msg),
        info: (msg) => console.log('[Toast Info]:', msg),
      },
      showToast: (msg) => console.log('[Toast]:', msg),
      removeToast: () => {},
    };
  }
  return ctx;
}

