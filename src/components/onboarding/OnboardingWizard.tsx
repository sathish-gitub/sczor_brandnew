"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgeIndianRupee,
  Building2,
  Clock3,
  MapPin,
  PartyPopper,
  Phone,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";

const stepLabels = ["Salon Profile", "Add Services", "Add Staff", "All Done"];
const workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const serviceCategories = ["Hair", "Skin", "Nail", "Makeup", "Spa", "Other"] as const;
const staffDesignations = [
  "Beautician",
  "Hair Stylist",
  "Nail Artist",
  "Makeup Artist",
  "Receptionist",
  "Manager",
] as const;

type InitialProfile = {
  salonName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  gstNumber: string;
  openTime: string;
  closeTime: string;
  workingDays: string[];
  step1Complete: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  category: (typeof serviceCategories)[number];
  price: string;
  duration: string;
};

type StaffRow = {
  id: string;
  name: string;
  designation: (typeof staffDesignations)[number];
  mobile: string;
};

type StaffSaveResult = {
  index: number;
  name: string;
  success: boolean;
  error?: string;
};

type OnboardingWizardProps = {
  initialProfile: InitialProfile;
};

function createRowId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const emptyStaffRow = (): StaffRow => ({
  id: createRowId(),
  name: "",
  designation: "Beautician",
  mobile: "",
});

const exampleServiceRow = (): ServiceRow => ({
  id: createRowId(),
  name: "Haircut",
  category: "Hair",
  price: "300",
  duration: "30",
});

