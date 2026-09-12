import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { retryMainCharge } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: "Belast nå" / "Prøv igjen" for hovedbeløpet. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/charge">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const updated = await retryMainCharge(id);
  if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
