import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/bookings";

// Aldri cache – tilgjengelighet må alltid være ferskt.
export const dynamic = "force-dynamic";

export async function GET() {
  const availability = await getAvailability();
  return NextResponse.json(availability);
}
