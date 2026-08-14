"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/appointments/StatusBadge";

export type AppointmentStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "BILLED";

export type AppointmentServiceOption = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
};

export type AppointmentFormInitialData = {
  id?: string;
  customerId?: string;
  mobile: string;
  customerName: string;
  email: string;
  notes: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceId: string;
  staffId: string;
  duration: number;
  status: AppointmentStatus;
};

type AppointmentFormProps = {
  mode: "create" | "edit";
  services: AppointmentServiceOption[];
  initialData?: AppointmentFormInitialData;
};

type StaffAvailability = {
  id: string;
  name: string;
  designation: string;
  status: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  bookedTimes: string[];
};

type FormValues = {
  customerId?: string;
  mobile: string;
  customerName: string;
  email: string;
  notes: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceId: string;
  staffId: string;
  duration: number;
  status: AppointmentStatus;
};

const formSchema = z.object({
  customerId: z.string().cuid().optional(),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  customerName: z.string().trim().min(2, "Customer name is required."),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  notes: z.string(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceId: z.string().cuid("Select a service."),
  staffId: z.string().cuid("Select a staff member."),
  duration: z.number().int().positive("Duration must be positive."),
  status: z.enum(["BOOKED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "BILLED"]),
});

function todayDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function toTitleCase(value: string) {
  return value
    .split("_")
    .join(" ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (char) => char.toUpperCase());
}

export function AppointmentForm({ mode, services, initialData }: AppointmentFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerState, setCustomerState] = useState<"idle" | "loading" | "found" | "new">("idle");
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: initialData?.customerId,
      mobile: initialData?.mobile ?? "",
      customerName: initialData?.customerName ?? "",
      email: initialData?.email ?? "",
      notes: initialData?.notes ?? "",
      appointmentDate: initialData?.appointmentDate ?? todayDateString(),
      appointmentTime: initialData?.appointmentTime ?? "09:00",
      serviceId: initialData?.serviceId ?? services[0]?.id ?? "",
      staffId: initialData?.staffId ?? "",
      duration: initialData?.duration ?? services[0]?.duration ?? 30,
      status: initialData?.status ?? "BOOKED",
    },
  });

  const mobile = useWatch({ control, name: "mobile" });
  const selectedDate = useWatch({ control, name: "appointmentDate" });
  const selectedTime = useWatch({ control, name: "appointmentTime" });
  const selectedServiceId = useWatch({ control, name: "serviceId" });
  const selectedStaffId = useWatch({ control, name: "staffId" });
  const selectedStatus = useWatch({ control, name: "status" });

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    setValue("duration", selectedService.duration, { shouldValidate: true });
  }, [selectedService, setValue]);

  useEffect(() => {
    if (!mobile || mobile.length < 10) {
      return;
    }

    if (!/^\d{10}$/.test(mobile)) {
      return;
    }

    const timeout = setTimeout(async () => {
      setCustomerState("loading");

      try {
        const response = await fetch(`/api/customers/search?mobile=${mobile}`);
        const payload = (await response.json()) as {
          items: Array<{ id: string; name: string; email?: string | null; mobile: string }>;
        };
        const exactMatch = payload.items.find((item) => item.mobile === mobile) ?? null;

        if (exactMatch) {
          setValue("customerId", exactMatch.id, { shouldDirty: true });
          setValue("customerName", exactMatch.name, { shouldDirty: true });
          setValue("email", exactMatch.email ?? "", { shouldDirty: true });
          setCustomerState("found");
        } else {
          setValue("customerId", undefined, { shouldDirty: true });
          setCustomerState("new");
        }
      } catch (error) {
        console.error("Customer lookup failed", error);
        setCustomerState("idle");
      }
    }, 320);

    return () => clearTimeout(timeout);
  }, [mobile, setValue]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    let active = true;

    async function loadAvailability() {
      setSlotsLoading(true);
      try {
        const params = new URLSearchParams({ date: selectedDate });
        if (selectedTime) {
          params.set("time", selectedTime);
        }
        if (mode === "edit" && initialData?.id) {
          params.set("excludeAppointmentId", initialData.id);
        }

        const response = await fetch(`/api/appointments/available-slots?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load availability.");
        }

        const payload = (await response.json()) as {
          slots: string[];
          allSlots: string[];
          staffAvailability: StaffAvailability[];
        };

        if (!active) {
          return;
        }

        setTimeSlots(payload.allSlots);
        setStaffAvailability(payload.staffAvailability);
      } catch (error) {
        console.error(error);
        if (active) {
          setTimeSlots([]);
          setStaffAvailability([]);
        }
      } finally {
        if (active) {
          setSlotsLoading(false);
        }
      }
    }

    loadAvailability();

    return () => {
      active = false;
    };
  }, [selectedDate, selectedTime, mode, initialData?.id]);

  const visibleStaff = useMemo(
    () =>
      staffAvailability.filter(
        (staff) => staff.status === "AVAILABLE" || staff.id === selectedStaffId,
      ),
    [staffAvailability, selectedStaffId],
  );

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const endpoint = mode === "create" ? "/api/appointments" : `/api/appointments/${initialData?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setSubmitError(payload?.error ?? "Unable to save appointment.");
      return;
    }

    router.push(`/appointments?success=${mode === "create" ? "created" : "updated"}`);
    router.refresh();
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-6 lg:p-7">
      <form onSubmit={onSubmit} className="space-y-6">
        {submitError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Customer Details</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Mobile Number *</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  inputMode="numeric"
                  placeholder="10 digit mobile"
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("mobile")}
                />
              </div>
              {errors.mobile ? <p className="text-xs text-red-600">{errors.mobile.message}</p> : null}

              {customerState === "loading" ? (
                <p className="text-xs text-[var(--muted)]">Searching customer...</p>
              ) : null}

              {customerState === "found" && mobile.length === 10 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  Customer found and details auto-filled.
                </div>
              ) : null}

              {customerState === "new" && mobile.length === 10 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  New customer. Please enter customer details.
                </div>
              ) : null}
            </div>

            <input type="hidden" {...register("customerId")} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Customer Name *</label>
              <input
                className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                {...register("customerName")}
              />
              {errors.customerName ? <p className="text-xs text-red-600">{errors.customerName.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Email</label>
              <input
                type="email"
                className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                {...register("email")}
              />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Notes</label>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                {...register("notes")}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Appointment Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Appointment Date *</label>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("appointmentDate")}
                />
                {errors.appointmentDate ? (
                  <p className="text-xs text-red-600">{errors.appointmentDate.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Appointment Time *</label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("appointmentTime")}
                >
                  {timeSlots.length === 0 ? <option value="">No slots</option> : null}
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                {errors.appointmentTime ? (
                  <p className="text-xs text-red-600">{errors.appointmentTime.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Service *</label>
              <select
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                {...register("serviceId")}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.category})
                  </option>
                ))}
              </select>
              {errors.serviceId ? <p className="text-xs text-red-600">{errors.serviceId.message}</p> : null}

              {selectedService ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Price: Rs. {selectedService.price.toFixed(0)} | Duration: {selectedService.duration} min
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Staff *</label>
              <select
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                {...register("staffId")}
              >
                <option value="">Select staff</option>
                {visibleStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} - {staff.designation}
                  </option>
                ))}
              </select>
              {errors.staffId ? <p className="text-xs text-red-600">{errors.staffId.message}</p> : null}

              <p className="text-xs text-[var(--muted)]">
                Showing staff available for selected date{selectedTime ? ` and time ${selectedTime}` : ""}.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Duration (minutes)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("duration", { valueAsNumber: true })}
                />
                {errors.duration ? <p className="text-xs text-red-600">{errors.duration.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("status")}
                >
                  <option value="BOOKED">Booked</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="BILLED">Billed</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Staff availability for {selectedDate || "selected date"}
              </p>

              {slotsLoading ? (
                <p className="text-xs text-[var(--muted)]">Loading availability...</p>
              ) : staffAvailability.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No staff records available.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {staffAvailability.map((staff) => {
                    const dotClass =
                      staff.status === "AVAILABLE"
                        ? "bg-emerald-500"
                        : staff.status === "BUSY"
                          ? "bg-amber-500"
                          : "bg-red-500";

                    return (
                      <div key={staff.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{staff.name}</p>
                          <p className="text-[var(--muted)]">{staff.designation}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                          <span className="font-medium text-[var(--foreground)]">{toTitleCase(staff.status)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
          Current status: <StatusBadge status={selectedStatus} />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/appointments")}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || services.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : mode === "create" ? "Save Appointment" : "Update Appointment"}
          </button>
        </div>

        {services.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <p>Add services first to create appointments.</p>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
