import { NextResponse, type NextRequest } from "next/server";
import { getAccount, updateAirbnbSyncEnabled } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";
import { syncAirbnbCalendar } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Admin: skru Airbnb-kalendersynken av/på uten å påvirke den lagrede URL-en. */
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

  const { enabled } = body as { enabled?: unknown };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled må være true eller false." }, { status: 400 });
  }

  const account = await updateAirbnbSyncEnabled(enabled);
  return NextResponse.json({ account });
}

/** Admin: tving en umiddelbar Airbnb → Lindeview-synk, i stedet for å vente på timesjobben. */
export async function POST() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  try {
    const result = await syncAirbnbCalendar();
    const account = await getAccount();
    return NextResponse.json({ ...result, account });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Synkronisering feilet." },
      { status: 500 },
    );
  }
}
