import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getRazorpayInstance } from "@/lib/razorpay";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const razorpay = await getRazorpayInstance();
    await razorpay.orders.all({ count: 1 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection failed" },
      { status: 400 },
    );
  }
}
