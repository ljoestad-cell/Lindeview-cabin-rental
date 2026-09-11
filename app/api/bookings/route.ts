import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { BookingValidationError, listForAdmin, requestBooking } from "@/lib/bookings";
import type { BookingRequestInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function isRequestInputShape(value: unknown): value is BookingRequestInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.checkIn === "string" &&
    typeof v.checkOut === "string" &&
    typeof v.guests === "number" &&
    typeof v.name === "string" &&
    typeof v.email === "string" &&
    typeof v.phone === "string" &&
    (v.message === undefined || typeof v.message === "string")
  );
}

/** Offentlig: gjester sender inn en bookingforespørsel. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  if (!isRequestInputShape(body)) {
    return NextResponse.json({ error: "Mangler felter i forespørselen." }, { status: 400 });
  }

  try {
    const booking = await requestBooking({ ...body, message: body.message ?? "" });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      const conflict = err.message.includes("allerede booket");
      return NextResponse.json({ error: err.message }, { status: conflict ? 409 : 400 });
    }
    console.error("[api/bookings] Uventet feil:", err);
    return NextResponse.json({ error: "Noe gikk galt. Prøv igjen." }, { status: 500 });
  }
}

/** Kun admin: liste over alle bookinger. */
export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const bookings = await listForAdmin();
  return NextResponse.json({ bookings });
}
