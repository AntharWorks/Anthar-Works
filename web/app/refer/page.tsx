'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';

type Product = { id: string; brand: string; model: string };

export default function ReferPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    source: 'REFERRAL',
    name: '',
    phone: '',
    location: '',
    productId: '',
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/v1/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: form.source,
          name: form.name,
          phone: form.phone,
          location: form.location || undefined,
          productId: form.productId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(d?.message) ? d.message.join(', ') : d?.message ?? 'Failed',
        );
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 page-title text-2xl">Thank you!</h1>
          <p className="mt-2 text-slate-600">
            We&apos;ve received the details — our team will reach out on WhatsApp
            shortly with the best offer.
          </p>
          <Link href="/" className="btn btn-primary mt-7">
            Back to home
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="page-title">Refer a friend / Buy-back</h1>
      <p className="page-subtitle mt-1">
        Refer someone for a new purifier, or exchange your old one under our
        buy-back program.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="flex gap-2">
          {[
            { value: 'REFERRAL', label: 'Referral' },
            { value: 'BUYBACK', label: 'Buy-back' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, source: opt.value })}
              className={`flex-1 rounded-lg border px-4 py-2 font-medium ${
                form.source === opt.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          placeholder={form.source === 'REFERRAL' ? "Friend's name" : 'Your name'}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input"
          required
        />
        <input
          placeholder={
            form.source === 'REFERRAL' ? "Friend's mobile number" : 'Your mobile number'
          }
          value={form.phone}
          maxLength={10}
          inputMode="numeric"
          onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
          className="input"
          required
        />
        <input
          placeholder="City / area (optional)"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="input"
        />
        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="input"
        >
          <option value="">Interested model (optional)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.brand} {p.model}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="btn btn-primary btn-lg w-full"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
      </div>
    </StoreLayout>
  );
}
