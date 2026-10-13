"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { StatusBadge } from "@/components/appointments/StatusBadge";
import { SearchableCombobox, type SearchableComboboxOption } from "@/components/ui/SearchableCombobox";
import { formatDurationLabel, instantForOffset, istWallTimeToInstant, todayISTDateString, toISTWeekday } from "@/lib/time";

type SalonDayEntry = {
  day: string;
  enabled: boolean;
  open: string;
  close: string;
};

export type AppointmentStatus =
  | "BOOKED"
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

export type AppointmentLineInitialData = {
  serviceId: string;
  staffId: string | null;
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
  lines: AppointmentLineInitialData[];
  status: AppointmentStatus;
};

type AppointmentFormProps = {
  mode: "create" | "edit";
  services: AppointmentServiceOption[];
  initialData?: AppointmentFormInitialData;
};

type BusyWindow = {
  start: string;
  end: string;
  label: string;
};

type StaffAvailabilityEntry = {
  id: string;
  name: string;
  designation: string;
  offDuty: boolean;
  busyWindows: BusyWindow[];
};

type ServiceLineValue = {
  serviceId: string;
  staffId: string;
};

type FormValues = {
  customerId?: string;
  mobile: string;
  customerName: string;
  email: string;
  notes: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  lines: ServiceLineValue[];
};

const lineSchema = z.object({
  serviceId: z.string().min(1, "Select a service."),
  staffId: z.string(),
});

const formSchema = z
  .object({
    customerId: z.string().cuid().optional(),
    mobile: z.string().trim().regex(/^\d{10}$/, "Please enter a valid 10-digit mobile number."),
    customerName: z.string().trim().min(2, "Customer name is required."),
    email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
    notes: z.string(),
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    status: z.enum(["BOOKED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"]),
    lines: z.array(lineSchema).min(1, "Add at least one service."),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();

    values.lines.forEach((line, index) => {
      if (!line.serviceId) {
        return;
      }

      if (seen.has(line.serviceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "This service is already added in another row.",
          path: ["lines", index, "serviceId"],
        });
      }

      seen.add(line.serviceId);
    });
  });

function emptyLine(): ServiceLineValue {
  return { serviceId: "", staffId: "" };
}

