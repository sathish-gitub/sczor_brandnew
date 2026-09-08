import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOrCreateSettings() {
  const existing = await prisma.appSettings.findFirst();
  if (existing) {
    return existing;
  }
  return prisma.appSettings.create({ data: {} });
}

function maskSecret(value: string | null) {
  if (!value) return "";
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(6)}${value.slice(-4)}`;
}

// A masked placeholder is never a valid real secret, so if the client echoes it back
// unchanged (i.e. the field wasn't edited), we skip updating that field.
function isMaskedOrEmpty(value: string | undefined) {
  return !value || value.includes("•");
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getOrCreateSettings();

  return NextResponse.json(
    {
      settings: {
        razorpayKeyId: settings.razorpayKeyId ?? "",
        razorpayKeySecret: maskSecret(settings.razorpayKeySecret),
        razorpayWebhookSecret: maskSecret(settings.razorpayWebhookSecret),
      },
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } },
  );
}

const updateSchema = z.object({
  razorpayKeyId: z.string().trim().optional(),
  razorpayKeySecret: z.string().trim().optional(),
  razorpayWebhookSecret: z.string().trim().optional(),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();

  const data: { razorpayKeyId?: string | null; razorpayKeySecret?: string; razorpayWebhookSecret?: string } = {};

  // Key ID is not a secret (Razorpay exposes it client-side during checkout), so it's
  // always safe to overwrite, including clearing it out.
  if (parsed.data.razorpayKeyId !== undefined) {
    data.razorpayKeyId = parsed.data.razorpayKeyId || null;
  }

  // Only overwrite the secrets when a genuinely new value was submitted - never let a
  // masked placeholder or an empty field clear out an existing secret.
  if (!isMaskedOrEmpty(parsed.data.razorpayKeySecret)) {
    data.razorpayKeySecret = parsed.data.razorpayKeySecret;
  }
  if (!isMaskedOrEmpty(parsed.data.razorpayWebhookSecret)) {
    data.razorpayWebhookSecret = parsed.data.razorpayWebhookSecret;
  }

  const updated = await prisma.appSettings.update({
    where: { id: settings.id },
    data,
  });

  return NextResponse.json(
    {
      settings: {
        razorpayKeyId: updated.razorpayKeyId ?? "",
        razorpayKeySecret: maskSecret(updated.razorpayKeySecret),
        razorpayWebhookSecret: maskSecret(updated.razorpayWebhookSecret),
      },
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } },
  );
}

