import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { removeBlockedRange } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: fjern en manuell blokkering. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/blocked/[id]">) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const { id } = await ctx.params;
  await removeBlockedRange(id);
  return NextResponse.json({ ok: true });
}