export function OnboardingWizard({ initialProfile }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialProfile.step1Complete ? 2 : 1);
  const [profile, setProfile] = useState(initialProfile);
  const [services, setServices] = useState<ServiceRow[]>([exampleServiceRow()]);
  const [staff, setStaff] = useState<StaffRow[]>([emptyStaffRow()]);
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    initialProfile.step1Complete ? [1] : [],
  );
  const [serviceCount, setServiceCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [staffResults, setStaffResults] = useState<StaffSaveResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateCompleted(step: number) {
    setCompletedSteps((existing) =>
      existing.includes(step) ? existing : [...existing, step].sort((left, right) => left - right),
    );
  }

  function goBack() {
    setErrorMessage(null);
    setCurrentStep((value) => Math.max(1, value - 1));
  }

  function validateStep1() {
    if (profile.salonName.trim().length < 2) {
      return "Salon name is required.";
    }

    if (profile.address.trim().length < 5) {
      return "Address is required.";
    }

    if (profile.city.trim().length < 2 || profile.state.trim().length < 2) {
      return "City and state are required.";
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      return "Pincode must be 6 digits.";
    }

    if (!/^\d{10}$/.test(profile.phone)) {
      return "Phone number must be 10 digits.";
    }

    if (profile.workingDays.length === 0) {
      return "Select at least one working day.";
    }

    return null;
  }

  function buildServicesPayload() {
    return services.filter(
      (service) =>
        service.name.trim() || service.price.trim() || service.duration.trim() || service.category,
    ).map(({ name, category, price, duration }) => ({ name, category, price, duration }));
  }

  function validateServices() {
    const payload = buildServicesPayload();

    if (payload.length === 0) {
      return { error: null, payload };
    }

    const hasInvalidRow = payload.some(
      (service) =>
        service.name.trim().length < 2 ||
        Number(service.price) <= 0 ||
        !Number.isFinite(Number(service.price)) ||
        Number(service.duration) <= 0 ||
        !Number.isInteger(Number(service.duration)),
    );

    return {
      error: hasInvalidRow ? "Complete each service row before continuing." : null,
      payload,
    };
  }

  function buildStaffPayload() {
    return staff
      .filter((member) => member.name.trim() || member.mobile.trim())
      .map(({ name, designation, mobile }) => ({ name, designation, mobile }));
  }

  function validateStaff() {
    const payload = buildStaffPayload();

    if (payload.length === 0) {
      return { error: null, payload };
    }

    const hasInvalidRow = payload.some(
      (member) => member.name.trim().length < 2 || !/^\d{10}$/.test(member.mobile),
    );

    return {
      error: hasInvalidRow ? "Complete each staff card before continuing." : null,
      payload,
    };
  }

  async function handleNext() {
    setErrorMessage(null);
    setLoading(true);

    try {
      if (currentStep === 1) {
        const error = validateStep1();

        if (error) {
          setErrorMessage(error);
          return;
        }

        const response = await fetch("/api/onboarding/salon-profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            salonName: profile.salonName,
            address: profile.address,
            city: profile.city,
            state: profile.state,
            pincode: profile.pincode,
            phone: profile.phone,
            gstNumber: profile.gstNumber,
            openTime: profile.openTime,
            closeTime: profile.closeTime,
            workingDays: profile.workingDays,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setErrorMessage(payload?.error ?? "Unable to save salon profile.");
          return;
        }

        setProfile((existing) => ({ ...existing, step1Complete: true }));
        updateCompleted(1);
        setCurrentStep(2);
        return;
      }

      if (currentStep === 2) {
        const { error, payload } = validateServices();

        if (error) {
          setErrorMessage(error);
          return;
        }

        if (payload.length > 0) {
          const response = await fetch("/api/onboarding/services", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ services: payload }),
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            setErrorMessage(body?.error ?? "Unable to save services.");
            return;
          }

          setServiceCount(payload.length);
        }

        updateCompleted(2);
        setCurrentStep(3);
        return;
      }

      if (currentStep === 3) {
        const { error, payload } = validateStaff();

        if (error) {
          setErrorMessage(error);
          return;
        }

        if (payload.length > 0) {
          const response = await fetch("/api/onboarding/staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ staff: payload }),
          });

          const body = (await response.json().catch(() => null)) as
            | { error?: string; count?: number; results?: StaffSaveResult[] }
            | null;

          setStaffResults(body?.results ?? []);

          if (!response.ok) {
            setErrorMessage(body?.error ?? "Unable to save staff.");
            return;
          }

          setStaffCount(body?.count ?? payload.length);
        } else {
          setStaffResults([]);
          setStaffCount(0);
        }

        updateCompleted(3);
        updateCompleted(4);
        setCurrentStep(4);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setErrorMessage(null);

    if (currentStep === 2) {
      setServiceCount(0);
      updateCompleted(2);
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      setStaffCount(0);
      setStaffResults([]);
      updateCompleted(3);
      updateCompleted(4);
      setCurrentStep(4);
    }
  }

  function renderStep1() {
    return (
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Start with your salon profile</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    This is the only required step. It powers invoices, opening hours, and how your team sees the business.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Salon Name</label>
              <input
                value={profile.salonName}
                onChange={(event) => setProfile((existing) => ({ ...existing, salonName: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Address</label>
              <textarea
                rows={4}
                value={profile.address}
                onChange={(event) => setProfile((existing) => ({ ...existing, address: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                placeholder="Street, landmark, locality"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">City</label>
                <input
                  value={profile.city}
                  onChange={(event) => setProfile((existing) => ({ ...existing, city: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">State</label>
                <input
                  value={profile.state}
                  onChange={(event) => setProfile((existing) => ({ ...existing, state: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Pincode</label>
                <input
                  value={profile.pincode}
                  inputMode="numeric"
                  onChange={(event) => setProfile((existing) => ({ ...existing, pincode: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Phone Number</label>
                <input
                  value={profile.phone}
                  inputMode="numeric"
                  onChange={(event) => setProfile((existing) => ({ ...existing, phone: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">GST Number</label>
                <input
                  value={profile.gstNumber}
                  onChange={(event) => setProfile((existing) => ({ ...existing, gstNumber: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Open Time</label>
                <input
                  type="time"
                  value={profile.openTime}
                  onChange={(event) => setProfile((existing) => ({ ...existing, openTime: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Close Time</label>
                <input
                  type="time"
                  value={profile.closeTime}
                  onChange={(event) => setProfile((existing) => ({ ...existing, closeTime: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-[var(--border)] bg-slate-50/80 p-5">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Working Days</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Choose the days your front desk should accept appointments by default.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {workingDays.map((day) => {
                const checked = profile.workingDays.includes(day);

                return (
                  <label
                    key={day}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200",
                      checked
                        ? "border-blue-200 bg-blue-50 text-[var(--primary)]"
                        : "border-slate-200 bg-white text-[var(--muted)] hover:border-blue-100",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setProfile((existing) => ({
                          ...existing,
                          workingDays: checked
                            ? existing.workingDays.filter((value) => value !== day)
                            : [...existing.workingDays, day],
                        }));
                      }}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {day}
                  </label>
                );
              })}
            </div>

            <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Business hours preview</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {profile.openTime} to {profile.closeTime}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Location</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {[profile.city, profile.state].filter(Boolean).join(", ") || "Add your city and state"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Contact</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{profile.phone || "Add your salon phone number"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Scissors className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Build your service menu</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Add your most common treatments now. You can keep it lean and expand later.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setServices((existing) => [...existing, exampleServiceRow()])}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 text-sm font-semibold text-[var(--primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.5fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:grid">
            <span>Name</span>
            <span>Category</span>
            <span>Price</span>
            <span>Duration</span>
            <span className="text-right">Remove</span>
          </div>

          <div className="divide-y divide-slate-200">
            {services.map((service) => (
              <div key={service.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.5fr] md:items-center">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:hidden">Name</label>
                  <input
                    value={service.name}
                    onChange={(event) => {
                      setServices((existing) =>
                        existing.map((item) =>
                          item.id === service.id ? { ...item, name: event.target.value } : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:hidden">Category</label>
                  <select
                    value={service.category}
                    onChange={(event) => {
                      setServices((existing) =>
                        existing.map((item) =>
                          item.id === service.id
                            ? {
                                ...item,
                                category: event.target.value as ServiceRow["category"],
                              }
                            : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  >
                    {serviceCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:hidden">Price</label>
                  <input
                    value={service.price}
                    inputMode="decimal"
                    onChange={(event) => {
                      setServices((existing) =>
                        existing.map((item) =>
                          item.id === service.id ? { ...item, price: event.target.value } : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] md:hidden">Duration</label>
                  <input
                    value={service.duration}
                    inputMode="numeric"
                    onChange={(event) => {
                      setServices((existing) =>
                        existing.map((item) =>
                          item.id === service.id ? { ...item, duration: event.target.value } : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setServices((existing) => existing.filter((item) => item.id !== service.id))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 text-red-500 hover:bg-red-50"
                    aria-label="Remove service"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Add your starting team</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Set up the people customers interact with most. You can invite more staff after launch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStaff((existing) => [...existing, emptyStaffRow()])}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 text-sm font-semibold text-[var(--primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus className="h-4 w-4" />
            Add Staff Member
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {staff.map((member, index) => {
            const result = staffResults.find((item) => item.index === index);

            return (
            <div key={member.id} className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[var(--primary)]">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Staff Member {index + 1}</p>
                    <p className="text-sm text-[var(--muted)]">Role and contact details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStaff((existing) => existing.filter((item) => item.id !== member.id))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 text-red-500 hover:bg-red-50"
                  aria-label="Remove staff member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Name</label>
                  <input
                    value={member.name}
                    onChange={(event) => {
                      setStaff((existing) =>
                        existing.map((item) =>
                          item.id === member.id ? { ...item, name: event.target.value } : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Designation</label>
                  <select
                    value={member.designation}
                    onChange={(event) => {
                      setStaff((existing) =>
                        existing.map((item) =>
                          item.id === member.id
                            ? {
                                ...item,
                                designation: event.target.value as StaffRow["designation"],
                              }
                            : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  >
                    {staffDesignations.map((designation) => (
                      <option key={designation} value={designation}>
                        {designation}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Mobile</label>
                  <input
                    value={member.mobile}
                    inputMode="numeric"
                    onChange={(event) => {
                      setStaff((existing) =>
                        existing.map((item) =>
                          item.id === member.id ? { ...item, mobile: event.target.value } : item,
                        ),
                      );
                    }}
                    className="h-11 w-full rounded-2xl border border-[var(--border)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </div>
              </div>

              {result ? (
                <p
                  className={[
                    "mt-4 rounded-2xl px-4 py-2 text-sm",
                    result.success
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {result.success ? "Saved" : result.error ?? "Could not save."}
                </p>
              ) : null}
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-blue-50 text-[var(--primary)] shadow-[0_18px_40px_rgba(30,64,175,0.15)]">
          <PartyPopper className="h-10 w-10" />
        </div>

        <div className="space-y-3">
          <h2 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Your salon is ready!
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-[var(--muted)]">
            You have the essentials in place. The rest can be refined from the dashboard as your workflow takes shape.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border)] bg-slate-50 p-5 text-left">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">Salon profile configured</p>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-slate-50 p-5 text-left">
            <div className="flex items-center gap-3">
              <BadgeIndianRupee className="h-5 w-5 text-[var(--primary)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">{serviceCount} services added</p>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-slate-50 p-5 text-left">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[var(--primary)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">{staffCount} staff members added</p>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-8 text-base font-semibold text-white shadow-[0_18px_40px_rgba(30,64,175,0.24)] hover:bg-[var(--accent)]"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const descriptions = {
    1: "Set the salon details that appear throughout sczor, from business hours to contact information.",
    2: "Add a few core services now, or skip and build your menu later from the dashboard.",
    3: "Create your starting team so bookings can be assigned as soon as you go live.",
    4: "You have completed the essentials. Head to the dashboard and start running the salon.",
  } as const;

  return (
    <OnboardingLayout
      steps={stepLabels}
      currentStep={currentStep}
      completedSteps={completedSteps}
      title={stepLabels[currentStep - 1] ?? stepLabels[0]}
      description={descriptions[currentStep as keyof typeof descriptions]}
      onBack={currentStep > 1 && currentStep < 4 ? goBack : undefined}
      onSkip={currentStep === 2 || currentStep === 3 ? handleSkip : undefined}
      onNext={currentStep < 4 ? handleNext : undefined}
      nextLabel={currentStep === 3 ? "Finish" : "Next"}
      loading={loading}
      showNavigation={currentStep < 4}
    >
      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {currentStep === 1 ? renderStep1() : null}
      {currentStep === 2 ? renderStep2() : null}
      {currentStep === 3 ? renderStep3() : null}
      {currentStep === 4 ? renderStep4() : null}
    </OnboardingLayout>
  );
}