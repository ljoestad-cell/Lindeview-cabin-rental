import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { regeneratePaymentLink } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: (re)genererer secure-card-lenken – for sen bestilling eller en utløpt lenke. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/payment-link">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const updated = await regeneratePaymentLink(id);
  if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
