import { NextResponse, type NextRequest } from "next/server";
import { syncAirbnbCalendar } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * Kalles jevnlig av Vercel Cron (se vercel.json). Henter Airbnb sin
 * iCal-eksport og speiler reservasjonene som blokkeringer, se
 * lib/bookings.ts sin syncAirbnbCalendar(). No-op hvis eieren ikke har satt
 * opp en Airbnb-URL i «Min konto» ennå.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET mangler." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Uautorisert." }, { status: 401 });
  }

  const result = await syncAirbnbCalendar();
  return NextResponse.json(result);
}
