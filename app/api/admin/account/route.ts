import { NextResponse, type NextRequest } from "next/server";
import { AccountValidationError, getAccount, updateProfile } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin: hent profilinfo (aldri passordhash). */
export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  const account = await getAccount();
  return NextResponse.json({ account });
}

/** Admin: oppdater navn og e-post. */
export async function PATCH(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { name, email } = body as { name?: unknown; email?: unknown };
  if (typeof name !== "string" || typeof email !== "string") {
    return NextResponse.json({ error: "name og email er påkrevd." }, { status: 400 });
  }

  try {
    const account = await updateProfile(name, email);
    return NextResponse.json({ account });
  } catch (err) {
    if (err instanceof AccountValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/admin/account]", err);
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
