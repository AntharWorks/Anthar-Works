import { TicketStatus } from '@prisma/client';

/**
 * FRD ticket lifecycle, enforced server-side for every persona:
 * CREATED → ASSIGNED → ACCEPTED/REJECTED → IN_TRANSIT → IN_PROGRESS
 *         → COMPLETED | PENDING | CANCELLED
 * REJECTED returns the ticket to the backend pool for re-assignment.
 * PENDING (e.g. customer postponed) can resume from ASSIGNED.
 */
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  CREATED: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
  ASSIGNED: [
    TicketStatus.ACCEPTED,
    TicketStatus.REJECTED,
    TicketStatus.CANCELLED,
  ],
  ACCEPTED: [
    TicketStatus.IN_TRANSIT,
    TicketStatus.PENDING,
    TicketStatus.CANCELLED,
  ],
  REJECTED: [TicketStatus.ASSIGNED],
  IN_TRANSIT: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.PENDING,
    TicketStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    TicketStatus.COMPLETED,
    TicketStatus.PENDING,
    TicketStatus.CANCELLED,
  ],
  PENDING: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// Transitions that must carry a reason/justification per the FRD.
const REASON_REQUIRED = new Set<TicketStatus>([
  TicketStatus.REJECTED,
  TicketStatus.CANCELLED,
]);

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresReason(to: TicketStatus): boolean {
  return REASON_REQUIRED.has(to);
}
