import "dotenv/config";

import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AppointmentStatus,
  AttendanceStatus,
  Gender,
  LoyaltyType,
  PaymentMethod,
  PaymentStatus,
  Plan,
  PrismaClient,
} from "../src/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const servicesData = [
  { name: "Haircut - Basic", category: "Hair", price: 250, duration: 30 },
  { name: "Haircut - Premium", category: "Hair", price: 500, duration: 45 },
  { name: "Hair Color - Global", category: "Hair", price: 1500, duration: 120 },
  { name: "Hair Color - Highlights", category: "Hair", price: 2000, duration: 150 },
  { name: "Hair Spa", category: "Hair", price: 800, duration: 60 },
  { name: "Keratin Treatment", category: "Hair", price: 3500, duration: 180 },
  { name: "Facial - Basic", category: "Skin", price: 600, duration: 60 },
  { name: "Facial - Gold", category: "Skin", price: 1200, duration: 75 },
  { name: "Facial - Diamond", category: "Skin", price: 2000, duration: 90 },
  { name: "Cleanup", category: "Skin", price: 400, duration: 30 },
  { name: "Bleach - Face", category: "Skin", price: 350, duration: 30 },
  { name: "Manicure - Basic", category: "Nail", price: 300, duration: 30 },
  { name: "Manicure - Gel", category: "Nail", price: 600, duration: 45 },
  { name: "Pedicure - Basic", category: "Nail", price: 400, duration: 45 },
  { name: "Pedicure - Spa", category: "Nail", price: 800, duration: 60 },
  { name: "Nail Art", category: "Nail", price: 500, duration: 60 },
  { name: "Bridal Makeup", category: "Makeup", price: 5000, duration: 120 },
  { name: "Party Makeup", category: "Makeup", price: 2000, duration: 90 },
  { name: "Body Massage", category: "Spa", price: 1500, duration: 60 },
  { name: "Head Massage", category: "Spa", price: 500, duration: 30 },
];

const femaleStaff = [
  { name: "Priya Sharma", designation: "Beautician" },
  { name: "Meena Devi", designation: "Hair Stylist" },
  { name: "Anjali Kumar", designation: "Nail Artist" },
  { name: "Divya Rao", designation: "Spa Therapist" },
  { name: "Kavitha Nair", designation: "Beautician" },
  { name: "Sunita Patel", designation: "Hair Stylist" },
  { name: "Rekha Menon", designation: "Makeup Artist" },
  { name: "Anitha Krishnan", designation: "Beautician" },
  { name: "Pooja Iyer", designation: "Nail Artist" },
  { name: "Lakshmi Pillai", designation: "Hair Stylist" },
  { name: "Saranya Murugan", designation: "Beautician" },
  { name: "Deepa Chandran", designation: "Spa Therapist" },
  { name: "Usha Ramesh", designation: "Makeup Artist" },
  { name: "Nithya Suresh", designation: "Hair Stylist" },
  { name: "Revathi Balaji", designation: "Beautician" },
];

const maleStaff = [
  { name: "Rajesh Kumar", designation: "Hair Stylist" },
  { name: "Suresh Babu", designation: "Beautician" },
  { name: "Karthik Raja", designation: "Spa Therapist" },
  { name: "Vijay Anand", designation: "Hair Stylist" },
  { name: "Arun Prasad", designation: "Beautician" },
];

const customerNames = [
  "Indu Menon", "Agni Priya", "Riya Shah", "Sona Patel", "Kavya Nair",
  "Anjali Singh", "Pooja Verma", "Neha Gupta", "Shreya Iyer", "Priya Kumar",
  "Divya Sharma", "Asha Pillai", "Meera Krishnan", "Nisha Rao", "Leela Devi",
  "Sunita Bose", "Rekha Jain", "Anita Roy", "Usha Menon", "Vani Suresh",
  "Kamala Nair", "Geetha Pillai", "Radha Krishnan", "Saroja Devi", "Malathi Rao",
  "Sudha Iyer", "Vasantha Menon", "Lalitha Kumar", "Meenakshi Pillai", "Padma Suresh",
  "Chitra Balaji", "Sumathi Raja", "Jaya Lakshmi", "Vijaya Priya", "Kalpana Rao",
  "Deepa Nair", "Shanthi Kumar", "Kokila Menon", "Mythili Iyer", "Bhavani Pillai",
  "Arthi Suresh", "Brindha Raja", "Dharani Kumar", "Ezhil Priya", "Famitha Rao",
  "Gayathri Nair", "Hema Menon", "Isai Priya", "Jothi Kumar", "Kalai Selvi",
  "Latha Pillai", "Manju Iyer", "Nandhini Rao", "Oviya Nair", "Pavithra Menon",
  "Ragini Kumar", "Sahana Pillai", "Tamilarasi Iyer", "Uma Rao", "Vanmathi Nair",
  "Deepika Raj", "Sindhu Menon", "Yamini Kumar", "Aarthi Pillai", "Bharathi Iyer",
  "Devi Rao", "Elakkiya Nair", "Fathima Menon", "Gomathi Kumar", "Harini Pillai",
  "Indira Iyer", "Janaki Rao", "Kanimozhi Nair", "Lavanya Menon", "Madhavi Kumar",
  "Nandha Pillai", "Oviya Iyer", "Pavai Rao", "Rani Nair", "Shobha Menon",
  "Tara Kumar", "Uma Pillai", "Valli Iyer", "Warsha Rao", "Yamuna Nair",
  "Abarna Menon", "Banu Kumar", "Chellam Pillai", "Dhivya Iyer", "Elamathi Rao",
  "Femi Nair", "Girija Menon", "Hamsaveni Kumar", "Ilakiya Pillai", "Janani Iyer",
  "Kamakshi Rao", "Lakshana Nair", "Mahalakshmi Menon", "Nirmala Kumar", "Parvathi Pillai",
];

