import { NextResponse, type NextRequest } from "next/server";
import { anonymizeExpiredBookings, runDueCharges } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * Kalles daglig av Vercel Cron (se vercel.json). Belaster hovedbeløp som har
 * forfalt (CHARGE_DAYS_BEFORE_CHECKIN dager før innsjekk) og reserverer
 * depositum for bookinger som har nådd utsjekksdagen. Anonymiserer også
 * bookinger der oppbevaringstiden for personopplysninger er ute.
 *
 * Vercel setter automatisk `Authorization: Bearer <CRON_SECRET>` når den
 * kaller ruten, forutsatt at CRON_SECRET er satt i miljøvariablene.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET mangler." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Uautorisert." }, { status: 401 });
  }

  const result = await runDueCharges();
  const anonymized = await anonymizeExpiredBookings();
  return NextResponse.json({ ...result, anonymized });
}
