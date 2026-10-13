import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { DayViewCalendar } from "@/components/appointments/calendar/DayViewCalendar";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppointmentsCalendarPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  return (
    <Suspense>
      <DayViewCalendar />
    </Suspense>
  );
}
