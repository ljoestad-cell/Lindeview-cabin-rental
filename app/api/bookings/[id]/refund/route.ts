import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { BookingValidationError, refundCharge } from "@/lib/bookings";
import { REFUND_REASON_MAX } from "@/lib/config";

export const dynamic = "force-dynamic";

const VALID_TARGETS = new Set(["main", "deposit", "extra"]);

/** Admin: tilbakefør hele eller deler av en belastning (hovedbeløp, trukket depositum eller tilleggsbeløp). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/refund">) {
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

  const { target, extraChargeId, amount, reason } = body as {
    target?: unknown;
    extraChargeId?: unknown;
    amount?: unknown;
    reason?: unknown;
  };
  if (typeof target !== "string" || !VALID_TARGETS.has(target)) {
    return NextResponse.json({ error: "target må være 'main', 'deposit' eller 'extra'." }, { status: 400 });
  }
  if (target === "extra" && (typeof extraChargeId !== "string" || !extraChargeId)) {
    return NextResponse.json({ error: "extraChargeId mangler." }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount må være et positivt tall." }, { status: 400 });
  }
  const refundReason = typeof reason === "string" ? reason.trim() : "";
  if (!refundReason) {
    return NextResponse.json({ error: "Skriv hvorfor beløpet refunderes." }, { status: 400 });
  }
  if (refundReason.length > REFUND_REASON_MAX) {
    return NextResponse.json({ error: `Begrunnelsen kan være maks ${REFUND_REASON_MAX} tegn.` }, { status: 400 });
  }

  try {
    const updated = await refundCharge(
      id,
      target as "main" | "deposit" | "extra",
      target === "extra" ? (extraChargeId as string) : null,
      Math.round(amount * 100) / 100,
      refundReason,
    );
    if (!updated) return NextResponse.json({ error: "Fant ikke booking." }, { status: 404 });
    return NextResponse.json({ booking: updated });
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
