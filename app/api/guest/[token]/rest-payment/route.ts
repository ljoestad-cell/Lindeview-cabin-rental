import { NextResponse, type NextRequest } from "next/server";
import { BookingValidationError, getBookingByGuestToken, startGuestRestPayment } from "@/lib/bookings";
import { isBlocked, isRateLimited, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Gjest («Min booking»): lag en Stripe-lenke for å betale resten etter et feilet trekk. Sikret av token + rate limit. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/guest/[token]/rest-payment">) {
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

  try {
    const url = await startGuestRestPayment(booking);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[guest] Kunne ikke lage betalingslenke for resten:", err);
    return NextResponse.json({ error: "Kunne ikke åpne betalingssiden – prøv igjen, eller kontakt oss." }, { status: 500 });
  }
}
