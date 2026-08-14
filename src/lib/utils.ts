type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function generateSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function calculateLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 5000) {
    return "PLATINUM";
  }

  if (points >= 2000) {
    return "GOLD";
  }

  if (points >= 500) {
    return "SILVER";
  }

  return "BRONZE";
}

export function generateInvoiceNumber(prefix: string, count: number, includeYear = true) {
  const normalizedPrefix = prefix.trim() || "INV";
  const serial = String(Math.max(1, count)).padStart(4, "0");

  if (!includeYear) {
    return `${normalizedPrefix}-${serial}`;
  }

  const year = new Date().getFullYear();
  return `${normalizedPrefix}-${year}-${serial}`;
}
