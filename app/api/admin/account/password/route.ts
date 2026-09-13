import { NextResponse, type NextRequest } from "next/server";
import { changePassword } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin: bytt passord. Krever gjeldende passord. */
export async function POST(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body as { currentPassword?: unknown; newPassword?: unknown };
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "currentPassword og newPassword er påkrevd." }, { status: 400 });
  }

  try {
    const result = await changePassword(currentPassword, newPassword);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/account/password]", err);
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
