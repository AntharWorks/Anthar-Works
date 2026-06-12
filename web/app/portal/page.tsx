'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Stats = {
  customers: number;
  subscriptions: { active: number; inactive: number; stopped: number };
  tickets: Record<string, number>;
  openTickets: number;
  slaAtRisk: number;
  slaBreached: number;
  completedToday: number;
  technicians: number;
};

function StatCard({
  label,
  value,
  tone = 'text-slate-900',
  href,
}: {
  label: string;
  value: number | string;
  tone?: string;
  href?: string;
}) {
  const card = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>('/dashboard').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!stats) return <p className="text-slate-500">Loading dashboard…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Master Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Live overview across customers, devices and service operations.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Customers" value={stats.customers} href="/portal/customers" />
        <StatCard
          label="Active subscriptions"
          value={stats.subscriptions.active}
          tone="text-emerald-600"
        />
        <StatCard
          label="Inactive / stopped"
          value={stats.subscriptions.inactive + stats.subscriptions.stopped}
          tone="text-slate-500"
        />
        <StatCard label="Technicians" value={stats.technicians} href="/portal/staff" />
        <StatCard label="Open tickets" value={stats.openTickets} href="/portal/tickets" />
        <StatCard
          label="SLA breached"
          value={stats.slaBreached}
          tone="text-rose-600"
          href="/portal/tickets"
        />
        <StatCard
          label="Due within 24h"
          value={stats.slaAtRisk}
          tone="text-amber-600"
          href="/portal/tickets"
        />
        <StatCard
          label="Completed today"
          value={stats.completedToday}
          tone="text-emerald-600"
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Ticket pipeline</h2>
      <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-9">
        {[
          'CREATED',
          'ASSIGNED',
          'ACCEPTED',
          'IN_TRANSIT',
          'IN_PROGRESS',
          'PENDING',
          'REJECTED',
          'COMPLETED',
          'CANCELLED',
        ].map((status) => (
          <Link
            key={status}
            href={`/portal/tickets?status=${status}`}
            className="rounded-lg border border-slate-200 bg-white p-3 text-center hover:shadow-sm"
          >
            <p className="text-xl font-bold">{stats.tickets[status] ?? 0}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {status.replace('_', ' ')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
