import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { BookingValidationError, getGuestLink } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: hent gjestens «Min booking»-lenke (lages for eldre bookinger som mangler den). */
export async function POST(_request: Request, ctx: RouteContext<"/api/bookings/[id]/guest-link">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const url = await getGuestLink(id);
    if (!url) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
