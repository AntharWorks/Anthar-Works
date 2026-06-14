'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type Settings = {
  onlinePaymentsEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  configured: { payments: boolean; whatsapp: boolean; sms: boolean };
};

type Flag = keyof Omit<Settings, 'configured'>;

const TOGGLES: {
  key: Flag;
  configuredKey: keyof Settings['configured'];
  title: string;
  description: string;
  note?: string;
}[] = [
  {
    key: 'onlinePaymentsEnabled',
    configuredKey: 'payments',
    title: 'Online payments (Razorpay)',
    description:
      'When on, customers pay online at checkout. When off, customers still place orders and staff mark them paid here in the portal.',
  },
  {
    key: 'whatsappEnabled',
    configuredKey: 'whatsapp',
    title: 'WhatsApp messages',
    description:
      'Order, renewal, delivery, ticket and reminder messages over WhatsApp, plus internal company alerts.',
  },
  {
    key: 'smsEnabled',
    configuredKey: 'sms',
    title: 'SMS messages',
    description: 'The same customer notifications over SMS.',
    note: 'Login OTP always sends over SMS, even when this is off.',
  },
];

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={`mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        on ? 'bg-emerald-500' : 'bg-slate-300'
      } disabled:opacity-50`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const isAdmin = getSessionUser()?.role === 'ADMIN';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Flag | null>(null);

  const load = useCallback(() => api<Settings>('/settings').then(setSettings), []);

  useEffect(() => {
    if (isAdmin) load().catch((e) => setError(e.message));
  }, [isAdmin, load]);

  async function toggle(key: Flag, next: boolean) {
    setSaving(key);
    setError(null);
    try {
      const updated = await api<Settings>('/settings', {
        method: 'PATCH',
        body: { [key]: next },
      });
      setSettings(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Only admins can change system settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">
        Turn features on or off. Changes take effect within a few seconds.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-6 space-y-4">
        {TOGGLES.map((t) => {
          const on = settings?.[t.key] ?? false;
          const configured = settings?.configured[t.configuredKey] ?? false;
          return (
            <section
              key={t.key}
              className="card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{t.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                </div>
                <Toggle
                  on={on}
                  disabled={saving !== null || !settings}
                  onClick={() => toggle(t.key, !on)}
                />
              </div>
              {settings && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    Status:{' '}
                    {on && configured ? (
                      <span className="font-medium text-emerald-600">Live</span>
                    ) : on && !configured ? (
                      <span className="font-medium text-amber-600">
                        On, but not configured on the server
                      </span>
                    ) : (
                      <span className="font-medium text-slate-500">Off</span>
                    )}
                  </p>
                  {!configured && (
                    <p className="text-slate-500">
                      Credentials aren&apos;t set on the server yet, so this stays
                      inactive even when turned on.
                    </p>
                  )}
                  {t.note && <p className="text-slate-500">{t.note}</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
