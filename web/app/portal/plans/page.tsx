'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type Plan = {
  id: string;
  name: string;
  priceInr: string;
  billingPeriod: string;
  isCustom: boolean;
};

const PERIODS = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    priceInr: '',
    billingPeriod: 'MONTHLY',
    isCustom: false,
  });
  const isAdmin = getSessionUser()?.role === 'ADMIN';

  const load = useCallback(() => api<Plan[]>('/plans').then(setPlans), []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/plans', {
        method: 'POST',
        body: { ...form, priceInr: Number(form.priceInr) },
      });
      setForm({ name: '', priceInr: '', billingPeriod: 'MONTHLY', isCustom: false });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Subscription Plans</h1>
      <p className="page-subtitle">
        Standard plans plus on-the-fly custom plans for high-volume users.
      </p>

      {isAdmin && (
        <form
          onSubmit={createPlan}
          className="card mt-4 flex flex-wrap items-end gap-3 p-5"
        >
          <label className="label">
            Plan name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input mt-1 block"
              required
            />
          </label>
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
          <label className="label">
            Billing
            <select
              value={form.billingPeriod}
              onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
              className="input mt-1 block"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="label flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={form.isCustom}
              onChange={(e) => setForm({ ...form, isCustom: e.target.checked })}
            />
            Custom plan
          </label>
          <button className="btn btn-primary">
            Create plan
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="table-base w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">₹{Number(p.priceInr).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">{p.billingPeriod.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  {p.isCustom ? (
                    <span className="badge bg-brand-50 text-brand-700">
                      Custom
                    </span>
                  ) : (
                    <span className="text-slate-400">Standard</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