function randomPastDate(maxDaysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
  d.setHours(Math.floor(Math.random() * 10) + 9, Math.floor(Math.random() * 2) * 30, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding database with comprehensive salon data...");

  await prisma.loyaltyTransaction.deleteMany();
  await prisma.loyaltyCard.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.salonSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      name: "Glamour Studio",
      slug: "glamour-studio",
      address: "45 Anna Salai, Nungambakkam",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600034",
      phone: "9876543210",
      email: "info@glamourstudio.in",
      gstNumber: "33ABCDE1234F1Z5",
      openTime: "09:00",
      closeTime: "20:00",
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      plan: Plan.FREE,
      isActive: true,
    },
  });

  const hashedPassword = await hash("demo123", 10);
  await prisma.user.create({
    data: {
      name: "Demo Owner",
      email: "demo@sczor.com",
      mobile: "9876543210",
      password: hashedPassword,
      role: "OWNER",
      tenantId: tenant.id,
      isActive: true,
    },
  });

  await prisma.salonSettings.create({
    data: {
      tenantId: tenant.id,
      loyaltyPointsPerRupee: 0.1,
      rupeePerPoint: 1,
      gstRate: 18,
      currency: "INR",
      invoicePrefix: "INV",
      smsEnabled: false,
      whatsappEnabled: false,
    },
  });

  const services = await Promise.all(
    servicesData.map((service) =>
      prisma.service.create({
        data: {
          ...service,
          status: "ACTIVE",
          tenantId: tenant.id,
        },
      }),
    ),
  );

  const allStaffData = [...femaleStaff, ...maleStaff];
  const staffMobiles = Array.from({ length: 20 }, (_, i) => `987654${String(i + 1).padStart(4, "0")}`);

  const staffList = await Promise.all(
    allStaffData.map((staff, i) =>
      prisma.staff.create({
        data: {
          ...staff,
          mobile: staffMobiles[i],
          status: "ACTIVE",
          availabilityStatus: "AVAILABLE",
          workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          tenantId: tenant.id,
        },
      }),
    ),
  );

  const customers = await Promise.all(
    customerNames.map((name, i) =>
      prisma.customer.create({
        data: {
          name,
          mobile: `98765${String(i + 1).padStart(5, "0")}`,
          email: `${name.toLowerCase().replace(/ /g, ".")}@gmail.com`,
          gender: Gender.FEMALE,
          tenantId: tenant.id,
          createdAt: randomPastDate(90),
        },
      }),
    ),
  );

  const loyaltyCards = await Promise.all(
    customers.map((customer) =>
      prisma.loyaltyCard.create({
        data: {
          customerId: customer.id,
          tenantId: tenant.id,
          totalPoints: 0,
          pointsRedeemed: 0,
          totalSpent: 0,
          tier: "BRONZE",
        },
      }),
    ),
  );

  const loyaltyCardByCustomerId = new Map(loyaltyCards.map((card) => [card.customerId, card]));
  const loyaltyCustomerIds = new Set(customers.slice(0, 50).map((customer) => customer.id));

  const appointmentStatuses: AppointmentStatus[] = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.BILLED,
    AppointmentStatus.BOOKED,
    AppointmentStatus.CANCELLED,
  ];

  const timeSlots = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
  ];

  const appointments = [];
  for (let i = 0; i < 200; i += 1) {
    const customer = customers[i % customers.length];
    const staff = staffList[i % staffList.length];
    const service = services[i % services.length];
    const status = appointmentStatuses[i % appointmentStatuses.length];
    const appointmentDate = randomPastDate(90);

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `SCZO-2026-${String(i + 1).padStart(4, "0")}`,
        appointmentDate,
        appointmentTime: timeSlots[i % timeSlots.length],
        duration: service.duration,
        status,
        customerId: customer.id,
        serviceId: service.id,
        staffId: staff.id,
        tenantId: tenant.id,
        createdAt: appointmentDate,
      },
    });

    appointments.push(appointment);
  }

  const paymentMethods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.CARD];
  const paidStatus: PaymentStatus = PaymentStatus.PAID;

  for (let i = 0; i < 200; i += 1) {
    const customer = customers[i % customers.length];
    const service = services[i % services.length];
    const invoiceDate = randomPastDate(90);

    const subtotal = Number(service.price);
    const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const discount = i % 5 === 0 ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal + taxAmount - discount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        invoiceDate,
        subtotal,
        taxRate: 18,
        taxAmount,
        discount,
        total,
        paymentMethod: paymentMethods[i % paymentMethods.length],
        paymentStatus: paidStatus,
        customerId: customer.id,
        tenantId: tenant.id,
        createdAt: invoiceDate,
        items: {
          create: [
            {
              name: service.name,
              price: subtotal,
              quantity: 1,
              amount: subtotal,
              serviceId: service.id,
            },
          ],
        },
      },
    });

    if (loyaltyCustomerIds.has(customer.id)) {
      const loyaltyCard = loyaltyCardByCustomerId.get(customer.id);
      if (loyaltyCard) {
        const pointsEarned = Math.floor(total / 10);

        await prisma.loyaltyTransaction.create({
          data: {
            points: pointsEarned,
            type: LoyaltyType.EARNED,
            description: `Points for invoice ${invoice.invoiceNumber}`,
            invoiceId: invoice.id,
            loyaltyCardId: loyaltyCard.id,
            createdAt: invoiceDate,
          },
        });

        await prisma.loyaltyCard.update({
          where: { id: loyaltyCard.id },
          data: {
            totalPoints: { increment: pointsEarned },
            totalSpent: { increment: total },
          },
        });
      }
    }
  }

  const allCards = await prisma.loyaltyCard.findMany({ where: { tenantId: tenant.id } });
  for (const card of allCards) {
    let tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" = "BRONZE";
    if (card.totalPoints >= 5000) tier = "PLATINUM";
    else if (card.totalPoints >= 2000) tier = "GOLD";
    else if (card.totalPoints >= 500) tier = "SILVER";

    await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { tier },
    });
  }

  for (let i = 0; i < 50; i += 1) {
    const customer = customers[i];
    const loyaltyCard = loyaltyCardByCustomerId.get(customer.id);
    if (!loyaltyCard) {
      continue;
    }

    const pointsToRedeem = Math.min(100, Math.floor(Math.random() * 200 + 50));
    const redeemDate = randomPastDate(30);

    await prisma.loyaltyTransaction.create({
      data: {
        points: -pointsToRedeem,
        type: LoyaltyType.REDEEMED,
        description: "Points redeemed at POS",
        loyaltyCardId: loyaltyCard.id,
        createdAt: redeemDate,
      },
    });

    await prisma.loyaltyCard.update({
      where: { id: loyaltyCard.id },
      data: {
        totalPoints: { decrement: pointsToRedeem },
        pointsRedeemed: { increment: pointsToRedeem },
      },
    });
  }

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  for (const date of last30Days) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    if (dayName === "Sun") {
      continue;
    }

    for (const staff of staffList) {
      const random = Math.random();
      const status: AttendanceStatus =
        random > 0.85
          ? AttendanceStatus.ABSENT
          : random > 0.75
            ? AttendanceStatus.LEAVE
            : AttendanceStatus.PRESENT;

      await prisma.attendance.create({
        data: {
          date,
          status,
          staffId: staff.id,
          tenantId: tenant.id,
          createdAt: date,
        },
      }).catch(() => {
        return null;
      });
    }
  }

  console.log("Seed completed.");
  console.log("Data created:");
  console.log("- 1 tenant (Glamour Studio)");
  console.log("- 1 owner (demo@sczor.com / demo123)");
  console.log("- 20 services");
  console.log("- 20 staff (15 female + 5 male names)");
  console.log("- 100 customers");
  console.log("- 200 appointments");
  console.log("- 200 invoices with items");
  console.log("- 200 PAID POS billing transactions (via invoices)");
  console.log("- Loyalty transactions for 50 customers");
  console.log("- Attendance for last 30 days");
  console.log("- All records linked to tenant glamour-studio");

  void appointments;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
