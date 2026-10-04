import { NextResponse, type NextRequest } from "next/server";
import { BookingValidationError, getBookingByGuestToken, requestCancellation } from "@/lib/bookings";
import { CANCELLATION_MESSAGE_MAX } from "@/lib/config";
import { isBlocked, isRateLimited, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Gjest («Min booking»): be om avbestilling. Eieren varsles og avbestiller selv i admin. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/guest/[token]/cancel-request">) {
  if (await isBlocked("guestToken", request)) {
    return NextResponse.json({ error: "For mange forsøk. Prøv igjen senere." }, { status: 429 });
  }
  const { token } = await ctx.params;
  const booking = await getBookingByGuestToken(token);
  if (!booking) {
    await recordFailure("guestToken", request);
    return NextResponse.json({ error: "Fant ikke bookingen." }, { status: 404 });
  }
  if (await isRateLimited("guestAction", request)) {
    return NextResponse.json({ error: "For mange forsøk. Prøv igjen om en time, eller kontakt oss." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  const raw = (body as { message?: unknown })?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (message.length > CANCELLATION_MESSAGE_MAX) {
    return NextResponse.json({ error: `Meldingen kan være maks ${CANCELLATION_MESSAGE_MAX} tegn.` }, { status: 400 });
  }

  try {
    const updated = await requestCancellation(booking, message);
    return NextResponse.json({ requestedAt: updated.cancellationRequest?.requestedAt });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
