import { NextResponse, type NextRequest } from "next/server";
import { verifyMfaCode } from "@/lib/admin-account";
import { clearMfaPending, createSession, hasMfaPending } from "@/lib/auth";
import { isBlocked, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Innloggingens andre steg: kode fra autentiseringsappen, eller en reservekode. */
export async function POST(request: NextRequest) {
  if (!(await hasMfaPending())) {
    return NextResponse.json({ error: "Økten er utløpt. Skriv inn passordet på nytt.", expired: true },
      { status: 401 },);
  }
  if (await isBlocked("mfa", request)) {
    return NextResponse.json(
      { error: "For mange forsøk. Vent et kvarter og prøv igjen." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const code = (body as { code?: unknown })?.code;
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Kode mangler." }, { status: 400 });
  }

  if (!(await verifyMfaCode(code))) {
    await recordFailure("mfa", request);
    return NextResponse.json({ error: "Feil kode." }, { status: 401 });
  }

  await clearMfaPending();
  await createSession();
  return NextResponse.json({ ok: true });
}
