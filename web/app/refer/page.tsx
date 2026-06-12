'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

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
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-4 text-2xl font-bold">Thank you!</h1>
        <p className="mt-2 text-slate-600">
          We&apos;ve received the details — our team will reach out on WhatsApp
          shortly with the best offer.
        </p>
        <Link href="/" className="mt-6 inline-block text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Refer a friend / Buy-back</h1>
      <p className="mt-1 text-sm text-slate-500">
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
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          required
        />
        <input
          placeholder="City / area (optional)"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <select
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </main>
  );
}
