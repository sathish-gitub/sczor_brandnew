export type UserRole = "OWNER" | "MANAGER" | "STAFF";
export type Status = "ACTIVE" | "INACTIVE";
export type AppointmentStatus = "BOOKED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BILLED";
export type PaymentMethod = "CASH" | "UPI" | "CARD" | "WALLET";
export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type TenantEntity = {
  id: string;
  name: string;
  tagline: string | null;
  slug: string;
  logo: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  plan: "FREE" | "BASIC" | "PRO";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserEntity = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  photo: string | null;
  role: UserRole;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerEntity = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth: string | null;
  notes: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceEntity = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  description: string | null;
  status: Status;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffEntity = {
  id: string;
  name: string;
  designation: string;
  mobile: string | null;
  email: string | null;
  workingDays: string[];
  status: Status;
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentEntity = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  status: AppointmentStatus;
  notes: string | null;
  customerId: string;
  serviceId: string;
  staffId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceEntity = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
  customerId: string;
  appointmentId: string | null;
  tenantId: string;
  createdAt: string;
};

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  success?: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CustomerFormValues = {
  name: string;
  mobile: string;
  email?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  notes?: string;
};

export type ServiceFormValues = {
  name: string;
  category: string;
  price: number;
  duration: number;
  description?: string;
  status?: Status;
};

export type StaffFormValues = {
  name: string;
  designation: string;
  mobile?: string;
  email?: string;
  workingDays?: string[];
  status?: Status;
};

export type DashboardStats = {
  todayAppointments: number;
  revenueToday: number;
  totalCustomers: number;
  pendingAppointments: number;
};
