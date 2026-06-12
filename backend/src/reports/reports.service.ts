import { Injectable } from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';
import { Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.CREATED,
  TicketStatus.ASSIGNED,
  TicketStatus.ACCEPTED,
  TicketStatus.IN_TRANSIT,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
];

function styleHeader(sheet: Worksheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = Math.max(14, String(col.header ?? '').length + 4);
  });
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // FRD 1.3: complete pending dump with customer contact numbers.
  async pendingTicketsWorkbook(): Promise<Workbook> {
    const tickets = await this.prisma.ticket.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: {
        customer: { include: { user: true } },
        assignedTechnician: true,
      },
      orderBy: [{ slaDueAt: { sort: 'asc', nulls: 'last' } }],
    });

    const wb = new Workbook();
    const sheet = wb.addWorksheet('Pending Tickets');
    sheet.columns = [
      { header: 'Ticket No', key: 'ticketNo' },
      { header: 'Type', key: 'type' },
      { header: 'Status', key: 'status' },
      { header: 'Customer ID', key: 'customerNo' },
      { header: 'Customer Name', key: 'name' },
      { header: 'Contact Number', key: 'phone' },
      { header: 'Pincode', key: 'pincode' },
      { header: 'Technician', key: 'technician' },
      { header: 'Slot Date', key: 'slotDate' },
      { header: 'Slot Window', key: 'slotWindow' },
      { header: 'SLA Due', key: 'slaDueAt' },
      { header: 'Created At', key: 'createdAt' },
    ];
    for (const t of tickets) {
      sheet.addRow({
        ticketNo: t.ticketNo,
        type: t.type,
        status: t.status,
        customerNo: t.customer.customerNo,
        name: t.customer.user.name,
        phone: t.customer.user.phone,
        pincode: t.customer.pincode ?? '',
        technician: t.assignedTechnician?.name ?? 'Unassigned',
        slotDate: t.slotDate ?? '',
        slotWindow: t.slotWindow ?? '',
        slaDueAt: t.slaDueAt ?? '',
        createdAt: t.createdAt,
      });
    }
    styleHeader(sheet);
    return wb;
  }

  // FRD 1.2: closures, sales, technician-wise & backend-wise in one workbook.
  async operationsWorkbook(from?: Date, to?: Date): Promise<Workbook> {
    const range =
      from || to
        ? { gte: from, ...(to ? { lte: to } : {}) }
        : undefined;

    const [closures, orders, technicians, backendStaff] =
      await this.prisma.$transaction([
        this.prisma.ticket.findMany({
          where: {
            status: TicketStatus.COMPLETED,
            ...(range ? { updatedAt: range } : {}),
          },
          include: {
            customer: { include: { user: true } },
            assignedTechnician: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.order.findMany({
          where: range ? { createdAt: range } : undefined,
          include: { customer: { include: { user: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.findMany({ where: { role: Role.TECHNICIAN } }),
        this.prisma.user.findMany({
          where: { role: { in: [Role.BACKEND, Role.ADMIN] } },
        }),
      ]);

    const wb = new Workbook();

    const closuresSheet = wb.addWorksheet('Closures');
    closuresSheet.columns = [
      { header: 'Ticket No', key: 'ticketNo' },
      { header: 'Type', key: 'type' },
      { header: 'Customer ID', key: 'customerNo' },
      { header: 'Customer Name', key: 'name' },
      { header: 'Contact Number', key: 'phone' },
      { header: 'Technician', key: 'technician' },
      { header: 'Completed At', key: 'completedAt' },
    ];
    for (const t of closures) {
      closuresSheet.addRow({
        ticketNo: t.ticketNo,
        type: t.type,
        customerNo: t.customer.customerNo,
        name: t.customer.user.name,
        phone: t.customer.user.phone,
        technician: t.assignedTechnician?.name ?? '',
        completedAt: t.updatedAt,
      });
    }
    styleHeader(closuresSheet);

    const salesSheet = wb.addWorksheet('Sales');
    salesSheet.columns = [
      { header: 'Order No', key: 'orderNo' },
      { header: 'Type', key: 'type' },
      { header: 'Customer ID', key: 'customerNo' },
      { header: 'Customer Name', key: 'name' },
      { header: 'Contact Number', key: 'phone' },
      { header: 'Amount (INR)', key: 'amount' },
      { header: 'Status', key: 'status' },
      { header: 'Date', key: 'createdAt' },
    ];
    for (const o of orders) {
      salesSheet.addRow({
        orderNo: o.orderNo,
        type: o.type,
        customerNo: o.customer.customerNo,
        name: o.customer.user.name,
        phone: o.customer.user.phone,
        amount: Number(o.amountInr),
        status: o.status,
        createdAt: o.createdAt,
      });
    }
    styleHeader(salesSheet);

    const techSheet = wb.addWorksheet('Technician-wise');
    techSheet.columns = [
      { header: 'Technician', key: 'name' },
      { header: 'Mobile', key: 'phone' },
      { header: 'Open Tickets', key: 'open' },
      { header: 'Completed', key: 'completed' },
      { header: 'Rejected', key: 'rejected' },
    ];
    for (const tech of technicians) {
      const [open, completed, rejected] = await Promise.all([
        this.prisma.ticket.count({
          where: {
            assignedTechnicianId: tech.id,
            status: { in: OPEN_STATUSES },
          },
        }),
        this.prisma.ticket.count({
          where: {
            assignedTechnicianId: tech.id,
            status: TicketStatus.COMPLETED,
            ...(range ? { updatedAt: range } : {}),
          },
        }),
        this.prisma.ticket.count({
          where: { assignedTechnicianId: tech.id, status: TicketStatus.REJECTED },
        }),
      ]);
      techSheet.addRow({
        name: tech.name,
        phone: tech.phone,
        open,
        completed,
        rejected,
      });
    }
    styleHeader(techSheet);

    const backendSheet = wb.addWorksheet('Backend-wise');
    backendSheet.columns = [
      { header: 'Staff', key: 'name' },
      { header: 'Role', key: 'role' },
      { header: 'Tickets Created', key: 'created' },
      { header: 'Of Which Completed', key: 'completed' },
    ];
    for (const staff of backendStaff) {
      const [created, completed] = await Promise.all([
        this.prisma.ticket.count({
          where: {
            createdById: staff.id,
            ...(range ? { createdAt: range } : {}),
          },
        }),
        this.prisma.ticket.count({
          where: {
            createdById: staff.id,
            status: TicketStatus.COMPLETED,
            ...(range ? { createdAt: range } : {}),
          },
        }),
      ]);
      backendSheet.addRow({
        name: staff.name,
        role: staff.role,
        created,
        completed,
      });
    }
    styleHeader(backendSheet);

    return wb;
  }
}
