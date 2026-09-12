import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { addExtraCharge } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: trekk et tilleggsbeløp (skade, ekstra tjenester) fra det lagrede kortet. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/extra-charge">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { amount, description } = body as { amount?: unknown; description?: unknown };
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount må være et positivt tall." }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description mangler." }, { status: 400 });
  }

  const updated = await addExtraCharge(id, amount, description.trim());
  if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
