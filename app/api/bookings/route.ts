import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { BookingValidationError, listForAdmin, requestBooking } from "@/lib/bookings";
import { DEFAULT_EXTRAS, type BookingExtras } from "@/lib/pricing";
import { isRateLimited } from "@/lib/rate-limit";
import type { BookingRequestInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function isExtrasShape(value: unknown): value is BookingExtras {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.evChargers === "number" && typeof v.pets === "number" && typeof v.bedding === "number";
}

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
    (v.message === undefined || typeof v.message === "string") &&
    (v.extras === undefined || isExtrasShape(v.extras)) &&
    typeof v.acceptedTerms === "boolean"
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

  // Honeypot: feltet er skjult for mennesker, men fylles ut av enkle bots.
  // Svar som om alt gikk bra, så boten ikke lærer noe – men lagre ingenting.
  if (typeof (body as { website?: unknown })?.website === "string" && (body as { website: string }).website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (await isRateLimited("booking", request)) {
    return NextResponse.json(
      { error: "For mange forespørsler fra denne tilkoblingen. Prøv igjen om en time, eller ring oss." },
      { status: 429 },
    );
  }

  if (!isRequestInputShape(body)) {
    return NextResponse.json({ error: "Mangler felter i forespørselen." }, { status: 400 });
  }

  try {
    const booking = await requestBooking({
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      guests: body.guests,
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message ?? "",
      extras: body.extras ?? DEFAULT_EXTRAS,
      acceptedTerms: body.acceptedTerms,
    });
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
