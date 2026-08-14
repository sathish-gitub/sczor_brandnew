import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: session.user.tenantId,
    },
    select: {
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      gstNumber: true,
      openTime: true,
      closeTime: true,
      workingDays: true,
      settings: {
        select: {
          onboardingStep1Done: true,
        },
      },
    },
  });

  if (!tenant) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialProfile={{
        salonName: tenant.name,
        address: tenant.address ?? "",
        city: tenant.city ?? "",
        state: tenant.state ?? "",
        pincode: tenant.pincode ?? "",
        phone: tenant.phone ?? "",
        gstNumber: tenant.gstNumber ?? "",
        openTime: tenant.openTime,
        closeTime: tenant.closeTime,
        workingDays:
          tenant.workingDays.length > 0
            ? tenant.workingDays
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        step1Complete: tenant.settings?.onboardingStep1Done ?? false,
      }}
    />
  );
}