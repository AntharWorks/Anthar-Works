'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { DropletMark } from '@/components/Logo';
import { api, setSession, SessionUser } from '@/lib/api';

type AuthResult = {
  accessToken: string;
  refreshToken?: string;
  user: SessionUser;
};

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<'email' | 'otp'>('email');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // email + password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // phone OTP
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function completeStaffLogin(res: AuthResult) {
    if (res.user.role !== 'ADMIN' && res.user.role !== 'BACKEND') {
      setError('This portal is for Admin and Backend staff only.');
      return;
    }
    setSession(res.accessToken, res.user, res.refreshToken);
    router.replace('/portal');
  }

  async function emailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register' ? { name, email, password } : { email, password };
      const res = await api<AuthResult>(path, { method: 'POST', body });
      completeStaffLogin(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
      const res = await api<AuthResult>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code },
      });
      completeStaffLogin(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMethod(next: 'email' | 'otp') {
    setMethod(next);
    setError(null);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="card p-8 shadow-soft">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-sky-50">
              <DropletMark className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
              Anthar Works
            </h1>
            <p className="mt-1 text-sm text-slate-500">Staff Portal</p>
          </div>

          {/* Method switch */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {(['email', 'otp'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMethod(m)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  method === m
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'email' ? 'Email' : 'Mobile OTP'}
              </button>
            ))}
          </div>

          {method === 'email' ? (
            <form onSubmit={emailSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="label">Full name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="input"
                    required
                  />
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder="you@example.com"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  className="input"
                  minLength={8}
                  required
                />
              </div>
              <button disabled={busy} className="btn btn-primary w-full">
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
              <p className="text-center text-sm text-slate-500">
                {mode === 'register' ? 'Already have an account?' : 'New here?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'register' ? 'login' : 'register');
                    setError(null);
                  }}
                  className="font-medium text-brand-700 hover:text-brand-800"
                >
                  {mode === 'register' ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            </form>
          ) : step === 'phone' ? (
            <form onSubmit={requestOtp} className="mt-5 space-y-4">
              <div>
                <label className="label">Mobile number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.trim())}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                  className="input"
                  required
                />
              </div>
              <button disabled={busy} className="btn btn-primary w-full">
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mt-5 space-y-4">
              <p className="text-sm text-slate-600">
                OTP sent to <span className="font-medium">{phone}</span>{' '}
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="font-medium text-brand-700 hover:text-brand-800"
                >
                  change
                </button>
              </p>
              {devOtp && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Dev mode OTP: <span className="font-mono font-bold">{devOtp}</span>
                </p>
              )}
              <div>
                <label className="label">One-time password</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  className="input tracking-[0.3em]"
                  required
                />
              </div>
              <button disabled={busy} className="btn btn-primary w-full">
                {busy ? 'Verifying…' : 'Sign in'}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </main>
  );
}
