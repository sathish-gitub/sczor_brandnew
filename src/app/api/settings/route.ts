import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const dayMap: Array<{ key: DayKey; field: string }> = [
  { key: "Mon", field: "monday" },
  { key: "Tue", field: "tuesday" },
  { key: "Wed", field: "wednesday" },
  { key: "Thu", field: "thursday" },
  { key: "Fri", field: "friday" },
  { key: "Sat", field: "saturday" },
  { key: "Sun", field: "sunday" },
];

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [tenant, settings, user, holidays] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: session.user.tenantId } }),
      prisma.salonSettings.findUnique({ where: { tenantId: session.user.tenantId } }),
      prisma.user.findUnique({ where: { id: session.user.id } }),
      prisma.holiday.findMany({
        where: {
          tenantId: session.user.tenantId,
          date: {
            gte: new Date(new Date().toDateString()),
          },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    if (!tenant || !user) {
      return NextResponse.json({ error: "Invalid tenant context." }, { status: 404 });
    }

    const days = dayMap.map(({ key, field }) => {
      const enabledKey = `${field}Enabled` as keyof typeof settings;
      const openKey = `${field}Open` as keyof typeof settings;
      const closeKey = `${field}Close` as keyof typeof settings;
      const breakKey = `${field}Break` as keyof typeof settings;

      return {
        day: key,
        enabled: settings ? Boolean(settings[enabledKey]) : key !== "Sun",
        open: settings ? String(settings[openKey] ?? "09:00") : "09:00",
        close: settings ? String(settings[closeKey] ?? "21:00") : "21:00",
        break: settings ? (settings[breakKey] as string | null) ?? "" : "",
      };
    });

    return NextResponse.json({
      salonProfile: {
        logo: tenant.logo ?? "",
        salonName: tenant.name,
        tagline: tenant.tagline ?? "",
        phone: tenant.phone ?? "",
        email: tenant.email ?? "",
        website: tenant.website ?? "",
        gstNumber: tenant.gstNumber ?? "",
        address: tenant.address ?? "",
        city: tenant.city ?? "",
        state: tenant.state ?? "",
        pincode: tenant.pincode ?? "",
      },
      businessHours: {
        days,
        slotDurationMinutes: settings?.slotDurationMinutes ?? 30,
        holidays: holidays.map((holiday) => ({
          id: holiday.id,
          date: holiday.date.toISOString().slice(0, 10),
          name: holiday.name,
        })),
      },
      taxBilling: {
        gstNumber: tenant.gstNumber ?? "",
        gstEnabled: settings?.gstEnabled ?? true,
        gstRate: Number(settings?.gstRate ?? 18),
        cgstRate: Number(settings?.gstRate ?? 18) / 2,
        sgstRate: Number(settings?.gstRate ?? 18) / 2,
        invoicePrefix: settings?.invoicePrefix ?? "INV",
        invoiceNumberFormat: settings?.invoiceNumberFormat ?? "INV-YYYY-XXXX",
        invoiceStartNumber: settings?.invoiceStartNumber ?? 1,
        invoiceFooter: settings?.invoiceFooter ?? "",
        invoiceTerms: settings?.invoiceTerms ?? "",
        currency: settings?.currency ?? "INR",
        currencySymbol: settings?.currencySymbol ?? "Rs",
        paymentMethods: {
          cash: settings?.cashEnabled ?? true,
          upi: settings?.upiEnabled ?? true,
          card: settings?.cardEnabled ?? true,
          wallet: settings?.walletEnabled ?? true,
        },
        upiId: settings?.upiId ?? "",
      },
      notifications: {
        smsEnabled: settings?.smsEnabled ?? false,
        whatsappEnabled: settings?.whatsappEnabled ?? false,
        emailEnabled: settings?.emailEnabled ?? false,
      },
      account: {
        ownerName: user.name,
        email: user.email,
        mobile: user.mobile,
        profilePhoto: user.photo ?? "",
        role: user.role,
      },
      subscription: {
        currentPlan: tenant.plan,
      },
    });
  } catch (error) {
    console.error("Failed to load settings", error);
    return NextResponse.json({ error: "Unable to load settings right now." }, { status: 500 });
  }
}
