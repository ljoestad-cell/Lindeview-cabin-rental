import { NextResponse, type NextRequest } from "next/server";
import { createSession, destroySession, isCorrectPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const password = (body as { password?: unknown })?.password;
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Passord mangler." }, { status: 400 });
  }

  let correct: boolean;
  try {
    correct = await isCorrectPassword(password);
  } catch (err) {
    console.error("[api/admin/session]", err);
    return NextResponse.json(
      { error: "Admin-innlogging er ikke konfigurert (ADMIN_PASSWORD mangler)." },
      { status: 500 },
    );
  }

  if (!correct) {
    return NextResponse.json({ error: "Feil passord." }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
