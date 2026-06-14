'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type Product = {
  id: string;
  brand: string;
  model: string;
  variant: string | null;
  priceInr: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ brand: '', model: '', variant: '', priceInr: '' });
  const isAdmin = getSessionUser()?.role === 'ADMIN';

  const load = useCallback(() => api<Product[]>('/products').then(setProducts), []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function createProduct(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/products', {
        method: 'POST',
        body: {
          brand: form.brand,
          model: form.model,
          variant: form.variant || undefined,
          priceInr: Number(form.priceInr),
        },
      });
      setForm({ brand: '', model: '', variant: '', priceInr: '' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Products</h1>
      <p className="page-subtitle">
        Multi-brand purifier catalog shown on the storefront.
      </p>

      {isAdmin && (
        <form
          onSubmit={createProduct}
          className="card mt-4 flex flex-wrap items-end gap-3 p-5"
        >
          {(['brand', 'model', 'variant'] as const).map((field) => (
            <label key={field} className="label capitalize">
              {field}
              <input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="input mt-1 block"
                required={field !== 'variant'}
              />
            </label>
          ))}
          <label className="label">
            Price (₹)
            <input
              value={form.priceInr}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, priceInr: e.target.value.trim() })}
              className="input mt-1 block w-28"
              required
            />
          </label>
          <button className="btn btn-primary">
            Add product
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="table-base w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{p.brand}</td>
                <td className="px-4 py-3">{p.model}</td>
                <td className="px-4 py-3">{p.variant ?? '—'}</td>
                <td className="px-4 py-3">₹{Number(p.priceInr).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
