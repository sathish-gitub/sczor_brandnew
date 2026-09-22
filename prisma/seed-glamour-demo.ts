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
import { calculateGSTBreakdown } from "../src/lib/gst";
import { calculatePayroll, PayrollCalculationError } from "../src/lib/payrollCalculation";
import { calculateLoyaltyTier } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const TENANT_SLUG = "glamour-salon-demo";
const OWNER_EMAIL = "glam@glamoursalon.com";
const OWNER_PASSWORD = "12344321";

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedChoice<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function padNum(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const INDIAN_FIRST_NAMES_F = [
  "Aarti", "Bhavna", "Chitra", "Divya", "Esha", "Farah", "Gauri", "Harini", "Isha", "Jyoti",
  "Kavita", "Lakshmi", "Meera", "Neha", "Ojas", "Pooja", "Radha", "Sana", "Tara", "Uma",
  "Vidya", "Yamini", "Zoya", "Anjali", "Bindu", "Chandni", "Deepa", "Ekta", "Falguni", "Geeta",
  "Hina", "Indira", "Jaya", "Kiran", "Leela", "Manisha", "Nandita", "Om", "Priya", "Ritu",
  "Sonal", "Trisha", "Usha", "Varsha", "Wamika", "Yashika", "Aaradhya", "Bhavya", "Charu", "Devika",
  "Ela", "Fiza", "Gunjan", "Heena", "Ishita", "Jhanvi", "Kajal", "Lavanya", "Mansi", "Naina",
];

const INDIAN_FIRST_NAMES_M = [
  "Arjun", "Bharat", "Chetan", "Deepak", "Eshan", "Farhan", "Girish", "Harsh", "Imran", "Jatin",
  "Karan", "Lokesh", "Manoj", "Naveen", "Om", "Pranav", "Qasim", "Rahul", "Sameer", "Tarun",
  "Umesh", "Vikram", "Waseem", "Yash", "Zaid", "Abhishek", "Bala", "Chirag", "Dinesh", "Eshwar",
  "Faisal", "Gaurav", "Hitesh", "Ishaan", "Jayesh", "Kunal", "Lalit", "Mahesh", "Nikhil", "Omkar",
];

const INDIAN_LAST_NAMES = [
  "Sharma", "Verma", "Reddy", "Iyer", "Nair", "Menon", "Rao", "Gupta", "Mehta", "Kapoor",
  "Joshi", "Desai", "Pillai", "Krishnan", "Rathore", "Chauhan", "Bose", "Banerjee", "Kulkarni", "Patil",
  "Agarwal", "Malhotra", "Chopra", "Bhatt", "Trivedi", "Shetty", "Naidu", "Pandey", "Mishra", "Saxena",
];

function randomCustomerName(): { name: string; gender: Gender | null } {
  const genderRoll = Math.random();
  const gender: Gender | null = genderRoll < 0.62 ? "FEMALE" : genderRoll < 0.95 ? "MALE" : "OTHER";
  const first =
    gender === "MALE" ? randomChoice(INDIAN_FIRST_NAMES_M) : randomChoice(INDIAN_FIRST_NAMES_F);
  const last = randomChoice(INDIAN_LAST_NAMES);
  return { name: `${first} ${last}`, gender };
}

// Designations & their service specialization
type Designation =
  | "Manager"
  | "Receptionist"
  | "Senior Stylist"
  | "Junior Stylist"
  | "Beautician"
  | "Nail Artist"
  | "Massage Therapist"
  | "Makeup Artist";

const STAFF_LIST: { name: string; designation: Designation }[] = [
  { name: "Kavya Reddy", designation: "Manager" },
  { name: "Arjun Mehta", designation: "Receptionist" },
  { name: "Sneha Iyer", designation: "Receptionist" },
  { name: "Ananya Sharma", designation: "Senior Stylist" },
  { name: "Ritu Kapoor", designation: "Senior Stylist" },
  { name: "Vikram Rathore", designation: "Senior Stylist" },
  { name: "Pooja Nair", designation: "Junior Stylist" },
  { name: "Rahul Verma", designation: "Junior Stylist" },
  { name: "Divya Menon", designation: "Junior Stylist" },
  { name: "Meera Pillai", designation: "Beautician" },
  { name: "Anjali Krishnan", designation: "Beautician" },
  { name: "Priya Desai", designation: "Nail Artist" },
  { name: "Kiran Joshi", designation: "Nail Artist" },
  { name: "Suresh Babu", designation: "Massage Therapist" },
  { name: "Deepak Nair", designation: "Massage Therapist" },
  { name: "Nandini Rao", designation: "Makeup Artist" },
  { name: "Shalini Gupta", designation: "Makeup Artist" },
];

const ROLE_PAY: Record<Designation, { baseSalary: [number, number]; commissionRate: [number, number] }> = {
  Manager: { baseSalary: [30000, 35000], commissionRate: [2, 3] },
  Receptionist: { baseSalary: [12000, 15000], commissionRate: [0, 0] },
  "Senior Stylist": { baseSalary: [20000, 28000], commissionRate: [10, 15] },
  "Junior Stylist": { baseSalary: [12000, 16000], commissionRate: [8, 12] },
  Beautician: { baseSalary: [14000, 20000], commissionRate: [8, 12] },
  "Nail Artist": { baseSalary: [12000, 16000], commissionRate: [8, 12] },
  "Massage Therapist": { baseSalary: [14000, 18000], commissionRate: [8, 12] },
  "Makeup Artist": { baseSalary: [16000, 24000], commissionRate: [10, 15] },
};

// Category -> designations that can perform it
const CATEGORY_PERFORMERS: Record<string, Designation[]> = {
  Hair: ["Senior Stylist", "Junior Stylist"],
  Skin: ["Beautician"],
  Nail: ["Nail Artist"],
  Spa: ["Massage Therapist"],
  Makeup: ["Makeup Artist"],
  Bridal: ["Makeup Artist"],
};

const SERVICE_CATEGORIES = ["Hair", "Skin", "Nail", "Makeup", "Spa", "Bridal"];

const SERVICES_DATA: { name: string; category: string; price: number; duration: number }[] = [
  { name: "Haircut - Women", category: "Hair", price: 350, duration: 45 },
  { name: "Haircut - Men", category: "Hair", price: 200, duration: 30 },
  { name: "Hair Wash & Blow Dry", category: "Hair", price: 400, duration: 30 },
  { name: "Hair Color - Global", category: "Hair", price: 1800, duration: 120 },
  { name: "Hair Color - Highlights", category: "Hair", price: 2500, duration: 150 },
  { name: "Hair Spa", category: "Hair", price: 900, duration: 60 },
  { name: "Keratin Treatment", category: "Hair", price: 3800, duration: 180 },
  { name: "Hair Straightening", category: "Hair", price: 3200, duration: 150 },
  { name: "Facial - Basic", category: "Skin", price: 700, duration: 60 },
  { name: "Facial - Gold", category: "Skin", price: 1400, duration: 75 },
  { name: "Facial - Diamond", category: "Skin", price: 2200, duration: 90 },
  { name: "Cleanup", category: "Skin", price: 450, duration: 30 },
  { name: "De-Tan Treatment", category: "Skin", price: 600, duration: 40 },
  { name: "Manicure - Basic", category: "Nail", price: 350, duration: 30 },
  { name: "Manicure - Gel", category: "Nail", price: 700, duration: 45 },
  { name: "Pedicure - Basic", category: "Nail", price: 450, duration: 45 },
  { name: "Pedicure - Spa", category: "Nail", price: 900, duration: 60 },
  { name: "Nail Art", category: "Nail", price: 550, duration: 45 },
  { name: "Party Makeup", category: "Makeup", price: 2200, duration: 90 },
  { name: "HD Makeup", category: "Makeup", price: 3500, duration: 100 },
  { name: "Engagement Makeup", category: "Makeup", price: 4000, duration: 100 },
  { name: "Body Massage - Swedish", category: "Spa", price: 1600, duration: 60 },
  { name: "Body Massage - Deep Tissue", category: "Spa", price: 1900, duration: 60 },
  { name: "Head Massage", category: "Spa", price: 500, duration: 30 },
  { name: "Foot Reflexology", category: "Spa", price: 800, duration: 45 },
  { name: "Bridal Makeup", category: "Bridal", price: 6000, duration: 150 },
  { name: "Bridal Package (Hair + Makeup)", category: "Bridal", price: 9000, duration: 210 },
  { name: "Pre-Bridal Package", category: "Bridal", price: 5000, duration: 180 },
];

const SUPPLIERS_DATA = [
  { name: "Lakme Professional Distributors", contactPerson: "Rohit Ahuja", phone: "9811100001" },
  { name: "L'Oreal Salon Partners India", contactPerson: "Neha Sinha", phone: "9811100002" },
  { name: "Nature's Essence Wholesale", contactPerson: "Sameer Kulkarni", phone: "9811100003" },
  { name: "BeautyPro Supplies Co.", contactPerson: "Ayesha Khan", phone: "9811100004" },
];

const PRODUCT_CATEGORIES = ["Hair Care", "Skin Care", "Nail Care", "Tools & Equipment", "Retail"];

type ProductSeed = {
  name: string;
  category: string;
  supplier: number; // index into SUPPLIERS_DATA
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  isRetailItem: boolean;
  unit: string;
};

const PRODUCTS_DATA: ProductSeed[] = [
  { name: "Shampoo 250ml", category: "Hair Care", supplier: 0, costPrice: 180, sellingPrice: 350, reorderLevel: 10, isRetailItem: true, unit: "bottle" },
  { name: "Conditioner 250ml", category: "Hair Care", supplier: 0, costPrice: 190, sellingPrice: 360, reorderLevel: 10, isRetailItem: true, unit: "bottle" },
  { name: "Hair Serum 100ml", category: "Hair Care", supplier: 1, costPrice: 220, sellingPrice: 450, reorderLevel: 8, isRetailItem: true, unit: "bottle" },
  { name: "Hair Oil 200ml", category: "Hair Care", supplier: 2, costPrice: 120, sellingPrice: 250, reorderLevel: 12, isRetailItem: true, unit: "bottle" },
  { name: "Keratin Treatment Kit", category: "Hair Care", supplier: 1, costPrice: 900, sellingPrice: 1600, reorderLevel: 4, isRetailItem: false, unit: "kit" },
  { name: "Hair Mask 200g", category: "Hair Care", supplier: 0, costPrice: 260, sellingPrice: 520, reorderLevel: 8, isRetailItem: true, unit: "jar" },
  { name: "Face Wash 100ml", category: "Skin Care", supplier: 2, costPrice: 140, sellingPrice: 280, reorderLevel: 10, isRetailItem: true, unit: "bottle" },
  { name: "Moisturizer 200g", category: "Skin Care", supplier: 2, costPrice: 210, sellingPrice: 420, reorderLevel: 8, isRetailItem: true, unit: "jar" },
  { name: "Sunscreen SPF50 100ml", category: "Skin Care", supplier: 3, costPrice: 260, sellingPrice: 520, reorderLevel: 8, isRetailItem: true, unit: "bottle" },
  { name: "Face Pack 100g", category: "Skin Care", supplier: 3, costPrice: 160, sellingPrice: 320, reorderLevel: 10, isRetailItem: true, unit: "jar" },
  { name: "Under Eye Cream 30g", category: "Skin Care", supplier: 2, costPrice: 300, sellingPrice: 600, reorderLevel: 6, isRetailItem: true, unit: "jar" },
  { name: "Nail Polish (assorted)", category: "Nail Care", supplier: 3, costPrice: 90, sellingPrice: 200, reorderLevel: 15, isRetailItem: true, unit: "pcs" },
  { name: "Nail Polish Remover 200ml", category: "Nail Care", supplier: 3, costPrice: 70, sellingPrice: 150, reorderLevel: 10, isRetailItem: true, unit: "bottle" },
  { name: "Cuticle Oil 30ml", category: "Nail Care", supplier: 3, costPrice: 110, sellingPrice: 240, reorderLevel: 8, isRetailItem: true, unit: "bottle" },
  { name: "Nail Art Stickers Pack", category: "Nail Care", supplier: 3, costPrice: 40, sellingPrice: 100, reorderLevel: 12, isRetailItem: true, unit: "pack" },
  { name: "Hair Dryer (Professional)", category: "Tools & Equipment", supplier: 1, costPrice: 2200, sellingPrice: 2200, reorderLevel: 2, isRetailItem: false, unit: "pcs" },
  { name: "Hair Straightener", category: "Tools & Equipment", supplier: 1, costPrice: 1800, sellingPrice: 1800, reorderLevel: 2, isRetailItem: false, unit: "pcs" },
  { name: "Trimmer Kit", category: "Tools & Equipment", supplier: 1, costPrice: 1200, sellingPrice: 1200, reorderLevel: 2, isRetailItem: false, unit: "kit" },
  { name: "Disposable Towels (Pack of 50)", category: "Tools & Equipment", supplier: 0, costPrice: 300, sellingPrice: 300, reorderLevel: 5, isRetailItem: false, unit: "pack" },
  { name: "Salon Gift Hamper", category: "Retail", supplier: 0, costPrice: 500, sellingPrice: 999, reorderLevel: 5, isRetailItem: true, unit: "pcs" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function resetExistingDemoTenant() {
  const existing = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG }, select: { id: true } });
  if (!existing) return;

  const tenantId = existing.id;
  console.log(`Found existing demo tenant (${tenantId}). Wiping before reseeding...`);

  await prisma.loyaltyTransaction.deleteMany({ where: { loyaltyCard: { tenantId } } });
  await prisma.loyaltyCard.deleteMany({ where: { tenantId } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.stockMovement.deleteMany({ where: { tenantId } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { tenantId } } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
  await prisma.payroll.deleteMany({ where: { tenantId } });
  await prisma.salaryHistory.deleteMany({ where: { tenantId } });
  await prisma.attendance.deleteMany({ where: { tenantId } });
  await prisma.appointment.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.productCategory.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.service.deleteMany({ where: { tenantId } });
  await prisma.serviceCategory.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.salonSettings.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  console.log("Wipe complete.");
}

async function main() {
  console.log("=== Glamour Salon demo data seed ===");

  await resetExistingDemoTenant();

  const now = new Date();
  const windowStart = startOfDay(addDays(now, -182)); // ~6 months back
  const totalDays = Math.floor((startOfDay(now).getTime() - windowStart.getTime()) / DAY_MS) + 1;
  const subscriptionStart = windowStart;
  const subscriptionEnd = addDays(subscriptionStart, 365);

  console.log(`Window: ${windowStart.toDateString()} -> ${now.toDateString()} (${totalDays} days)`);

  // -------------------------------------------------------------------
  // 1. Tenant, Owner, Settings, Subscription Payment
  // -------------------------------------------------------------------
  console.log("\n[1/9] Creating tenant, owner user, settings, subscription payment...");

  const tenant = await prisma.tenant.create({
    data: {
      name: "Glamour Salon",
      tagline: "Where beauty meets expertise",
      slug: TENANT_SLUG,
      address: "42 MG Road, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      phone: "9845012345",
      email: "contact@glamoursalon.com",
      gstNumber: "29ABCDE1234F1Z5",
      openTime: "09:00",
      closeTime: "20:00",
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      plan: Plan.YEARLY,
      isSubscribed: true,
      subscriptionStart,
      subscriptionEnd,
      subscriptionPlan: "YEARLY",
      subscriptionEndsAt: subscriptionEnd,
      isActive: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Glamour Salon Owner",
      email: OWNER_EMAIL,
      mobile: "9845012345",
      password: await hash(OWNER_PASSWORD, 10),
      role: "OWNER",
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
    },
  });

  await prisma.salonSettings.create({
    data: {
      tenantId: tenant.id,
      onboardingStep1Done: true,
      loyaltyPointsPerRupee: 0.1,
      rupeePerPoint: 1,
      minPointsToRedeem: 100,
      maxRedeemPercent: 50,
      silverThreshold: 500,
      goldThreshold: 2000,
      platinumThreshold: 5000,
      sundayEnabled: false,
    },
  });

  const subscriptionAmount = 5999;
  const gstBreakdown = calculateGSTBreakdown(subscriptionAmount);
  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      plan: "YEARLY",
      amount: subscriptionAmount,
      status: "SUCCESS",
      razorpayOrderId: `order_demo_${tenant.id.slice(-8)}`,
      razorpayPaymentId: `pay_demo_${tenant.id.slice(-8)}`,
      periodStart: subscriptionStart,
      periodEnd: subscriptionEnd,
      invoiceNumber: `SUB-INV-DEMO-${subscriptionStart.getFullYear()}-${tenant.id.slice(-6)}`,
      baseAmount: gstBreakdown.baseAmount,
      gstAmount: gstBreakdown.gstAmount,
      gstRate: gstBreakdown.gstRate,
      createdAt: subscriptionStart,
    },
  });

  // -------------------------------------------------------------------
  // 2. Staff + Salary History
  // -------------------------------------------------------------------
  console.log("[2/9] Creating staff + salary history...");

  const staffRecords: { id: string; name: string; designation: Designation; commissionRate: number }[] = [];
  for (let i = 0; i < STAFF_LIST.length; i++) {
    const s = STAFF_LIST[i];
    const pay = ROLE_PAY[s.designation];
    const baseSalary = roundMoney(randomFloat(pay.baseSalary[0], pay.baseSalary[1]));
    const commissionRate = roundMoney(randomFloat(pay.commissionRate[0], pay.commissionRate[1]));

    const staff = await prisma.staff.create({
      data: {
        name: s.name,
        designation: s.designation,
        mobile: `98450${padNum(20000 + i, 5)}`,
        email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@glamoursalon.com`,
        workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        status: "ACTIVE",
        availabilityStatus: "AVAILABLE",
        baseSalary,
        commissionRate,
        salaryEffectiveFrom: subscriptionStart,
        tenantId: tenant.id,
      },
    });

    await prisma.salaryHistory.create({
      data: {
        staffId: staff.id,
        baseSalary,
        commissionRate,
        effectiveFrom: subscriptionStart,
        effectiveTo: null,
        tenantId: tenant.id,
      },
    });

    staffRecords.push({ id: staff.id, name: staff.name, designation: s.designation, commissionRate });
  }

  const servingStaff = staffRecords.filter((s) => s.designation !== "Manager" && s.designation !== "Receptionist");
  const anyStaffForWalkin = staffRecords; // receptionists can also process retail-only sales

  // -------------------------------------------------------------------
  // 3. Service categories + services
  // -------------------------------------------------------------------
  console.log("[3/9] Creating service categories + services...");

  for (const name of SERVICE_CATEGORIES) {
    await prisma.serviceCategory.create({ data: { name, tenantId: tenant.id } });
  }

  const serviceRecords: { id: string; name: string; category: string; price: number; duration: number }[] = [];
  for (const s of SERVICES_DATA) {
    const service = await prisma.service.create({
      data: {
        name: s.name,
        category: s.category,
        price: s.price,
        duration: s.duration,
        status: "ACTIVE",
        tenantId: tenant.id,
      },
    });
    serviceRecords.push({ id: service.id, name: service.name, category: service.category, price: s.price, duration: s.duration });
  }

  // -------------------------------------------------------------------
  // 4. Suppliers, product categories, products
  // -------------------------------------------------------------------
  console.log("[4/9] Creating suppliers, product categories, products...");

  const supplierRecords: { id: string }[] = [];
  for (const s of SUPPLIERS_DATA) {
    const supplier = await prisma.supplier.create({
      data: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: `${s.name.split(" ")[0].toLowerCase()}@supplier.com`,
        tenantId: tenant.id,
      },
    });
    supplierRecords.push({ id: supplier.id });
  }

  const productCategoryMap = new Map<string, string>();
  for (const name of PRODUCT_CATEGORIES) {
    const cat = await prisma.productCategory.create({ data: { name, tenantId: tenant.id } });
    productCategoryMap.set(name, cat.id);
  }

  type ProductRecord = {
    id: string;
    name: string;
    costPrice: number;
    sellingPrice: number;
    reorderLevel: number;
    isRetailItem: boolean;
    supplierId: string;
  };
  const productRecords: ProductRecord[] = [];
  for (const p of PRODUCTS_DATA) {
    const supplierId = supplierRecords[p.supplier].id;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        categoryId: productCategoryMap.get(p.category) ?? null,
        unit: p.unit,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        currentStock: 0,
        reorderLevel: p.reorderLevel,
        isRetailItem: p.isRetailItem,
        supplierId,
        status: "ACTIVE",
        tenantId: tenant.id,
      },
    });
    productRecords.push({
      id: product.id,
      name: p.name,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      reorderLevel: p.reorderLevel,
      isRetailItem: p.isRetailItem,
      supplierId,
    });
  }
  const retailProducts = productRecords.filter((p) => p.isRetailItem);

  // -------------------------------------------------------------------
  // 5. Customers + loyalty cards
  // -------------------------------------------------------------------
  console.log("[5/9] Creating customers + loyalty cards...");

  const customerCount = randomInt(105, 118);
  type CustomerSeed = { mobile: string; name: string; gender: Gender | null; email: string | null; createdAt: Date };
  const customerSeeds: CustomerSeed[] = [];
  for (let i = 0; i < customerCount; i++) {
    const { name, gender } = randomCustomerName();
    // gentle upward trend: bias dayFraction towards later part of window using sqrt
    const dayFraction = Math.pow(Math.random(), 0.7);
    const dayOffset = Math.min(totalDays - 1, Math.floor(dayFraction * totalDays));
    const createdAt = addDays(windowStart, dayOffset);
    createdAt.setHours(randomInt(9, 19), randomChoice([0, 15, 30, 45]), 0, 0);
    customerSeeds.push({
      mobile: `70000${padNum(10000 + i, 5)}`,
      name,
      gender,
      email: Math.random() < 0.55 ? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com` : null,
      createdAt,
    });
  }
  customerSeeds.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  await prisma.customer.createMany({
    data: customerSeeds.map((c) => ({
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      gender: c.gender,
      tenantId: tenant.id,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
    })),
  });

  const createdCustomers = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, mobile: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  type CustomerRuntime = { id: string; createdAt: Date; totalPoints: number; totalSpent: number; pointsRedeemed: number; isRedeemer: boolean; hasRedeemed: boolean };
  const customers: CustomerRuntime[] = createdCustomers.map((c) => ({
    id: c.id,
    createdAt: c.createdAt,
    totalPoints: 0,
    totalSpent: 0,
    pointsRedeemed: 0,
    isRedeemer: Math.random() < 0.12,
    hasRedeemed: false,
  }));

  await prisma.loyaltyCard.createMany({
    data: customers.map((c) => ({ customerId: c.id, tenantId: tenant.id })),
  });

  const loyaltyCards = await prisma.loyaltyCard.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, customerId: true },
  });
  const loyaltyCardByCustomer = new Map(loyaltyCards.map((lc) => [lc.customerId, lc.id]));

  // -------------------------------------------------------------------
  // 6. Purchase order schedule (pre-planned across the window)
  // -------------------------------------------------------------------
  console.log("[6/9] Scheduling purchase orders...");

  type POItemSeed = { productId: string; quantity: number; unitCost: number };
  type POSeed = { dayOffset: number; supplierId: string; items: POItemSeed[]; receivedAfterDays: number };
  const poSeeds: POSeed[] = [];
  const poCount = randomInt(18, 23);
  const pendingCount = 3; // most recent POs stay pending
  for (let i = 0; i < poCount; i++) {
    const isPending = i >= poCount - pendingCount;
    const dayOffset = isPending
      ? totalDays - 1 - randomInt(0, 8)
      : Math.floor(((i + 0.5) / (poCount - pendingCount)) * (totalDays - 12));
    const supplierIdx = randomInt(0, SUPPLIERS_DATA.length - 1);
    const supplierId = supplierRecords[supplierIdx].id;
    const supplierProducts = productRecords.filter((p) => p.supplierId === supplierId);
    const itemCount = Math.min(supplierProducts.length, randomInt(3, 6));
    const chosen = [...supplierProducts].sort(() => Math.random() - 0.5).slice(0, itemCount);
    const items: POItemSeed[] = chosen.map((p) => ({
      productId: p.id,
      quantity: Math.max(5, Math.round(p.reorderLevel * randomFloat(1.5, 3))),
      unitCost: roundMoney(p.costPrice * randomFloat(0.95, 1.05)),
    }));
    poSeeds.push({
      dayOffset: Math.max(0, Math.min(totalDays - 1, dayOffset)),
      supplierId,
      items,
      receivedAfterDays: isPending ? -1 : randomInt(1, 4),
    });
  }
  poSeeds.sort((a, b) => a.dayOffset - b.dayOffset);

  const productStock = new Map<string, number>(productRecords.map((p) => [p.id, 0]));
  const stockMovementsBuffer: { productId: string; type: string; quantity: number; reference: string; createdAt: Date }[] = [];

  let poSeq = 0;
  const poReceiptsByDay = new Map<number, POSeed & { poNumber: string }>();
  for (const po of poSeeds) {
    poSeq += 1;
    const poNumber = `PO-${now.getFullYear()}-${padNum(poSeq)}`;
    const createdAt = addDays(windowStart, po.dayOffset);
    const totalAmount = roundMoney(po.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0));
    const isPending = po.receivedAfterDays === -1;
    const receivedAt = isPending ? null : addDays(createdAt, po.receivedAfterDays);

    await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: po.supplierId,
        status: isPending ? "PENDING" : "RECEIVED",
        totalAmount,
        tenantId: tenant.id,
        createdAt,
        receivedAt,
        items: {
          create: po.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            amount: roundMoney(it.quantity * it.unitCost),
          })),
        },
      },
    });

    if (!isPending && receivedAt) {
      const receivedDayOffset = Math.floor((receivedAt.getTime() - windowStart.getTime()) / DAY_MS);
      const key = Math.min(totalDays - 1, Math.max(0, receivedDayOffset));
      const existing = poReceiptsByDay.get(key);
      if (existing) {
        existing.items.push(...po.items);
      } else {
        poReceiptsByDay.set(key, { ...po, items: [...po.items], poNumber });
      }
    }
  }

  // -------------------------------------------------------------------
  // 7. Day-by-day simulation: attendance, appointments, invoices, loyalty, stock
  // -------------------------------------------------------------------
  console.log("[7/9] Simulating 6 months of appointments, invoices, attendance...");

  const attendanceBuffer: { staffId: string; status: AttendanceStatus; date: Date }[] = [];
  const loyaltyTxnBuffer: { loyaltyCardId: string; invoiceId: string; points: number; type: LoyaltyType; description: string; createdAt: Date }[] = [];

  let customerCursor = 0;
  const availableCustomers: CustomerRuntime[] = [];
  let appointmentSeq = 0;
  let invoiceSeq = 0;
  let appointmentCount = 0;
  let invoiceCount = 0;
  let cancelledCount = 0;
  let walkinCount = 0;

  const invoiceNumberYear = now.getFullYear();
  function nextAppointmentNumber() {
    appointmentSeq += 1;
    return `SCZO-${invoiceNumberYear}-${padNum(appointmentSeq)}`;
  }
  function nextInvoiceNumber() {
    invoiceSeq += 1;
    return `INV-${invoiceNumberYear}-${padNum(invoiceSeq)}`;
  }

  async function createInvoiceFor(
    customer: CustomerRuntime,
    staffId: string | null,
    invoiceDate: Date,
    serviceItem: { serviceId: string; name: string; price: number } | null,
    appointmentId: string | null,
  ) {
    const items: { name: string; price: number; quantity: number; amount: number; serviceId: string | null; productId: string | null; staffId: string | null }[] = [];
    let subtotal = 0;

    if (serviceItem) {
      items.push({
        name: serviceItem.name,
        price: serviceItem.price,
        quantity: 1,
        amount: serviceItem.price,
        serviceId: serviceItem.serviceId,
        productId: null,
        staffId,
      });
      subtotal += serviceItem.price;
    }

    // Retail add-on chance
    const addonChance = serviceItem ? 0.35 : 1; // walk-in retail invoices always have >=1 product
    const productPicks: { productId: string; quantity: number; sellingPrice: number; name: string }[] = [];
    if (Math.random() < addonChance) {
      const pickCount = serviceItem ? randomInt(1, 2) : randomInt(1, 3);
      const shuffled = [...retailProducts].sort(() => Math.random() - 0.5);
      for (const p of shuffled) {
        if (productPicks.length >= pickCount) break;
        const stock = productStock.get(p.id) ?? 0;
        const qty = randomInt(1, 2);
        if (stock >= qty) {
          productPicks.push({ productId: p.id, quantity: qty, sellingPrice: p.sellingPrice, name: p.name });
          productStock.set(p.id, stock - qty);
        }
      }
    }

    for (const pick of productPicks) {
      const amount = roundMoney(pick.sellingPrice * pick.quantity);
      items.push({
        name: pick.name,
        price: pick.sellingPrice,
        quantity: pick.quantity,
        amount,
        serviceId: null,
        productId: pick.productId,
        staffId: null,
      });
      subtotal += amount;
    }

    if (items.length === 0) return null; // nothing to sell (e.g. no stock for retail-only walk-in)

    subtotal = roundMoney(subtotal);

    // Manual discount ~12% of invoices
    const manualDiscount = Math.random() < 0.12 ? roundMoney(subtotal * randomFloat(0.05, 0.15)) : 0;
    const amountAfterManualDiscount = roundMoney(subtotal - manualDiscount);

    // Loyalty redemption
    let loyaltyDiscount = 0;
    if (customer.isRedeemer && !customer.hasRedeemed && customer.totalPoints >= 150) {
      const requested = randomInt(50, 150);
      loyaltyDiscount = roundMoney(Math.min(requested, customer.totalPoints, Math.floor(amountAfterManualDiscount)));
    }

    const taxableAmount = roundMoney(Math.max(0, amountAfterManualDiscount - loyaltyDiscount));
    const gstRate = 18;
    const taxAmount = roundMoney((taxableAmount * gstRate) / 100);
    const total = roundMoney(taxableAmount + taxAmount);
    const pointsEarned = Math.floor(total / 10);

    const paymentMethod = weightedChoice<PaymentMethod>([
      { value: "CASH", weight: 40 },
      { value: "UPI", weight: 45 },
      { value: "CARD", weight: 15 },
    ]);
    const paymentStatus = weightedChoice<PaymentStatus>([
      { value: "PAID", weight: 97 },
      { value: "REFUNDED", weight: 2 },
      { value: "CANCELLED", weight: 1 },
    ]);

    const invoiceNumber = nextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate,
        subtotal,
        taxRate: gstRate,
        taxAmount,
        discount: roundMoney(manualDiscount + loyaltyDiscount),
        total,
        paymentMethod,
        paymentStatus,
        customerId: customer.id,
        appointmentId,
        staffId,
        tenantId: tenant.id,
        createdAt: invoiceDate,
        items: { create: items },
      },
    });

    for (const pick of productPicks) {
      stockMovementsBuffer.push({
        productId: pick.productId,
        type: "SALE_OUT",
        quantity: pick.quantity,
        reference: invoice.invoiceNumber,
        createdAt: invoiceDate,
      });
    }

    if (paymentStatus === "PAID") {
      const cardId = loyaltyCardByCustomer.get(customer.id);
      if (cardId) {
        if (loyaltyDiscount > 0) {
          loyaltyTxnBuffer.push({
            loyaltyCardId: cardId,
            invoiceId: invoice.id,
            points: loyaltyDiscount,
            type: "REDEEMED",
            description: `Redeemed during invoice ${invoice.invoiceNumber}`,
            createdAt: invoiceDate,
          });
          customer.totalPoints -= loyaltyDiscount;
          customer.pointsRedeemed += loyaltyDiscount;
          customer.hasRedeemed = true;
        }
        if (pointsEarned > 0) {
          loyaltyTxnBuffer.push({
            loyaltyCardId: cardId,
            invoiceId: invoice.id,
            points: pointsEarned,
            type: "EARNED",
            description: `Earned from invoice ${invoice.invoiceNumber}`,
            createdAt: invoiceDate,
          });
          customer.totalPoints += pointsEarned;
        }
        customer.totalSpent += total;
      }
    }

    invoiceCount += 1;
    return invoice;
  }

  for (let d = 0; d < totalDays; d++) {
    const date = addDays(windowStart, d);
    const dow = date.getDay();
    const dayName = DOW_NAMES[dow];
    const isWorkingDay = tenant.workingDays.includes(dayName);

    // advance customer availability
    const dayEnd = endOfDay(date);
    while (customerCursor < customers.length && customers[customerCursor].createdAt <= dayEnd) {
      availableCustomers.push(customers[customerCursor]);
      customerCursor++;
    }

    // apply PO receipts scheduled today
    const receipt = poReceiptsByDay.get(d);
    if (receipt) {
      for (const item of receipt.items) {
        productStock.set(item.productId, (productStock.get(item.productId) ?? 0) + item.quantity);
        stockMovementsBuffer.push({
          productId: item.productId,
          type: "PURCHASE_IN",
          quantity: item.quantity,
          reference: receipt.poNumber,
          createdAt: addDays(windowStart, d),
        });
      }
    }

    if (!isWorkingDay || availableCustomers.length === 0) continue;

    // Attendance for each staff member
    for (const staff of staffRecords) {
      const roll = Math.random();
      let status: AttendanceStatus;
      if (roll < 0.9) status = "PRESENT";
      else if (roll < 0.94) status = "ABSENT";
      else if (roll < 0.97) status = "LEAVE";
      else status = "HALF_DAY";
      attendanceBuffer.push({ staffId: staff.id, status, date });
    }

    // Appointments for the day
    const growth = 0.6 + 0.8 * (d / (totalDays - 1));
    const dowBase = dow === 5 || dow === 6 ? 15 : dow === 1 ? 6 : 10; // Fri/Sat busy, Monday slow
    const target = Math.max(1, Math.round(dowBase * growth * randomFloat(0.7, 1.3)));
    const isRecentDay = d >= totalDays - 3;

    for (let i = 0; i < target; i++) {
      const staff = randomChoice(servingStaff);
      const eligibleServices = serviceRecords.filter((s) =>
        (CATEGORY_PERFORMERS[s.category] ?? []).includes(staff.designation),
      );
      if (eligibleServices.length === 0) continue;
      const service = randomChoice(eligibleServices);
      const customer = randomChoice(availableCustomers);

      const hour = randomInt(9, 19);
      const minute = randomChoice([0, 30]);
      const appointmentTime = `${padNum(hour, 2)}:${padNum(minute, 2)}`;
      const appointmentDate = new Date(date);
      appointmentDate.setHours(hour, minute, 0, 0);

      let status: AppointmentStatus;
      if (isRecentDay) {
        status = weightedChoice<AppointmentStatus>([
          { value: "COMPLETED", weight: 55 },
          { value: "BILLED", weight: 12 },
          { value: "CANCELLED", weight: 4 },
          { value: "BOOKED", weight: 29 },
        ]);
      } else {
        status = weightedChoice<AppointmentStatus>([
          { value: "COMPLETED", weight: 78 },
          { value: "BILLED", weight: 15 },
          { value: "CANCELLED", weight: 7 },
        ]);
      }

      const appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: nextAppointmentNumber(),
          appointmentDate,
          appointmentTime,
          duration: service.duration,
          status,
          customerId: customer.id,
          serviceId: service.id,
          staffId: staff.id,
          tenantId: tenant.id,
          createdAt: appointmentDate,
        },
      });

      appointmentCount += 1;
      if (status === "CANCELLED") {
        cancelledCount += 1;
        continue;
      }

      if (status === "COMPLETED" || status === "BILLED") {
        await createInvoiceFor(
          customer,
          staff.id,
          appointmentDate,
          { serviceId: service.id, name: service.name, price: service.price },
          appointment.id,
        );
      }
    }

    // Walk-in retail-only invoices (no appointment)
    const walkinTarget = Math.random() < 0.6 ? randomInt(0, 2) : 0;
    for (let i = 0; i < walkinTarget; i++) {
      const customer = randomChoice(availableCustomers);
      const staff = randomChoice(anyStaffForWalkin);
      const hour = randomInt(10, 19);
      const invoiceDate = new Date(date);
      invoiceDate.setHours(hour, randomChoice([0, 15, 30, 45]), 0, 0);
      const invoice = await createInvoiceFor(customer, staff.id, invoiceDate, null, null);
      if (invoice) walkinCount += 1;
    }
  }

  console.log(`  Appointments created: ${appointmentCount} (cancelled: ${cancelledCount})`);
  console.log(`  Invoices created: ${invoiceCount} (walk-ins: ${walkinCount})`);

  // -------------------------------------------------------------------
  // 8. Flush buffered attendance, stock movements, loyalty transactions
  // -------------------------------------------------------------------
  console.log("[8/9] Flushing attendance, stock movements, loyalty transactions, product stock...");

  for (const batch of chunk(attendanceBuffer, 500)) {
    await prisma.attendance.createMany({
      data: batch.map((a) => ({ staffId: a.staffId, status: a.status, date: a.date, tenantId: tenant.id })),
      skipDuplicates: true,
    });
  }

  for (const batch of chunk(stockMovementsBuffer, 500)) {
    await prisma.stockMovement.createMany({
      data: batch.map((m) => ({
        productId: m.productId,
        type: m.type,
        quantity: m.quantity,
        reference: m.reference,
        tenantId: tenant.id,
        createdAt: m.createdAt,
      })),
    });
  }

  for (const batch of chunk(loyaltyTxnBuffer, 500)) {
    await prisma.loyaltyTransaction.createMany({
      data: batch.map((t) => ({
        loyaltyCardId: t.loyaltyCardId,
        invoiceId: t.invoiceId,
        points: t.points,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  }

  for (const batch of chunk(productRecords, 8)) {
    await Promise.all(
      batch.map((p) =>
        withRetry(() =>
          prisma.product.update({
            where: { id: p.id },
            data: { currentStock: Math.max(0, productStock.get(p.id) ?? 0) },
          }),
        ),
      ),
    );
  }

  for (const batch of chunk(customers, 8)) {
    await Promise.all(
      batch.map((c) => {
        const cardId = loyaltyCardByCustomer.get(c.id);
        if (!cardId) return Promise.resolve();
        return withRetry(() =>
          prisma.loyaltyCard.update({
            where: { id: cardId },
            data: {
              totalPoints: Math.max(0, c.totalPoints),
              pointsRedeemed: c.pointsRedeemed,
              totalSpent: roundMoney(c.totalSpent),
              tier: calculateLoyaltyTier(Math.max(0, c.totalPoints), {
                silverThreshold: 500,
                goldThreshold: 2000,
                platinumThreshold: 5000,
              }),
            },
          }),
        );
      }),
    );
  }

  // -------------------------------------------------------------------
  // 9. Payroll (6 months, reusing calculatePayroll)
  // -------------------------------------------------------------------
  console.log("[9/9] Generating 6 months of payroll via calculatePayroll()...");

  async function nextPayslipNumber(year: number, month: number) {
    const prefix = `PAY-${year}-${padNum(month, 2)}-`;
    const latest = await prisma.payroll.findFirst({
      where: { tenantId: tenant.id, payslipNumber: { startsWith: prefix } },
      orderBy: { payslipNumber: "desc" },
      select: { payslipNumber: true },
    });
    const lastSeq = latest ? Number(latest.payslipNumber.split("-").at(-1) ?? "0") : 0;
    return `${prefix}${padNum(lastSeq + 1)}`;
  }

  // Build the list of (year, month) pairs covered by the window, oldest first.
  const monthKeys: { year: number; month: number }[] = [];
  {
    const cursor = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end) {
      monthKeys.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  let payrollCount = 0;
  for (const { year, month } of monthKeys) {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    for (const staff of staffRecords) {
      try {
        const result = await withRetry(() => calculatePayroll(staff.id, month, year, tenant.id));
        const payslipNumber = await nextPayslipNumber(year, month);
        await prisma.payroll.create({
          data: {
            staffId: staff.id,
            tenantId: tenant.id,
            month,
            year,
            baseSalary: result.baseSalary,
            commissionRate: result.commissionRate,
            commissionAmount: result.commissionAmount,
            revenueGenerated: result.revenueGenerated,
            presentDays: result.presentDays,
            absentDays: result.absentDays,
            leaveDays: result.leaveDays,
            halfDays: result.halfDays,
            totalWorkingDays: result.totalWorkingDays,
            leaveDeduction: result.leaveDeduction,
            grossPay: result.grossPay,
            netPay: result.netPay,
            payslipNumber,
            status: isCurrentMonth ? "GENERATED" : "PAID",
            paidAt: isCurrentMonth ? null : new Date(year, month, 3),
          },
        });
        payrollCount += 1;
      } catch (err) {
        if (err instanceof PayrollCalculationError) {
          console.log(`  Skipped payroll for ${staff.name} ${month}/${year}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  const counts = await prisma.$transaction([
    prisma.customer.count({ where: { tenantId: tenant.id } }),
    prisma.staff.count({ where: { tenantId: tenant.id } }),
    prisma.service.count({ where: { tenantId: tenant.id } }),
    prisma.product.count({ where: { tenantId: tenant.id } }),
    prisma.supplier.count({ where: { tenantId: tenant.id } }),
    prisma.appointment.count({ where: { tenantId: tenant.id } }),
    prisma.invoice.count({ where: { tenantId: tenant.id } }),
    prisma.purchaseOrder.count({ where: { tenantId: tenant.id } }),
    prisma.attendance.count({ where: { tenantId: tenant.id } }),
    prisma.payroll.count({ where: { tenantId: tenant.id } }),
    prisma.loyaltyTransaction.count({ where: { loyaltyCard: { tenantId: tenant.id } } }),
  ]);

  console.log("\n=== Seed complete ===");
  console.log(`Tenant: Glamour Salon (${tenant.slug})`);
  console.log(`Owner login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log(`Customers: ${counts[0]}`);
  console.log(`Staff: ${counts[1]}`);
  console.log(`Services: ${counts[2]}`);
  console.log(`Products: ${counts[3]}`);
  console.log(`Suppliers: ${counts[4]}`);
  console.log(`Appointments: ${counts[5]}`);
  console.log(`Invoices: ${counts[6]}`);
  console.log(`Purchase Orders: ${counts[7]}`);
  console.log(`Attendance records: ${counts[8]}`);
  console.log(`Payroll records: ${counts[9]}`);
  console.log(`Loyalty transactions: ${counts[10]}`);
  console.log(`Owner user id: ${owner.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
