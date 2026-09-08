import Razorpay from "razorpay";

import { prisma } from "./prisma";

export async function getRazorpayInstance() {
  const settings = await prisma.appSettings.findFirst();

  if (!settings?.razorpayKeyId || !settings?.razorpayKeySecret) {
    throw new Error("Razorpay not configured");
  }

  return new Razorpay({
    key_id: settings.razorpayKeyId,
    key_secret: settings.razorpayKeySecret,
  });
}
