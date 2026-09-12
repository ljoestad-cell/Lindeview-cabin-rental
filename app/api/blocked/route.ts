import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { addBlockedRange, BookingValidationError, listBlockedRanges } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: liste over manuelt blokkerte perioder. */
export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const ranges = await listBlockedRanges();
  return NextResponse.json({ ranges });
}

/** Admin: blokker en ny periode (eget bruk, vedlikehold o.l.). */
export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { start, end, reason } = body as { start?: unknown; end?: unknown; reason?: unknown };
  if (typeof start !== "string" || typeof end !== "string") {
    return NextResponse.json({ error: "start og end er påkrevd." }, { status: 400 });
  }

  try {
    const range = await addBlockedRange(start, end, typeof reason === "string" ? reason : "");
    return NextResponse.json({ range }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      const conflict = err.message.includes("overlapper");
      return NextResponse.json({ error: err.message }, { status: conflict ? 409 : 400 });
    }
    console.error("[api/blocked] Uventet feil:", err);
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
