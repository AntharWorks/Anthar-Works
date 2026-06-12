'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type CustomerRow = {
  id: string;
  customerNo: string;
  pincode: string | null;
  city: string | null;
  user: { name: string; phone: string };
  subscriptions: { id: string }[];
};

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    pincode: '',
    city: '',
    address: '',
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    const res = await api<{ items: CustomerRow[]; total: number }>(
      `/customers?${params}`,
    );
    setRows(res.items);
    setTotal(res.total);
  }, [q, page]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function createCustomer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/customers', {
        method: 'POST',
        body: {
          name: form.name,
          phone: form.phone,
          pincode: form.pincode || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
        },
      });
      setShowCreate(false);
      setForm({ name: '', phone: '', pincode: '', city: '', address: '' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          {showCreate ? 'Close' : '+ New customer'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={createCustomer}
          className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-3"
        >
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <input
            placeholder="Mobile (10 digits)"
            value={form.phone}
            maxLength={10}
            onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
            className="rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <input
            placeholder="Pincode"
            value={form.pincode}
            maxLength={6}
            onChange={(e) => setForm({ ...form, pincode: e.target.value.trim() })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 lg:col-span-2"
          />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 lg:col-span-3">
            Create customer ID
          </button>
        </form>
      )}

      <input
        placeholder="Search by name, phone or customer ID…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="mt-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2"
      />

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Pincode</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono">
                  <Link href={`/portal/customers/${c.id}`} className="text-blue-600 hover:underline">
                    {c.customerNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.user.name}</td>
                <td className="px-4 py-3">{c.user.phone}</td>
                <td className="px-4 py-3">{c.pincode ?? '—'}</td>
                <td className="px-4 py-3">{c.city ?? '—'}</td>
                <td className="px-4 py-3">
                  {c.subscriptions.length > 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      None
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {total} customer{total === 1 ? '' : 's'} · page {page}
      </p>
      <div className="mt-1 flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
