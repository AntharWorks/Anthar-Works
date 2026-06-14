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
const SUB_STATUSES = ['ACTIVE', 'INACTIVE', 'STOPPED'];

type Product = { id: string; brand: string; model: string };
type Plan = { id: string; name: string; priceInr: string };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState({ type: 'SERVICE', slaHours: '24' });
  const [creating, setCreating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [deviceForm, setDeviceForm] = useState({ productId: '', warrantyType: 'RESIDENTIAL' });
  const [planId, setPlanId] = useState('');

  const load = useCallback(
    () => api<CustomerDetail>(`/customers/${id}`).then(setCustomer),
    [id],
  );

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api<Product[]>('/products').then(setProducts).catch(() => {});
    api<Plan[]>('/plans').then(setPlans).catch(() => {});
  }, [load]);

  async function registerDevice(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/customers/${id}/devices`, {
        method: 'POST',
        body: {
          productId: deviceForm.productId,
          purchaseDate: new Date().toISOString(),
          warrantyType: deviceForm.warrantyType,
        },
      });
      setDeviceForm({ productId: '', warrantyType: 'RESIDENTIAL' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function startSubscription(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/customers/${id}/subscriptions`, {
        method: 'POST',
        body: { planId },
      });
      setPlanId('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function setSubStatus(subscriptionId: string, status: string) {
    setError(null);
    try {
      await api(`/customers/subscriptions/${subscriptionId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

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
      <Link href="/portal/customers" className="text-sm text-brand-700 hover:text-brand-800">
        ← All customers
      </Link>
      <div className="mt-2 flex items-baseline gap-3">
        <h1 className="page-title">{customer.user.name}</h1>
        <span className="font-mono text-slate-500">{customer.customerNo}</span>
      </div>
      <p className="page-subtitle">
        {customer.user.phone} · {customer.address ?? '—'} · {customer.pincode ?? ''}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
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
          <form onSubmit={registerDevice} className="mt-3 flex gap-2 text-sm">
            <select
              value={deviceForm.productId}
              onChange={(e) => setDeviceForm({ ...deviceForm, productId: e.target.value })}
              className="input flex-1"
              required
            >
              <option value="">Register purchase…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.model}
                </option>
              ))}
            </select>
            <select
              value={deviceForm.warrantyType}
              onChange={(e) => setDeviceForm({ ...deviceForm, warrantyType: e.target.value })}
              className="input w-auto"
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
            <button className="btn btn-primary btn-sm">
              Add
            </button>
          </form>
        </section>

        <section className="card p-5">
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
                <select
                  value={s.status}
                  onChange={(e) => setSubStatus(s.id, e.target.value)}
                  className={`badge border-0 ${
                    s.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {SUB_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <form onSubmit={startSubscription} className="mt-3 flex gap-2 text-sm">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="input flex-1"
              required
            >
              <option value="">Start subscription…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{Number(p.priceInr).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm">
              Start
            </button>
          </form>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Service tickets</h2>
          <form onSubmit={createTicket} className="flex items-center gap-2 text-sm">
            <select
              value={ticketForm.type}
              onChange={(e) => setTicketForm({ ...ticketForm, type: e.target.value })}
              className="input w-auto"
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
                className="input w-14"
                inputMode="numeric"
              />
              h
            </label>
            <button
              disabled={creating}
              className="btn btn-primary btn-sm"
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
                <span className="font-mono text-brand-700">{t.ticketNo}</span>
                <span>{t.type}</span>
                <span className={`badge ${STATUS_BADGE[t.status]}`}>
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
