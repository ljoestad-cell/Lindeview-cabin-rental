import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { manageDeposit } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["hold", "capture", "release"]);

/** Admin: reserver, trekk (helt/delvis) eller frigi depositumet. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/deposit">) {
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

  const { action, amount } = body as { action?: unknown; amount?: unknown };
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "action må være 'hold', 'capture' eller 'release'." }, { status: 400 });
  }
  if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
    return NextResponse.json({ error: "amount må være et positivt tall." }, { status: 400 });
  }

  const updated = await manageDeposit(id, action as "hold" | "capture" | "release", amount);
  if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
  return NextResponse.json({ booking: updated });
}
