import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAccount } from "@/lib/admin-account";
import { listBlockedRanges, listForAdmin } from "@/lib/bookings";
import { bookingsAndBlocksToIcsEvents, generateIcs } from "@/lib/ical";

export const dynamic = "force-dynamic";

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Offentlig, ubeskyttet av innlogging – sikret av at token er ugjettbar
 * (samme prinsipp som Airbnb selv bruker for sine kalender-URL-er). Ment til
 * å limes inn i Airbnb → Kalender → «Importer kalender».
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/ical/[token]">) {
  const { token } = await ctx.params;
  const account = await getAccount();

  if (!tokensMatch(token, account.icalExportToken)) {
    return NextResponse.json({ error: "Ikke funnet." }, { status: 404 });
  }

  const [bookings, blockedRanges] = await Promise.all([listForAdmin(), listBlockedRanges()]);
  const ics = generateIcs(bookingsAndBlocksToIcsEvents(bookings, blockedRanges));

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lindeview.ics"',
    },
  });
}
