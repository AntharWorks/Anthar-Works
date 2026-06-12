import { TicketStatus } from '@prisma/client';
import { canTransition, requiresReason } from './ticket-state-machine';

describe('ticket state machine', () => {
  it('follows the happy path through completion', () => {
    const path: TicketStatus[] = [
      TicketStatus.CREATED,
      TicketStatus.ASSIGNED,
      TicketStatus.ACCEPTED,
      TicketStatus.IN_TRANSIT,
      TicketStatus.IN_PROGRESS,
      TicketStatus.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('lets a rejected ticket be re-assigned', () => {
    expect(canTransition(TicketStatus.ASSIGNED, TicketStatus.REJECTED)).toBe(true);
    expect(canTransition(TicketStatus.REJECTED, TicketStatus.ASSIGNED)).toBe(true);
  });

  it('lets a pending (postponed) ticket resume via re-assignment', () => {
    expect(canTransition(TicketStatus.IN_PROGRESS, TicketStatus.PENDING)).toBe(true);
    expect(canTransition(TicketStatus.PENDING, TicketStatus.ASSIGNED)).toBe(true);
  });

  it('blocks skipping steps and reopening terminal states', () => {
    expect(canTransition(TicketStatus.CREATED, TicketStatus.IN_PROGRESS)).toBe(false);
    expect(canTransition(TicketStatus.ASSIGNED, TicketStatus.COMPLETED)).toBe(false);
    expect(canTransition(TicketStatus.COMPLETED, TicketStatus.ASSIGNED)).toBe(false);
    expect(canTransition(TicketStatus.CANCELLED, TicketStatus.ASSIGNED)).toBe(false);
  });

  it('requires a reason for rejection and cancellation only', () => {
    expect(requiresReason(TicketStatus.REJECTED)).toBe(true);
    expect(requiresReason(TicketStatus.CANCELLED)).toBe(true);
    expect(requiresReason(TicketStatus.COMPLETED)).toBe(false);
  });
});
