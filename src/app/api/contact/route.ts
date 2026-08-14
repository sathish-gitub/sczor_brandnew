import { NextResponse } from "next/server";

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

    console.log("New enquiry:", {
      businessName,
      contactPerson,
      mobile,
      city,
      numberOfStores,
      subscriptionRequired,
      address,
      description,
      receivedAt: new Date().toISOString(),
    });

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