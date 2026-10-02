import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { BookingValidationError, resendApprovalEmail } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: sender e-posten med betalingslenken til gjesten (på nytt) – f.eks. etter «Generer ny lenke». */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/guest-email">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    const updated = await resendApprovalEmail(id);
    if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
    return NextResponse.json({ booking: updated });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/bookings/[id]/guest-email]", err);
    const message = err instanceof Error ? err.message : "Ukjent feil.";
    return NextResponse.json({ error: `Kunne ikke sende e-post: ${message}` }, { status: 502 });
  }
}
