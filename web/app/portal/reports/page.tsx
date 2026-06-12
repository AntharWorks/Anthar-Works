'use client';

import { useState } from 'react';
import { getToken } from '@/lib/api';

async function downloadReport(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, path: string, filename: string) {
    setBusy(key);
    setError(null);
    try {
      await downloadReport(path, filename);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const range = new URLSearchParams();
  if (from) range.set('from', new Date(from).toISOString());
  if (to) range.set('to', new Date(to).toISOString());
  const rangeQs = range.toString() ? `?${range}` : '';

  return (
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Excel downloads for operations tracking and follow-ups.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pending tickets dump</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every open ticket with customer contact numbers, technician, slot
            and SLA — ordered by SLA urgency.
          </p>
          <button
            disabled={busy !== null}
            onClick={() =>
              run('pending', '/reports/pending-tickets', 'pending-tickets.xlsx')
            }
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'pending' ? 'Generating…' : 'Download .xlsx'}
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Operations report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Four sheets: call closures, sales, technician-wise and
            backend-wise summaries. Optionally limit to a date range.
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <label className="font-medium">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="font-medium">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            disabled={busy !== null}
            onClick={() =>
              run('ops', `/reports/operations${rangeQs}`, 'operations-report.xlsx')
            }
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'ops' ? 'Generating…' : 'Download .xlsx'}
          </button>
        </section>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
