'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, STATUS_BADGE, TicketStatus } from '@/lib/tickets';

type CustomerDetail = {
  id: string;
  customerNo: string;
  address: string | null;
  pincode: string | null;
  city: string | null;
  user: { name: string; phone: string };
  devices: {
    id: string;
    purchaseDate: string;
    warrantyType: string;
    warrantyExpiry: string;
    product: { brand: string; model: string; variant: string | null };
  }[];
  subscriptions: {
    id: string;
    status: string;
    nextRenewalAt: string | null;
    plan: { name: string; priceInr: string };
  }[];
  tickets: {
    id: string;
    ticketNo: string;
    type: string;
    status: TicketStatus;
    createdAt: string;
  }[];
};

const TICKET_TYPES = ['SERVICE', 'INSTALLATION', 'COMPLAINT', 'DELIVERY'];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState({ type: 'SERVICE', slaHours: '24' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () => api<CustomerDetail>(`/customers/${id}`).then(setCustomer),
    [id],
  );

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function createTicket(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api('/tickets', {
        method: 'POST',
        body: {
          customerId: id,
          type: ticketForm.type,
          slaDueAt: new Date(
            Date.now() + Number(ticketForm.slaHours) * 3600 * 1000,
          ).toISOString(),
        },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (error && !customer) return <p className="text-rose-600">{error}</p>;
  if (!customer) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <Link href="/portal/customers" className="text-sm text-blue-600 hover:underline">
        ← All customers
      </Link>
      <div className="mt-2 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{customer.user.name}</h1>
        <span className="font-mono text-slate-500">{customer.customerNo}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {customer.user.phone} · {customer.address ?? '—'} · {customer.pincode ?? ''}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Devices & warranty</h2>
          {customer.devices.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">No devices yet.</p>
          )}
          <ul className="mt-2 space-y-2 text-sm">
            {customer.devices.map((d) => (
              <li key={d.id} className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium">
                  {d.product.brand} {d.product.model}
                  {d.product.variant ? ` (${d.product.variant})` : ''}
                </p>
                <p className="text-slate-500">
                  Purchased {formatDateTime(d.purchaseDate)} · {d.warrantyType} warranty
                  until {formatDateTime(d.warrantyExpiry)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Subscriptions</h2>
          {customer.subscriptions.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">No subscriptions.</p>
          )}
          <ul className="mt-2 space-y-2 text-sm">
            {customer.subscriptions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="font-medium">{s.plan.name}</p>
                  <p className="text-slate-500">
                    ₹{s.plan.priceInr} · renews {formatDateTime(s.nextRenewalAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Service tickets</h2>
          <form onSubmit={createTicket} className="flex items-center gap-2 text-sm">
            <select
              value={ticketForm.type}
              onChange={(e) => setTicketForm({ ...ticketForm, type: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1.5"
            >
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-slate-500">
              SLA
              <input
                value={ticketForm.slaHours}
                onChange={(e) => setTicketForm({ ...ticketForm, slaHours: e.target.value })}
                className="w-14 rounded-lg border border-slate-300 px-2 py-1.5"
                inputMode="numeric"
              />
              h
            </label>
            <button
              disabled={creating}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + New ticket
            </button>
          </form>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <ul className="mt-3 space-y-2 text-sm">
          {customer.tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/portal/tickets/${t.id}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 hover:bg-slate-100"
              >
                <span className="font-mono text-blue-600">{t.ticketNo}</span>
                <span>{t.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                  {t.status}
                </span>
                <span className="text-slate-400">{formatDateTime(t.createdAt)}</span>
              </Link>
            </li>
          ))}
          {customer.tickets.length === 0 && (
            <p className="text-slate-400">No tickets yet.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
