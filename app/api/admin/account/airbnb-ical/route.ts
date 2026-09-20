import { NextResponse, type NextRequest } from "next/server";
import { AccountValidationError, updateAirbnbIcalUrl } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin: lagre (eller fjerne, med tom streng) Airbnb sin iCal-eksport-URL. */
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

  const { url } = body as { url?: unknown };
  if (typeof url !== "string") {
    return NextResponse.json({ error: "url er påkrevd." }, { status: 400 });
  }

  try {
    const account = await updateAirbnbIcalUrl(url);
    return NextResponse.json({ account });
  } catch (err) {
    if (err instanceof AccountValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/admin/account/airbnb-ical]", err);
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
