import { NextResponse } from "next/server";

import { resend } from "@/lib/resend";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      businessName,
      contactPerson,
      mobile,
      city,
      numberOfStores,
      subscriptionRequired,
      address,
      description,
    } = body;

    if (!businessName || !contactPerson || !mobile || !city || !description) {
      return NextResponse.json(
        { error: "Please fill all required fields" },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { error: "Please enter valid 10 digit mobile number" },
        { status: 400 },
      );
    }

    try {
      await resend.emails.send({
        from: `sczor <${process.env.RESEND_FROM_EMAIL ?? "noreply@sczor.com"}>`,
        to: "connect@droletechnologies.com",
        subject: `New Enquiry: ${businessName}`,
        html: `
          <h2>New Salon Enquiry</h2>
          <p><b>Business Name:</b> ${escapeHtml(businessName)}</p>
          <p><b>Contact Person:</b> ${escapeHtml(contactPerson)}</p>
          <p><b>Mobile:</b> ${escapeHtml(mobile)}</p>
          <p><b>City:</b> ${escapeHtml(city)}</p>
          <p><b>Number of Stores:</b> ${escapeHtml(numberOfStores)}</p>
          <p><b>Subscription Interested:</b> ${escapeHtml(subscriptionRequired)}</p>
          <p><b>Address:</b> ${escapeHtml(address) || "Not provided"}</p>
          <p><b>Message:</b></p>
          <p>${escapeHtml(description)}</p>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send contact enquiry email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Enquiry received successfully",
    });
  } catch (error) {
    console.error("Contact enquiry error", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
