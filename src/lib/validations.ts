import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Service name is required."),
  category: z.string().trim().min(2, "Category is required."),
  price: z.coerce.number().positive("Price must be greater than zero."),
  duration: z.coerce.number().int().positive("Duration must be a positive number."),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2, "Staff name is required."),
  designation: z.string().trim().min(2, "Designation is required."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits.").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  workingDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).or(z.string())).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const appointmentSchema = z.object({
  customerId: z.string().cuid("Select a customer."),
  serviceId: z.string().cuid("Select a service."),
  staffId: z.string().cuid("Select a staff member."),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid appointment date."),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid appointment time."),
  duration: z.coerce.number().int().positive("Duration must be positive."),
  status: z.enum(["BOOKED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

export const invoiceSchema = z.object({
  customerId: z.string().cuid("Customer is required."),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Item name is required."),
        serviceId: z.string().cuid().optional(),
        quantity: z.coerce.number().int().positive("Quantity must be positive."),
        price: z.coerce.number().nonnegative("Price must be non-negative."),
      }),
    )
    .min(1, "At least one invoice item is required."),
  discount: z.coerce.number().nonnegative().default(0),
  taxRate: z.coerce.number().nonnegative().default(18),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET"]),
  loyaltyPointsRedeemed: z.coerce.number().int().nonnegative().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const signupSchema = z.object({
  salonName: z.string().trim().min(2, "Salon name is required."),
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Enter a valid email."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});
