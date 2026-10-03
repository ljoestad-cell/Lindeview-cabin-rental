import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { AccountValidationError, confirmMfaSetup, disableMfa, startMfaSetup } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";
import { isBlocked, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function errorResponse(err: unknown, context: string, request?: NextRequest) {
  if (err instanceof AccountValidationError) {
    // Feil kode/passord teller mot grensen for kodeforsøk.
    if (request) await recordFailure("mfa", request);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(`[api/admin/account/mfa] ${context}`, err);
  return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
}

/** Steg 1: ny hemmelighet + QR-kode (som bilde, så otpauth-lenken aldri trenger et eksternt bibliotek i nettleseren). */
export async function POST() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  try {
    const { secret, uri } = await startMfaSetup();
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
    return NextResponse.json({ secret, qrDataUrl });
  } catch (err) {
    return errorResponse(err, "start");
  }
}

/** Steg 2: bekreft med koden fra appen – slår på MFA og returnerer reservekodene (én gang). */
export async function PUT(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  if (await isBlocked("mfa", request)) {
    return NextResponse.json({ error: "For mange forsøk. Vent et kvarter og prøv igjen." }, { status: 429 });
  }
  const body = await readJson(request);
  if (typeof body?.code !== "string") {
    return NextResponse.json({ error: "Kode mangler." }, { status: 400 });
  }
  try {
    return NextResponse.json(await confirmMfaSetup(body.code));
  } catch (err) {
    return errorResponse(err, "bekreft", request);
  }
}

/** Slå av MFA – krever passord og gyldig kode, så en glemt innlogget fane ikke er nok. */
export async function DELETE(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  if (await isBlocked("mfa", request)) {
    return NextResponse.json({ error: "For mange forsøk. Vent et kvarter og prøv igjen." }, { status: 429 });
  }
  const body = await readJson(request);
  if (typeof body?.password !== "string" || typeof body?.code !== "string") {
    return NextResponse.json({ error: "Passord og kode er påkrevd." }, { status: 400 });
  }
  try {
    const account = await disableMfa(body.password, body.code);
    return NextResponse.json({ account });
  } catch (err) {
    return errorResponse(err, "slå av", request);
  }
}
