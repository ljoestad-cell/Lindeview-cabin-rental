import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getPrices, PriceValidationError, updatePrices } from "@/lib/prices";

export const dynamic = "force-dynamic";

/** Admin: hent gjeldende priser. */
export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  return NextResponse.json({ prices: await getPrices() });
}

/** Admin: lagre alle priser samlet. Gjelder nye bookingforespørsler – eksisterende bookinger beholder sin pris. */
export async function PUT(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  try {
    const prices = await updatePrices(body as Record<string, unknown>);
    return NextResponse.json({ prices });
  } catch (err) {
    if (err instanceof PriceValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/admin/prices]", err);
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
