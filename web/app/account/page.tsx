'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';

type Dashboard = {
  customerNo: string;
  user: { name: string };
  devices: {
    id: string;
    purchaseDate: string;
    warrantyType: string;
    warrantyExpiry: string;
    product: { brand: string; model: string; variant: string | null };
  }[];
  subscriptions: {
    id: string;
    status: string;
    nextRenewalAt: string | null;
    plan: { name: string; priceInr: string };
  }[];
  tickets: {
    id: string;
    ticketNo: string;
    type: string;
    status: string;
    slotDate: string | null;
    slotWindow: string | null;
    createdAt: string;
  }[];
};

const SLOT_WINDOWS = ['10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00'];

type TicketDetail = {
  ticketNo: string;
  status: string;
  events: {
    id: string;
    toStatus: string | null;
    remarks: string | null;
    createdAt: string;
  }[];
};

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN') : '—';

export default function AccountPage() {
  const [step, setStep] = useState<'phone' | 'otp' | 'home'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [timeline, setTimeline] = useState<TicketDetail | null>(null);
  const [slotFor, setSlotFor] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({ date: '', window: SLOT_WINDOWS[0] });
  const [complaintType, setComplaintType] = useState('COMPLAINT');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async (authToken: string) => {
    const res = await fetch('/api/v1/me/dashboard', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error('Could not load your account');
    setData(await res.json());
  }, []);

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message ?? 'Could not send OTP');
      setDevOtp(d.devOtp ?? null);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message ?? 'Invalid OTP');
      if (d.user.role !== 'CUSTOMER') {
        setError('This page is for customers. Staff: use the portal login.');
        return;
      }
      setToken(d.accessToken);
      await loadDashboard(d.accessToken);
      setStep('home');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function raiseTicket(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: complaintType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message ?? 'Could not raise ticket');
      setNotice(`Ticket ${d.ticketNo} raised — track its status below.`);
      if (token) await loadDashboard(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // FRD: customer selects the installation date & time post-delivery.
  async function pickSlot(e: FormEvent) {
    e.preventDefault();
    if (!slotFor) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/me/tickets/${slotFor}/slot`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotDate: new Date(slotForm.date).toISOString(),
          slotWindow: slotForm.window,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message ?? 'Could not save slot');
      setNotice('Slot saved — our team will confirm the technician shortly.');
      setSlotFor(null);
      if (token) await loadDashboard(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function viewTimeline(ticketId: string) {
    setError(null);
    const res = await fetch(`/api/v1/me/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTimeline(await res.json());
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="page-title">My Account</h1>

      {step === 'phone' && (
        <form onSubmit={requestOtp} className="mt-6 max-w-sm space-y-3">
          <input
            placeholder="Registered mobile number"
            value={phone}
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => setPhone(e.target.value.trim())}
            className="input"
            required
          />
          <button
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyOtp} className="mt-6 max-w-sm space-y-3">
          {devOtp && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Dev mode OTP: <span className="font-mono font-bold">{devOtp}</span>
            </p>
          )}
          <input
            placeholder="6-digit OTP"
            value={code}
            maxLength={6}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value.trim())}
            className="input tracking-widest"
            required
          />
          <button
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? 'Verifying…' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'home' && data && (
        <div className="mt-6 space-y-6">
          <p className="text-slate-600">
            Welcome back, <span className="font-semibold">{data.user.name}</span>{' '}
            <span className="font-mono text-sm text-slate-400">{data.customerNo}</span>
          </p>

          <section className="card p-5">
            <h2 className="font-semibold">My purifiers & warranty</h2>
            {data.devices.length === 0 && (
              <p className="mt-2 text-sm text-slate-400">No devices registered yet.</p>
            )}
            <ul className="mt-2 space-y-2 text-sm">
              {data.devices.map((d) => (
                <li key={d.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium">
                    {d.product.brand} {d.product.model}
                    {d.product.variant ? ` (${d.product.variant})` : ''}
                  </p>
                  <p className="text-slate-500">
                    Purchased {fmt(d.purchaseDate)} · {d.warrantyType} warranty until{' '}
                    <span
                      className={
                        new Date(d.warrantyExpiry) > new Date()
                          ? 'font-medium text-emerald-600'
                          : 'font-medium text-rose-600'
                      }
                    >
                      {fmt(d.warrantyExpiry)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">My subscriptions</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {data.subscriptions.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <span>
                    <span className="font-medium">{s.plan.name}</span> · ₹
                    {Number(s.plan.priceInr).toLocaleString('en-IN')} · renews{' '}
                    {fmt(s.nextRenewalAt)}
                  </span>
                  <Link href="/renew" className="font-medium text-brand-700 hover:text-brand-800">
                    Renew
                  </Link>
                </li>
              ))}
              {data.subscriptions.length === 0 && (
                <p className="text-slate-400">No subscriptions.</p>
              )}
            </ul>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">My service tickets</h2>
              <form onSubmit={raiseTicket} className="flex items-center gap-2 text-sm">
                <select
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value)}
                  className="input"
                >
                  <option value="COMPLAINT">Complaint</option>
                  <option value="SERVICE">Service request</option>
                </select>
                <button
                  disabled={busy}
                  className="btn btn-primary btn-sm"
                >
                  Raise ticket
                </button>
              </form>
            </div>
            {notice && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </p>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {data.tickets.map((t) => (
                <li key={t.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{t.ticketNo}</span>
                    <span>{t.type}</span>
                    <span className="badge bg-brand-50 text-brand-700">
                      {t.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => viewTimeline(t.id)}
                      className="font-medium text-brand-700 hover:text-brand-800"
                    >
                      Track
                    </button>
                  </div>
                  {t.slotDate ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Slot: {fmt(t.slotDate)} {t.slotWindow ?? ''}
                    </p>
                  ) : (
                    ['CREATED', 'ASSIGNED'].includes(t.status) && (
                      <div className="mt-2">
                        {slotFor === t.id ? (
                          <form onSubmit={pickSlot} className="flex flex-wrap items-center gap-2">
                            <input
                              type="date"
                              value={slotForm.date}
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                              className="input"
                              required
                            />
                            <select
                              value={slotForm.window}
                              onChange={(e) => setSlotForm({ ...slotForm, window: e.target.value })}
                              className="input"
                            >
                              {SLOT_WINDOWS.map((w) => (
                                <option key={w} value={w}>
                                  {w}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={busy}
                              className="btn btn-accent btn-sm"
                            >
                              Save slot
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setSlotFor(t.id)}
                            className="btn btn-accent btn-sm"
                          >
                            Pick installation slot
                          </button>
                        )}
                      </div>
                    )
                  )}
                </li>
              ))}
              {data.tickets.length === 0 && <p className="text-slate-400">No tickets.</p>}
            </ul>

            {timeline && (
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <p className="font-medium">
                  {timeline.ticketNo} — {timeline.status.replace('_', ' ')}
                </p>
                <ol className="mt-2 space-y-2 text-sm">
                  {timeline.events.map((ev) => (
                    <li key={ev.id} className="border-l-2 border-slate-200 pl-3">
                      <span className="font-medium">
                        {ev.toStatus?.replace('_', ' ') ?? 'Update'}
                      </span>
                      {ev.remarks && <span className="text-slate-500"> — {ev.remarks}</span>}
                      <span className="block text-xs text-slate-400">
                        {new Date(ev.createdAt).toLocaleString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </StoreLayout>
  );
}
