import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Stub for betalingsleverandørens webhook. Ingen leverandør er koblet til
 * ennå (se lib/payments.ts) – ruten svarer 501 til det er på plass, slik at
 * et tidlig oppsett hos leverandøren feiler synlig i stedet for stille.
 */
export async function POST(request: NextRequest) {
  const result = await getPaymentProvider().verifyWebhook(request);
  if (result.status === "not_configured") {
    return NextResponse.json({ error: "Betalingsløsning er ikke koblet til ennå." }, { status: 501 });
  }
  return NextResponse.json({ ok: true });
}
