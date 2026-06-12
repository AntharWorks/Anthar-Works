'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/tickets';

type LogRow = {
  id: string;
  recipient: string;
  channel: string;
  template: string;
  status: string;
  providerMessageId: string | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-600',
  SENT: 'bg-emerald-100 text-emerald-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ items: LogRow[]; total: number }>(
      `/notifications?page=${page}`,
    );
    setRows(res.items);
    setTotal(res.total);
  }, [page]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Notification Log</h1>
      <p className="mt-1 text-sm text-slate-500">
        Audit trail of every WhatsApp and SMS sent by the system.
      </p>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDateTime(n.createdAt)}
                </td>
                <td className="px-4 py-3">{n.channel}</td>
                <td className="px-4 py-3 font-mono text-xs">{n.template}</td>
                <td className="px-4 py-3">{n.recipient}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[n.status] ?? ''}`}
                  >
                    {n.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No notifications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {total} message{total === 1 ? '' : 's'} · page {page}
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
          disabled={page * 30 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
