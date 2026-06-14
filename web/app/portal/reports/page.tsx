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
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">
        Excel downloads for operations tracking and follow-ups.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
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
            className="btn btn-primary mt-4"
          >
            {busy === 'pending' ? 'Generating…' : 'Download .xlsx'}
          </button>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Operations report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Four sheets: call closures, sales, technician-wise and
            backend-wise summaries. Optionally limit to a date range.
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <label className="label">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="label">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input mt-1"
              />
            </label>
          </div>
          <button
            disabled={busy !== null}
            onClick={() =>
              run('ops', `/reports/operations${rangeQs}`, 'operations-report.xlsx')
            }
            className="btn btn-primary mt-4"
          >
            {busy === 'ops' ? 'Generating…' : 'Download .xlsx'}
          </button>
        </section>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
