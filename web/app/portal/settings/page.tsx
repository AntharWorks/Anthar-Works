'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type Settings = {
  onlinePaymentsEnabled: boolean;
  paymentsConfigured: boolean;
};

export default function SettingsPage() {
  const isAdmin = getSessionUser()?.role === 'ADMIN';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api<Settings>('/settings').then(setSettings), []);

  useEffect(() => {
    if (isAdmin) load().catch((e) => setError(e.message));
  }, [isAdmin, load]);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Settings>('/settings', {
        method: 'PATCH',
        body: { onlinePaymentsEnabled: next },
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-slate-500">Only admins can change system settings.</p>
      </div>
    );
  }

  const live = settings?.onlinePaymentsEnabled && settings?.paymentsConfigured;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">System configuration.</p>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Online payments (Razorpay)</h2>
            <p className="mt-1 text-sm text-slate-500">
              When on, customers pay online at checkout. When off, customers still
              place orders and staff mark them paid here in the portal.
            </p>
          </div>
          <button
            disabled={saving || !settings}
            onClick={() => settings && toggle(!settings.onlinePaymentsEnabled)}
            className={`mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
              settings?.onlinePaymentsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
            } disabled:opacity-50`}
            aria-pressed={settings?.onlinePaymentsEnabled ?? false}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                settings?.onlinePaymentsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings && (
          <div className="mt-4 space-y-1 text-sm">
            <p>
              Status:{' '}
              {live ? (
                <span className="font-medium text-emerald-600">
                  Live — taking online payments
                </span>
              ) : (
                <span className="font-medium text-amber-600">
                  Offline — orders are taken and marked paid by staff
                </span>
              )}
            </p>
            {!settings.paymentsConfigured && (
              <p className="text-slate-500">
                Razorpay keys are not set on the server, so online payments stay
                off even when enabled here. Add <code>RAZORPAY_KEY_ID</code> and{' '}
                <code>RAZORPAY_KEY_SECRET</code> to go live.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
