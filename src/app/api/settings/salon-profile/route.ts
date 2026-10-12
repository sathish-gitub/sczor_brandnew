import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  logo: z.string().optional().or(z.literal("")),
  salonName: z.string().trim().min(2, "Salon name is required."),
  tagline: z.string().optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone must be 10 digits."),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  website: z.string().trim().url("Invalid website URL.").optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().regex(/^\d{6}$|^$/, "Pincode must be 6 digits.").optional().or(z.literal("")),
  instagramUrl: z.string().optional().or(z.literal("")),
  googleReviewUrl: z.string().optional().or(z.literal("")),
});

const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

function normalizeInstagramUrl(raw: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { value: null };
  }

  const invalidMessage = "Enter a valid Instagram link (e.g. https://instagram.com/yoursalon) or handle (e.g. @yoursalon).";

  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).trim();

    if (!INSTAGRAM_HANDLE_PATTERN.test(handle)) {
      return { value: null, error: invalidMessage };
    }

    return { value: `https://instagram.com/${handle}` };
  }

  let url: URL;

  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { value: null, error: invalidMessage };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host !== "instagram.com") {
    return { value: null, error: invalidMessage };
  }

  return { value: `https://instagram.com${url.pathname}${url.search}` };
}

function normalizeGoogleReviewUrl(raw: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { value: null };
  }

  const invalidMessage = "Enter a valid Google review link starting with https://.";

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return { value: null, error: invalidMessage };
  }

  if (url.protocol !== "https:") {
    return { value: null, error: invalidMessage };
  }

  return { value: url.toString() };
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;

    const instagram = normalizeInstagramUrl(data.instagramUrl ?? "");

    if (instagram.error) {
      return NextResponse.json({ error: instagram.error }, { status: 400 });
    }

    const googleReview = normalizeGoogleReviewUrl(data.googleReviewUrl ?? "");

    if (googleReview.error) {
      return NextResponse.json({ error: googleReview.error }, { status: 400 });
    }

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        logo: data.logo || null,
        name: data.salonName,
        tagline: data.tagline || null,
        phone: data.phone,
        email: data.email || null,
        website: data.website || null,
        gstNumber: data.gstNumber || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        instagramUrl: instagram.value,
        googleReviewUrl: googleReview.value,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update salon profile", error);
    return NextResponse.json({ error: "Unable to update salon profile right now." }, { status: 500 });
  }
}
