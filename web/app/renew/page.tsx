'use client';

import Script from 'next/script';
import { FormEvent, useCallback, useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';

type Subscription = {
  id: string;
  status: string;
  nextRenewalAt: string | null;
  plan: { name: string; priceInr: string; billingPeriod: string };
};

type RenewalOrder = {
  orderId: string;
  orderNo: string;
  amountInr: number;
  mode: 'online' | 'offline';
  razorpay?: { razorpayOrderId: string; keyId: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: object) => { open: () => void };
  }
}

export default function RenewPage() {
  const [step, setStep] = useState<'phone' | 'otp' | 'subs'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call<T>(path: string, body?: unknown, authed = false): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authed && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? 'Request failed',
      );
    }
    return data as T;
  }

  const loadSubs = useCallback(
    async (authToken: string) => {
      const res = await fetch('/api/v1/me/subscriptions', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Could not load subscriptions');
      setSubs(await res.json());
    },
    [],
  );

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await call<{ devOtp?: string }>('/auth/otp/request', { phone });
      setDevOtp(res.devOtp ?? null);
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
      const res = await call<{ accessToken: string; user: { role: string } }>(
        '/auth/otp/verify',
        { phone, code },
      );
      if (res.user.role !== 'CUSTOMER') {
        setError('This page is for customers. Staff: use the portal login.');
        return;
      }
      setToken(res.accessToken);
      await loadSubs(res.accessToken);
      setStep('subs');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(order: RenewalOrder, payment: { id: string; signature: string }) {
    if (!order.razorpay) return;
    await call(`/checkout/${order.orderId}/confirm`, {
      razorpayOrderId: order.razorpay.razorpayOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: payment.signature,
    });
    setDone(order.orderNo);
    if (token) await loadSubs(token);
  }

  async function renew(sub: Subscription) {
    setBusy(true);
    setError(null);
    setDone(null);
    setPlaced(null);
    try {
      const res = await fetch(`/api/v1/me/subscriptions/${sub.id}/renew`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const order: RenewalOrder & { message?: string } = await res.json();
      if (!res.ok) throw new Error(order.message ?? 'Could not start renewal');

      // Offline mode: record the renewal request; staff collect payment.
      if (order.mode === 'offline' || !order.razorpay) {
        setPlaced(order.orderNo);
        return;
      }
      if (!window.Razorpay) throw new Error('Payment library failed to load');
      new window.Razorpay({
        key: order.razorpay.keyId,
        order_id: order.razorpay.razorpayOrderId,
        amount: Math.round(order.amountInr * 100),
        currency: 'INR',
        name: 'Anthar Works',
        description: `Renewal — ${sub.plan.name}`,
        prefill: { contact: phone },
        handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) =>
          confirm(order, { id: r.razorpay_payment_id, signature: r.razorpay_signature }).catch(
            (err) => setError(err.message),
          ),
      }).open();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StoreLayout>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="page-title">Renew your subscription</h1>
      <p className="page-subtitle mt-1">
        One-click renewal with instant Razorpay payment.
      </p>

      {step === 'phone' && (
        <form onSubmit={requestOtp} className="mt-6 space-y-3">
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
        <form onSubmit={verifyOtp} className="mt-6 space-y-3">
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

      {step === 'subs' && (
        <div className="mt-6 space-y-3">
          {done && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              ✅ Renewal confirmed — order <span className="font-mono">{done}</span>
            </p>
          )}
          {placed && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              📝 Renewal requested — order <span className="font-mono">{placed}</span>.
              Our team will contact you to collect payment.
            </p>
          )}
          {subs.map((s) => (
            <div
              key={s.id}
              className="card flex items-center justify-between p-4"
            >
              <div>
                <p className="font-semibold">{s.plan.name}</p>
                <p className="text-sm text-slate-500">
                  ₹{Number(s.plan.priceInr).toLocaleString('en-IN')} ·{' '}
                  {s.plan.billingPeriod.replace('_', ' ').toLowerCase()} ·{' '}
                  {s.nextRenewalAt
                    ? `renews ${new Date(s.nextRenewalAt).toLocaleDateString('en-IN')}`
                    : 'no renewal date'}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => renew(s)}
                className="btn btn-accent btn-sm"
              >
                Renew now
              </button>
            </div>
          ))}
          {subs.length === 0 && (
            <p className="text-slate-400">No subscriptions found for this number.</p>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </StoreLayout>
  );
}
