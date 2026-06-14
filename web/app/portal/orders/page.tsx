'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/tickets';

type OrderRow = {
  id: string;
  orderNo: string;
  type: string;
  status: string;
  amountInr: string;
  createdAt: string;
  customer: { customerNo: string; user: { name: string; phone: string } };
  items: { qty: number; product: { brand: string; model: string } }[];
};

const STATUS_BADGE: Record<string, string> = {
  CREATED: 'bg-slate-100 text-slate-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  DELIVERED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    const res = await api<{ items: OrderRow[]; total: number }>(`/orders?${params}`);
    setRows(res.items);
    setTotal(res.total);
  }, [page, status]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function markPaid(order: OrderRow) {
    const ref = window.prompt(
      `Record an offline payment for ${order.orderNo}.\nOptional reference (e.g. cash, UPI ref):`,
    );
    if (ref === null) return; // cancelled
    setError(null);
    try {
      await api(`/orders/${order.id}/mark-paid`, {
        method: 'PATCH',
        body: { method: ref || undefined, reference: ref || undefined },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function markDelivered(order: OrderRow) {
    const date = window.prompt(
      'Delivery date (YYYY-MM-DD) — the customer is notified on WhatsApp & SMS:',
    );
    if (!date) return;
    setError(null);
    try {
      await api(`/orders/${order.id}/deliver`, {
        method: 'PATCH',
        body: { deliveryDate: new Date(date).toISOString() },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every purchase and renewal — schedule deliveries to trigger customer
        notifications.
      </p>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        {Object.keys(STATUS_BADGE).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono">{o.orderNo}</td>
                <td className="px-4 py-3">
                  {o.customer.user.name}
                  <span className="block text-xs text-slate-400">
                    {o.customer.customerNo} · {o.customer.user.phone}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.items.length > 0
                    ? o.items
                        .map((i) => `${i.product.brand} ${i.product.model} ×${i.qty}`)
                        .join(', ')
                    : '—'}
                </td>
                <td className="px-4 py-3">{o.type}</td>
                <td className="px-4 py-3">₹{Number(o.amountInr).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status]}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {o.status === 'CREATED' && (
                    <button
                      onClick={() => markPaid(o)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Mark paid
                    </button>
                  )}
                  {o.status === 'PAID' && o.type === 'PRODUCT' && (
                    <button
                      onClick={() => markDelivered(o)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Schedule delivery
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {total} order{total === 1 ? '' : 's'} · page {page}
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
