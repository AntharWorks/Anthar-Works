'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, setSession, SessionUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ sent: boolean; devOtp?: string }>(
        '/auth/otp/request',
        { method: 'POST', body: { phone } },
      );
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
    setError(null);
    setBusy(true);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken?: string;
        user: SessionUser;
      }>('/auth/otp/verify', { method: 'POST', body: { phone, code } });
      if (res.user.role !== 'ADMIN' && res.user.role !== 'BACKEND') {
        setError('This portal is for Admin and Backend staff only.');
        return;
      }
      setSession(res.accessToken, res.user, res.refreshToken);
      router.replace('/portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold">Anthar Works — Staff Portal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your registered mobile number.
        </p>

        {step === 'phone' ? (
          <form onSubmit={requestOtp} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Mobile number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                placeholder="10-digit mobile"
                inputMode="numeric"
                maxLength={10}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              OTP sent to <span className="font-medium">{phone}</span>{' '}
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-blue-600 underline"
              >
                change
              </button>
            </p>
            {devOtp && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Dev mode OTP: <span className="font-mono font-bold">{devOtp}</span>
              </p>
            )}
            <label className="block text-sm font-medium">
              One-time password
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 tracking-widest"
                required
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </main>
  );
}
