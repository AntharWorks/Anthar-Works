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
        <h1 className="page-title">Customers</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="btn btn-primary"
        >
          {showCreate ? 'Close' : '+ New customer'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={createCustomer}
          className="card mt-4 grid grid-cols-2 gap-3 p-5 lg:grid-cols-3"
        >
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            required
          />
          <input
            placeholder="Mobile (10 digits)"
            value={form.phone}
            maxLength={10}
            onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
            className="input"
            required
          />
          <input
            placeholder="Pincode"
            value={form.pincode}
            maxLength={6}
            onChange={(e) => setForm({ ...form, pincode: e.target.value.trim() })}
            className="input"
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="input"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="input lg:col-span-2"
          />
          <button className="btn btn-accent lg:col-span-3">
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
        className="input mt-4 max-w-md"
      />

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Pincode</th>
              <th>City</th>
              <th>Subscription</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-mono">
                  <Link href={`/portal/customers/${c.id}`} className="text-brand-700 hover:text-brand-800">
                    {c.customerNo}
                  </Link>
                </td>
                <td>{c.user.name}</td>
                <td>{c.user.phone}</td>
                <td>{c.pincode ?? '—'}</td>
                <td>{c.city ?? '—'}</td>
                <td>
                  {c.subscriptions.length > 0 ? (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-600">
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
          className="btn btn-outline btn-sm"
        >
          Previous
        </button>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="btn btn-outline btn-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
