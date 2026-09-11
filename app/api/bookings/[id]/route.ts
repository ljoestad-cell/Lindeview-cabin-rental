import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { deleteBooking, setStatus } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["confirmed", "declined"]);

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) {
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

  const status = (body as { status?: unknown })?.status;
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Status må være 'confirmed' eller 'declined'." }, { status: 400 });
  }

  const updated = await setStatus(id, status as "confirmed" | "declined");
  if (!updated) {
    return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
  }
  return NextResponse.json({ booking: updated });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;
  await deleteBooking(id);
  return NextResponse.json({ ok: true });
}
