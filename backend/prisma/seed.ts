import {
  BillingPeriod,
  PrismaClient,
  Role,
  TicketStatus,
  TicketType,
  WarrantyType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: { phone: '9000000001', name: 'Admin', role: Role.ADMIN },
  });
  const backend = await prisma.user.upsert({
    where: { phone: '9000000002' },
    update: {},
    create: { phone: '9000000002', name: 'Backend Staff', role: Role.BACKEND },
  });
  const tech1 = await prisma.user.upsert({
    where: { phone: '9000000003' },
    update: {},
    create: { phone: '9000000003', name: 'Ravi (Technician)', role: Role.TECHNICIAN },
  });
  const tech2 = await prisma.user.upsert({
    where: { phone: '9000000004' },
    update: {},
    create: { phone: '9000000004', name: 'Kumar (Technician)', role: Role.TECHNICIAN },
  });
  await prisma.user.upsert({
    where: { phone: '9000000005' },
    update: {},
    create: { phone: '9000000005', name: 'Priya (Sales)', role: Role.SALES },
  });

  const products = await Promise.all(
    [
      { brand: 'AquaPure', model: 'AP-100', variant: 'RO+UV', priceInr: 12999 },
      { brand: 'AquaPure', model: 'AP-200', variant: 'RO+UV+UF', priceInr: 16999 },
      { brand: 'HydroMax', model: 'HM-Elite', variant: 'RO+Alkaline', priceInr: 18499 },
      { brand: 'PureFlow', model: 'PF-Compact', variant: 'UV', priceInr: 8999 },
    ].map((p) =>
      prisma.product.upsert({
        where: { id: `${p.brand}-${p.model}` },
        update: {},
        create: { id: `${p.brand}-${p.model}`, ...p, images: [] },
      }),
    ),
  );

  const plans = await Promise.all(
    [
      { name: 'Basic Monthly', priceInr: 399, billingPeriod: BillingPeriod.MONTHLY },
      { name: 'Family Quarterly', priceInr: 1099, billingPeriod: BillingPeriod.QUARTERLY },
      { name: 'Annual Saver', priceInr: 3999, billingPeriod: BillingPeriod.YEARLY },
    ].map((p, i) =>
      prisma.plan.upsert({
        where: { id: `seed-plan-${i + 1}` },
        update: {},
        create: { id: `seed-plan-${i + 1}`, ...p, createdById: admin.id },
      }),
    ),
  );

  const customerSeeds = [
    { phone: '9100000001', name: 'Anita Sharma', pincode: '600001', city: 'Chennai' },
    { phone: '9100000002', name: 'Vikram Rao', pincode: '600042', city: 'Chennai' },
    { phone: '9100000003', name: 'Deepa Iyer', pincode: '600042', city: 'Chennai' },
  ];
  const customers = [];
  for (let i = 0; i < customerSeeds.length; i++) {
    const c = customerSeeds[i];
    const customer = await prisma.customer.upsert({
      where: { customerNo: `AW-${String(i + 1).padStart(6, '0')}` },
      update: {},
      create: {
        customerNo: `AW-${String(i + 1).padStart(6, '0')}`,
        pincode: c.pincode,
        city: c.city,
        address: `${c.city} ${c.pincode}`,
        user: { create: { phone: c.phone, name: c.name, role: Role.CUSTOMER } },
      },
    });
    customers.push(customer);
  }

  const existingSubs = await prisma.subscription.count();
  if (existingSubs === 0) {
    const now = new Date();
    const yearAhead = new Date(now);
    yearAhead.setFullYear(now.getFullYear() + 1);

    for (const [i, customer] of customers.entries()) {
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          planId: plans[i % plans.length].id,
          startDate: now,
          nextRenewalAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
        },
      });
      await prisma.customerDevice.create({
        data: {
          customerId: customer.id,
          productId: products[i % products.length].id,
          purchaseDate: now,
          warrantyType: i % 2 ? WarrantyType.COMMERCIAL : WarrantyType.RESIDENTIAL,
          warrantyExpiry: yearAhead,
        },
      });
    }

    const t1 = await prisma.ticket.create({
      data: {
        ticketNo: 'TKT-000001',
        customerId: customers[0].id,
        type: TicketType.SERVICE,
        createdById: backend.id,
        slaDueAt: new Date(now.getTime() + 6 * 3600 * 1000),
      },
    });
    await prisma.ticketEvent.create({
      data: { ticketId: t1.id, toStatus: TicketStatus.CREATED, actorId: backend.id },
    });

    const t2 = await prisma.ticket.create({
      data: {
        ticketNo: 'TKT-000002',
        customerId: customers[1].id,
        type: TicketType.INSTALLATION,
        status: TicketStatus.ASSIGNED,
        assignedTechnicianId: tech1.id,
        createdById: backend.id,
        slaDueAt: new Date(now.getTime() + 30 * 3600 * 1000),
        slotDate: new Date(now.getTime() + 24 * 3600 * 1000),
        slotWindow: '10:00–12:00',
      },
    });
    await prisma.ticketEvent.createMany({
      data: [
        { ticketId: t2.id, toStatus: TicketStatus.CREATED, actorId: backend.id },
        {
          ticketId: t2.id,
          fromStatus: TicketStatus.CREATED,
          toStatus: TicketStatus.ASSIGNED,
          actorId: backend.id,
          remarks: 'Assigned to technician',
        },
      ],
    });

    const t3 = await prisma.ticket.create({
      data: {
        ticketNo: 'TKT-000003',
        customerId: customers[2].id,
        type: TicketType.COMPLAINT,
        createdById: backend.id,
        // Already past SLA so the dashboard/red badge has something to show.
        slaDueAt: new Date(now.getTime() - 2 * 3600 * 1000),
      },
    });
    await prisma.ticketEvent.create({
      data: { ticketId: t3.id, toStatus: TicketStatus.CREATED, actorId: backend.id },
    });
  }

  await prisma.backendTechnician.upsert({
    where: { backendId_technicianId: { backendId: backend.id, technicianId: tech1.id } },
    update: {},
    create: { backendId: backend.id, technicianId: tech1.id },
  });
  await prisma.backendTechnician.upsert({
    where: { backendId_technicianId: { backendId: backend.id, technicianId: tech2.id } },
    update: {},
    create: { backendId: backend.id, technicianId: tech2.id },
  });

  await Promise.all(
    [
      { sku: 'FLT-SED-01', name: 'Sediment Filter', stock: 120 },
      { sku: 'FLT-CRB-01', name: 'Carbon Filter', stock: 95 },
      { sku: 'MEM-RO-75', name: 'RO Membrane 75 GPD', stock: 40 },
      { sku: 'LMP-UV-11', name: 'UV Lamp 11W', stock: 30 },
      { sku: 'PMP-BST-24', name: 'Booster Pump 24V', stock: 12 },
      { sku: 'PIP-14-WHT', name: '1/4" Tubing (metre)', stock: 500 },
    ].map((p) =>
      prisma.sparePart.upsert({
        where: { sku: p.sku },
        update: { stock: p.stock },
        create: p,
      }),
    ),
  );

  console.log('Seed complete. Logins (OTP shown in dev responses):');
  console.log('  Admin    9000000001 | Backend 9000000002');
  console.log('  Tech     9000000003 / 9000000004 | Sales 9000000005');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
