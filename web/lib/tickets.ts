// Mirrors backend/src/tickets/ticket-state-machine.ts — keep in sync.
export type TicketStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PENDING'
  | 'CANCELLED';

export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_TRANSIT', 'PENDING', 'CANCELLED'],
  REJECTED: ['ASSIGNED'],
  IN_TRANSIT: ['IN_PROGRESS', 'PENDING', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
  PENDING: ['ASSIGNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const REASON_REQUIRED: TicketStatus[] = ['REJECTED', 'CANCELLED'];

export const STATUS_BADGE: Record<TicketStatus, string> = {
  CREATED: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

const OPEN_STATUSES: TicketStatus[] = [
  'CREATED',
  'ASSIGNED',
  'ACCEPTED',
  'IN_TRANSIT',
  'IN_PROGRESS',
  'PENDING',
];

// FRD SLA color cues: red = breached, amber = due within 24h, green = on track.
export function slaTone(
  status: TicketStatus,
  slaDueAt: string | null,
): { label: string; className: string } {
  if (!OPEN_STATUSES.includes(status) || !slaDueAt) {
    return { label: '—', className: 'text-slate-400' };
  }
  const due = new Date(slaDueAt).getTime();
  const now = Date.now();
  if (due <= now) {
    return { label: 'SLA breached', className: 'bg-rose-600 text-white' };
  }
  if (due - now <= 24 * 3600 * 1000) {
    return { label: 'Due soon', className: 'bg-amber-500 text-white' };
  }
  return { label: 'On track', className: 'bg-emerald-600 text-white' };
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
