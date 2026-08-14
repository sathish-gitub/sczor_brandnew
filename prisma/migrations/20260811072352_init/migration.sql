-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'BUSY', 'OFF_DUTY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BILLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "LoyaltyType" AS ENUM ('EARNED', 'REDEEMED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstNumber" TEXT,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '21:00',
    "workingDays" TEXT[] DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']::TEXT[],
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "duration" INTEGER NOT NULL,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "workingDays" TEXT[] DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']::TEXT[],
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "availabilityStatus" "Availability" NOT NULL DEFAULT 'AVAILABLE',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "notes" TEXT,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2) NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "LoyaltyType" NOT NULL,
    "description" TEXT,
    "invoiceId" TEXT,
    "loyaltyCardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "staffId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loyaltyPointsPerRupee" DECIMAL(5,2) NOT NULL DEFAULT 0.1,
    "rupeePerPoint" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalonSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- CreateIndex
CREATE INDEX "Tenant_plan_idx" ON "Tenant"("plan");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobile_tenantId_key" ON "Customer"("mobile", "tenantId");

-- CreateIndex
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");

-- CreateIndex
CREATE INDEX "Service_tenantId_category_idx" ON "Service"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Service_tenantId_status_idx" ON "Service"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Staff_tenantId_idx" ON "Staff"("tenantId");

-- CreateIndex
CREATE INDEX "Staff_tenantId_status_idx" ON "Staff"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Staff_tenantId_availabilityStatus_idx" ON "Staff"("tenantId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_appointmentDate_idx" ON "Appointment"("tenantId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_staffId_appointmentDate_idx" ON "Appointment"("staffId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_customerId_appointmentDate_idx" ON "Appointment"("customerId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_invoiceDate_idx" ON "Invoice"("tenantId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_tenantId_key" ON "Invoice"("invoiceNumber", "tenantId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_serviceId_idx" ON "InvoiceItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_customerId_key" ON "LoyaltyCard"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyCard_tenantId_idx" ON "LoyaltyCard"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyCard_tenantId_tier_idx" ON "LoyaltyCard"("tenantId", "tier");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyCardId_idx" ON "LoyaltyTransaction"("loyaltyCardId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_invoiceId_idx" ON "LoyaltyTransaction"("invoiceId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- CreateIndex
CREATE INDEX "Attendance_tenantId_idx" ON "Attendance"("tenantId");

-- CreateIndex
CREATE INDEX "Attendance_tenantId_date_idx" ON "Attendance"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_staffId_date_key" ON "Attendance"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SalonSettings_tenantId_key" ON "SalonSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_loyaltyCardId_fkey" FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonSettings" ADD CONSTRAINT "SalonSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
