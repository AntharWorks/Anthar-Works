'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Lead = {
  id: string;
  tempId: string;
  source: string;
  name: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  createdAt: string;
  product: { brand: string; model: string } | null;
  assignedSales: { id: string; name: string } | null;
  assignedSalesId?: string | null;
  customerId: string | null;
  customer: { customerNo: string } | null;
};

type SalesUser = { id: string; name: string };

const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'];

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-brand-50 text-brand-700',
  CONTACTED: 'bg-amber-50 text-amber-700',
  CONVERTED: 'bg-emerald-50 text-emerald-700',
  LOST: 'bg-slate-100 text-slate-600',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = filter ? `?status=${filter}` : '';
    setLeads(await api<Lead[]>(`/leads${qs}`));
  }, [filter]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api<SalesUser[]>('/users?role=SALES').then(setSalesUsers).catch(() => {});
  }, [load]);

  async function assignSales(id: string, assignedSalesId: string) {
    setError(null);
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: { assignedSalesId } });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // FRD 1.5: temp id -> unique customer id on confirmed sale.
  async function convert(lead: Lead) {
    const pincode = window.prompt(
      `Convert ${lead.tempId} (${lead.name}) to a customer.\n6-digit pincode (optional):`,
    );
    if (pincode === null) return;
    setError(null);
    try {
      await api(`/leads/${lead.id}/convert`, {
        method: 'POST',
        body: { pincode: /^\d{6}$/.test(pincode) ? pincode : undefined },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Leads</h1>
      <p className="page-subtitle">
        Captured from product taps, referrals, buy-back interest and sales
        executives. New leads trigger automatic WhatsApp follow-ups.
      </p>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input mt-4"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="table-base w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead ID</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Interest</th>
              <th className="px-4 py-3">Sales exec</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono">{l.tempId}</td>
                <td className="px-4 py-3">{l.source}</td>
                <td className="px-4 py-3">{l.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {l.phone ? (
                    <a href={`tel:${l.phone}`} className="text-brand-700 hover:text-brand-800">
                      {l.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.product ? `${l.product.brand} ${l.product.model}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={l.assignedSales?.id ?? ''}
                    onChange={(e) => e.target.value && assignSales(l.id, e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">Unassigned</option>
                    {salesUsers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[l.status]}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {l.status === 'CONVERTED' && l.customerId ? (
                    <Link
                      href={`/portal/customers/${l.customerId}`}
                      className="text-xs text-brand-700 hover:text-brand-800"
                    >
                      {l.customer?.customerNo ?? 'View customer'}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={l.status}
                        onChange={(e) => setStatus(l.id, e.target.value)}
                        className="input text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {l.phone && l.name && l.status !== 'LOST' && (
                        <button
                          onClick={() => convert(l)}
                          className="btn btn-accent btn-sm"
                        >
                          Convert
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
