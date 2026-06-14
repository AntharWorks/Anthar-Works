'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import {
  formatDateTime,
  REASON_REQUIRED,
  slaTone,
  STATUS_BADGE,
  TicketStatus,
  TRANSITIONS,
} from '@/lib/tickets';

type Technician = {
  id: string;
  name: string;
  phone: string;
  openJobs?: number;
  matchesPincode?: boolean;
};

type Media = {
  id: string;
  phase: 'BEFORE' | 'AFTER';
  latitude: number;
  longitude: number;
  capturedAt: string;
};

type TicketDetail = {
  id: string;
  ticketNo: string;
  type: string;
  status: TicketStatus;
  priority: number;
  slaDueAt: string | null;
  slotDate: string | null;
  slotWindow: string | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    customerNo: string;
    address: string | null;
    pincode: string | null;
    user: { name: string; phone: string };
  };
  assignedTechnician: { id: string; name: string } | null;
  createdBy: { name: string };
  media: Media[];
  spareUsage: { id: string; qty: number; part: { name: string; sku: string } }[];
  events: {
    id: string;
    fromStatus: TicketStatus | null;
    toStatus: TicketStatus | null;
    remarks: string | null;
    createdAt: string;
    actor: { name: string };
  }[];
};

// Job photos require the bearer token, so they're fetched as blobs.
function AuthImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetch(src, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (!url) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
        photo
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-28 w-28 rounded-lg object-cover" />;
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ technicianId: '', slotDate: '', slotWindow: '' });
  const [postponeForm, setPostponeForm] = useState({ slotDate: '', slotWindow: '', remarks: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api<TicketDetail>(`/tickets/${id}`).then(setTicket),
    [id],
  );

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // Pincode-matched + least-loaded technicians first (FRD 1.3).
    api<Technician[]>(`/tickets/${id}/suggest-technicians`)
      .then(setTechnicians)
      .catch(() =>
        api<Technician[]>('/users?role=TECHNICIAN').then(setTechnicians).catch(() => {}),
      );
  }, [load, id]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function transition(to: TicketStatus) {
    let reason: string | undefined;
    if (REASON_REQUIRED.includes(to)) {
      reason = window.prompt(`Reason for marking ${to} (mandatory):`) ?? undefined;
      if (!reason) return;
    }
    void run(() =>
      api(`/tickets/${id}/status`, { method: 'PATCH', body: { to, reason } }),
    );
  }

  function assign(e: FormEvent) {
    e.preventDefault();
    void run(() =>
      api(`/tickets/${id}/assign`, {
        method: 'PATCH',
        body: {
          technicianId: assignForm.technicianId,
          slotDate: assignForm.slotDate ? new Date(assignForm.slotDate).toISOString() : undefined,
          slotWindow: assignForm.slotWindow || undefined,
        },
      }),
    );
  }

  function postpone(e: FormEvent) {
    e.preventDefault();
    void run(() =>
      api(`/tickets/${id}/slot`, {
        method: 'PATCH',
        body: {
          slotDate: new Date(postponeForm.slotDate).toISOString(),
          slotWindow: postponeForm.slotWindow || undefined,
          remarks: postponeForm.remarks || undefined,
        },
      }),
    );
  }

  if (error && !ticket) return <p className="text-rose-600">{error}</p>;
  if (!ticket) return <p className="text-slate-500">Loading…</p>;

  const sla = slaTone(ticket.status, ticket.slaDueAt);
  const nextStatuses = TRANSITIONS[ticket.status].filter((s) => s !== 'ASSIGNED');
  const canAssign = TRANSITIONS[ticket.status].includes('ASSIGNED');

  return (
    <div>
      <Link href="/portal/tickets" className="text-sm text-brand-700 hover:text-brand-800">
        ← All tickets
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="page-title font-mono">{ticket.ticketNo}</h1>
        <span className={`badge ${STATUS_BADGE[ticket.status]}`}>
          {ticket.status.replace('_', ' ')}
        </span>
        <span className={`badge ${sla.className}`}>
          {sla.label}
        </span>
      </div>
      <p className="page-subtitle">
        {ticket.type} · created {formatDateTime(ticket.createdAt)} by {ticket.createdBy.name} · SLA{' '}
        {formatDateTime(ticket.slaDueAt)}
      </p>
      {(ticket.cancellationReason || ticket.rejectionReason) && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Reason: {ticket.cancellationReason ?? ticket.rejectionReason}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Customer</h2>
          <p className="mt-2 text-sm">
            <Link href={`/portal/customers/${ticket.customer.id}`} className="font-medium text-brand-700 hover:text-brand-800">
              {ticket.customer.user.name}
            </Link>{' '}
            <span className="font-mono text-slate-400">{ticket.customer.customerNo}</span>
          </p>
          <p className="text-sm text-slate-500">
            <a href={`tel:${ticket.customer.user.phone}`} className="text-brand-700 hover:text-brand-800">
              {ticket.customer.user.phone}
            </a>{' '}
            · {ticket.customer.address ?? '—'} · {ticket.customer.pincode ?? ''}
          </p>

          <h2 className="mt-5 font-semibold">Technician & slot</h2>
          <p className="mt-2 text-sm">
            {ticket.assignedTechnician?.name ?? <span className="text-slate-400">Unassigned</span>}
            {ticket.slotDate && (
              <span className="block text-slate-500">
                Slot: {formatDateTime(ticket.slotDate)} {ticket.slotWindow ?? ''}
              </span>
            )}
          </p>

          {canAssign && (
            <form onSubmit={assign} className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{ticket.assignedTechnician ? 'Re-assign' : 'Assign'} technician</p>
              <select
                value={assignForm.technicianId}
                onChange={(e) => setAssignForm({ ...assignForm, technicianId: e.target.value })}
                className="input"
                required
              >
                <option value="">Select technician…</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.matchesPincode ? '★ ' : ''}
                    {t.name} ({t.phone})
                    {t.openJobs !== undefined ? ` — ${t.openJobs} open` : ''}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={assignForm.slotDate}
                  onChange={(e) => setAssignForm({ ...assignForm, slotDate: e.target.value })}
                  className="input flex-1"
                />
                <input
                  placeholder="Window e.g. 10:00–12:00"
                  value={assignForm.slotWindow}
                  onChange={(e) => setAssignForm({ ...assignForm, slotWindow: e.target.value })}
                  className="input flex-1"
                />
              </div>
              <button
                disabled={busy}
                className="btn btn-primary btn-sm"
              >
                Assign
              </button>
            </form>
          )}

          {ticket.slotDate && !['COMPLETED', 'CANCELLED'].includes(ticket.status) && (
            <form onSubmit={postpone} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">Postpone slot</p>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={postponeForm.slotDate}
                  onChange={(e) => setPostponeForm({ ...postponeForm, slotDate: e.target.value })}
                  className="input flex-1"
                  required
                />
                <input
                  placeholder="Window"
                  value={postponeForm.slotWindow}
                  onChange={(e) => setPostponeForm({ ...postponeForm, slotWindow: e.target.value })}
                  className="input flex-1"
                />
              </div>
              <input
                placeholder="Remarks (e.g. customer requested)"
                value={postponeForm.remarks}
                onChange={(e) => setPostponeForm({ ...postponeForm, remarks: e.target.value })}
                className="input"
              />
              <button
                disabled={busy}
                className="btn btn-sm bg-amber-600 text-white shadow-sm hover:bg-amber-700 focus-visible:ring-amber-400"
              >
                Postpone
              </button>
            </form>
          )}

          {nextStatuses.length > 0 && (
            <>
              <h2 className="mt-5 font-semibold">Update status</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => transition(s)}
                    className={`btn btn-sm ${
                      s === 'CANCELLED' || s === 'REJECTED'
                        ? 'btn-danger'
                        : s === 'COMPLETED'
                          ? 'btn-accent'
                          : 'btn-primary'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Job photos (geotagged)</h2>
          {ticket.media.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">
              No photos uploaded yet — the technician captures live before/after
              photos in the app.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-4">
            {(['BEFORE', 'AFTER'] as const).map((phase) => (
              <div key={phase}>
                <p className="text-xs font-semibold text-slate-500">{phase}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ticket.media
                    .filter((m) => m.phase === phase)
                    .map((m) => (
                      <div key={m.id} className="text-xs">
                        <AuthImage
                          src={`/api/v1/tickets/${ticket.id}/media/${m.id}/file`}
                          alt={`${phase} photo`}
                        />
                        <a
                          href={`https://maps.google.com/?q=${m.latitude},${m.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-brand-700 hover:text-brand-800"
                        >
                          📍 {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                        </a>
                        <span className="text-slate-400">
                          {formatDateTime(m.capturedAt)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {ticket.spareUsage.length > 0 && (
            <>
              <h2 className="mt-5 font-semibold">Spare parts used</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {ticket.spareUsage.map((u) => (
                  <li key={u.id}>
                    {u.part.name} <span className="text-slate-400">({u.part.sku})</span> × {u.qty}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-5 font-semibold">Timeline</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {ticket.events.map((ev) => (
              <li key={ev.id} className="border-l-2 border-slate-200 pl-3">
                <p>
                  {ev.toStatus ? (
                    <>
                      {ev.fromStatus && (
                        <span className="text-slate-400">{ev.fromStatus.replace('_', ' ')} → </span>
                      )}
                      <span className="font-medium">{ev.toStatus.replace('_', ' ')}</span>
                    </>
                  ) : (
                    <span className="font-medium">Update</span>
                  )}
                </p>
                {ev.remarks && <p className="text-slate-600">{ev.remarks}</p>}
                <p className="text-xs text-slate-400">
                  {ev.actor.name} · {formatDateTime(ev.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
