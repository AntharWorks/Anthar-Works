'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  formatDateTime,
  slaTone,
  STATUS_BADGE,
  TicketStatus,
} from '@/lib/tickets';

type TicketRow = {
  id: string;
  ticketNo: string;
  type: string;
  status: TicketStatus;
  slaDueAt: string | null;
  slotDate: string | null;
  slotWindow: string | null;
  customer: { customerNo: string; pincode: string | null; user: { name: string; phone: string } };
  assignedTechnician: { name: string } | null;
};

const ALL_STATUSES: TicketStatus[] = [
  'CREATED',
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'IN_TRANSIT',
  'IN_PROGRESS',
  'PENDING',
  'COMPLETED',
  'CANCELLED',
];

function TicketsList() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? '');
  const [pincode, setPincode] = useState('');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (pincode.length === 6) params.set('pincode', pincode);
    const res = await api<{ items: TicketRow[]; total: number }>(`/tickets?${params}`);
    setRows(res.items);
    setTotal(res.total);
  }, [status, pincode, page]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Tickets</h1>
      <p className="mt-1 text-sm text-slate-500">
        SLA colors: <span className="font-medium text-emerald-600">on track</span> ·{' '}
        <span className="font-medium text-amber-600">due within 24h</span> ·{' '}
        <span className="font-medium text-rose-600">breached</span>
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <input
          placeholder="Filter by pincode"
          value={pincode}
          maxLength={6}
          onChange={(e) => {
            setPincode(e.target.value.trim());
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const sla = slaTone(t.status, t.slaDueAt);
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/portal/tickets/${t.id}`} className="text-blue-600 hover:underline">
                      {t.ticketNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {t.customer.user.name}
                    <span className="block text-xs text-slate-400">
                      {t.customer.customerNo} · {t.customer.pincode ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{t.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{t.assignedTechnician?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {t.slotDate ? (
                      <>
                        {formatDateTime(t.slotDate)}
                        {t.slotWindow && <span className="block text-slate-400">{t.slotWindow}</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sla.className}`}>
                      {sla.label}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatDateTime(t.slaDueAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {total} ticket{total === 1 ? '' : 's'} · page {page}
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

export default function TicketsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <TicketsList />
    </Suspense>
  );
}