export function AppointmentForm({ mode, services, initialData }: AppointmentFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [salonDays, setSalonDays] = useState<SalonDayEntry[]>([]);
  const [customerState, setCustomerState] = useState<"idle" | "loading" | "found" | "new">("idle");
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailabilityEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: initialData?.customerId,
      mobile: initialData?.mobile ?? "",
      customerName: initialData?.customerName ?? "",
      email: initialData?.email ?? "",
      notes: initialData?.notes ?? "",
      appointmentDate: initialData?.appointmentDate ?? todayISTDateString(),
      appointmentTime: initialData?.appointmentTime ?? "09:00",
      status: initialData?.status ?? "BOOKED",
      lines:
        initialData?.lines && initialData.lines.length > 0
          ? initialData.lines.map((line) => ({ serviceId: line.serviceId, staffId: line.staffId ?? "" }))
          : [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const mobile = useWatch({ control, name: "mobile" });
  const selectedDate = useWatch({ control, name: "appointmentDate" });
  const selectedTime = useWatch({ control, name: "appointmentTime" });
  const selectedStatus = useWatch({ control, name: "status" });
  const lineValues = useWatch({ control, name: "lines" });

  // Fetch salon working hours once on mount.
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { businessHours?: { days: SalonDayEntry[] } } | null) => {
        if (data?.businessHours?.days) {
          setSalonDays(data.businessHours.days);
        }
      })
      .catch(() => null);
  }, []);

  // Validate selected date/time against salon working hours (IST wall-clock).
  useEffect(() => {
    if (!selectedDate || salonDays.length === 0) {
      setDateError(null);
      setTimeError(null);
      return;
    }

    const dayName = toISTWeekday(istWallTimeToInstant(selectedDate, "00:00"));
    const dayEntry = salonDays.find((d) => d.day === dayName);

    if (!dayEntry || !dayEntry.enabled) {
      setDateError(`Salon is closed on ${dayName}s. Please select a different date.`);
      setTimeError(null);
      return;
    }

    setDateError(null);

    if (selectedTime) {
      const [openH, openM] = dayEntry.open.split(":").map(Number);
      const [closeH, closeM] = dayEntry.close.split(":").map(Number);
      const [aptH, aptM] = selectedTime.split(":").map(Number);
      const openMin = openH * 60 + openM;
      const closeMin = closeH * 60 + closeM;
      const aptMin = aptH * 60 + aptM;

      if (aptMin < openMin || aptMin >= closeMin) {
        setTimeError(`Please select a time between ${dayEntry.open} and ${dayEntry.close}.`);
      } else {
        setTimeError(null);
      }
    } else {
      setTimeError(null);
    }
  }, [selectedDate, selectedTime, salonDays]);

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

  // Busy windows are date-scoped (not time-scoped), so this only needs to
  // refetch when the date changes; row/time changes just shift which window
  // each row is compared against, computed client-side below.
  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    let active = true;

    async function loadAvailability() {
      setSlotsLoading(true);
      try {
        const params = new URLSearchParams({ date: selectedDate });
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
          staff: StaffAvailabilityEntry[];
        };

        if (!active) {
          return;
        }

        setTimeSlots(payload.allSlots);
        setStaffAvailability(payload.staff);
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
  }, [selectedDate, mode, initialData?.id]);

  // Keep the saved slot selectable even when it falls outside the returned availability.
  const timeOptions = useMemo(() => {
    const options = new Set(timeSlots);

    if (selectedTime) {
      options.add(selectedTime);
    }

    return [...options].sort();
  }, [timeSlots, selectedTime]);

  // Async <select> options mount empty, so the DOM drops the saved value — re-apply it.
  useEffect(() => {
    const savedTime = getValues("appointmentTime");

    if (savedTime && timeOptions.includes(savedTime)) {
      setValue("appointmentTime", savedTime);
    }
  }, [timeOptions, getValues, setValue]);

  // Each row's start offset = sum of the durations of the rows before it.
  const rowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;

    for (const line of lineValues ?? []) {
      offsets.push(running);
      const lineService = services.find((service) => service.id === line.serviceId);
      running += lineService?.duration ?? 0;
    }

    return offsets;
  }, [lineValues, services]);

  const totalDuration = useMemo(
    () =>
      (lineValues ?? []).reduce((sum, line) => {
        const lineService = services.find((service) => service.id === line.serviceId);
        return sum + (lineService?.duration ?? 0);
      }, 0),
    [lineValues, services],
  );

  const totalPrice = useMemo(
    () =>
      (lineValues ?? []).reduce((sum, line) => {
        const lineService = services.find((service) => service.id === line.serviceId);
        return sum + (lineService?.price ?? 0);
      }, 0),
    [lineValues, services],
  );

  const dateInstant = useMemo(() => istWallTimeToInstant(selectedDate || todayISTDateString(), "00:00"), [selectedDate]);

  function staffOptionsForRow(rowIndex: number): { options: SearchableComboboxOption[]; unavailableReason: string | null } {
    const line = lineValues?.[rowIndex];
    const rowService = services.find((service) => service.id === line?.serviceId);
    const rowDuration = rowService?.duration ?? 0;
    const offset = rowOffsets[rowIndex] ?? 0;

    const rowStart = selectedTime ? instantForOffset(dateInstant, selectedTime, offset) : null;
    const rowEnd = selectedTime ? instantForOffset(dateInstant, selectedTime, offset + rowDuration) : null;

    const options: SearchableComboboxOption[] = staffAvailability.map((staff) => {
      if (staff.offDuty) {
        return {
          value: staff.id,
          label: staff.name,
          description: staff.designation,
          disabled: true,
          disabledReason: "Not available",
        };
      }

      if (rowStart && rowEnd) {
        const conflict = staff.busyWindows.find(
          (window) => new Date(window.start) < rowEnd && rowStart < new Date(window.end),
        );

        if (conflict) {
          return {
            value: staff.id,
            label: staff.name,
            description: staff.designation,
            disabled: true,
            disabledReason: conflict.label,
          };
        }
      }

      return {
        value: staff.id,
        label: staff.name,
        description: staff.designation,
      };
    });

    const currentStaffId = line?.staffId;
    const currentOption = currentStaffId ? options.find((option) => option.value === currentStaffId) : null;
    const unavailableReason = currentOption?.disabled ? currentOption.disabledReason ?? "No longer available" : null;

    return { options, unavailableReason };
  }

  function serviceOptionsForRow(rowIndex: number): SearchableComboboxOption[] {
    const usedElsewhere = new Set(
      (lineValues ?? [])
        .filter((_, index) => index !== rowIndex)
        .map((line) => line.serviceId)
        .filter(Boolean),
    );

    return services.map((service) => ({
      value: service.id,
      label: service.name,
      description: `\u20b9${service.price.toFixed(0)} \u00b7 ${service.duration} min`,
      group: service.category,
      disabled: usedElsewhere.has(service.id),
      disabledReason: usedElsewhere.has(service.id) ? "Already added" : undefined,
    }));
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const endpoint = mode === "create" ? "/api/appointments" : `/api/appointments/${initialData?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const body = {
      customerId: values.customerId,
      mobile: values.mobile,
      customerName: values.customerName,
      email: values.email,
      notes: values.notes,
      appointmentDate: values.appointmentDate,
      appointmentTime: values.appointmentTime,
      status: values.status,
      services: values.lines.map((line) => ({
        serviceId: line.serviceId,
        staffId: line.staffId || null,
      })),
    };

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; appointment?: { id: string } }
      | null;

    if (!response.ok) {
      setSubmitError(payload?.error ?? "Unable to save appointment.");
      return;
    }

    const createdId = mode === "create" ? payload?.appointment?.id : undefined;

    router.refresh();
    router.push(
      `/appointments?success=${mode === "create" ? "created" : "updated"}&date=${values.appointmentDate}&t=${Date.now()}` +
        (createdId ? `&appointmentId=${createdId}` : ""),
    );
  });

  const linesError = errors.lines?.message;

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
                {dateError ? <p className="text-xs text-red-600">{dateError}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Appointment Time *</label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("appointmentTime")}
                >
                  {timeOptions.length === 0 ? <option value="">No slots</option> : null}
                  {timeOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                {errors.appointmentTime ? (
                  <p className="text-xs text-red-600">{errors.appointmentTime.message}</p>
                ) : null}
                {timeError ? <p className="text-xs text-red-600">{timeError}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                  {...register("status")}
                >
                  <option value="BOOKED">Booked</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="BILLED">Billed</option>
                </select>
              </div>

              <div className="flex items-end">
                <div className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-2.5 text-sm text-[var(--muted)]">
                  Current status: <StatusBadge status={selectedStatus} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-4 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Services *</h2>
            {slotsLoading ? <p className="text-xs text-[var(--muted)]">Checking staff availability...</p> : null}
          </div>

          {linesError ? <p className="text-xs text-red-600">{linesError}</p> : null}

          <div className="space-y-3">
            {fields.map((field, index) => {
              const line = lineValues?.[index];
              const lineService = services.find((service) => service.id === line?.serviceId);
              const { options: staffOptions, unavailableReason } = staffOptionsForRow(index);
              const serviceOptions = serviceOptionsForRow(index);
              const serviceErrorMessage = errors.lines?.[index]?.serviceId?.message;

              return (
                <div key={field.id} className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-[var(--foreground)]">Service</label>
                      <SearchableCombobox
                        value={line?.serviceId ?? ""}
                        onChange={(value) => setValue(`lines.${index}.serviceId`, value, { shouldValidate: true })}
                        options={serviceOptions}
                        placeholder="Select a service"
                        searchPlaceholder="Search by name or category..."
                        hasError={Boolean(serviceErrorMessage)}
                        aria-label={`Service for row ${index + 1}`}
                      />
                      {serviceErrorMessage ? <p className="text-xs text-red-600">{serviceErrorMessage}</p> : null}
                      {lineService ? (
                        <p className="text-xs text-[var(--muted)]">
                          {`\u20b9${lineService.price.toFixed(0)}`} &middot; {formatDurationLabel(lineService.duration)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-[var(--foreground)]">Staff (optional)</label>
                      <SearchableCombobox
                        value={line?.staffId ?? ""}
                        onChange={(value) => setValue(`lines.${index}.staffId`, value, { shouldValidate: true })}
                        options={staffOptions}
                        placeholder="Unassigned"
                        clearLabel="Unassigned"
                        searchPlaceholder="Search by name or designation..."
                        aria-label={`Staff for row ${index + 1}`}
                      />
                      {unavailableReason ? (
                        <p className="text-xs text-amber-600">
                          This staff member may no longer be available ({unavailableReason}).
                        </p>
                      ) : null}
                    </div>

                    {fields.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 sm:mt-6"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => append(emptyLine())}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus className="h-4 w-4" />
            Add More Service
          </button>

          <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Total Price: <strong>{`\u20b9${totalPrice.toFixed(0)}`}</strong>
            </span>
            <span>
              Total Duration: <strong>{formatDurationLabel(totalDuration)}</strong>
            </span>
          </div>
        </section>

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
            disabled={isSubmitting || services.length === 0 || Boolean(dateError) || Boolean(timeError)}
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
