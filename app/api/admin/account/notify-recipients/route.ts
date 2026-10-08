import { NextResponse, type NextRequest } from "next/server";
import {
  AccountValidationError,
  addNotifyRecipient,
  removeNotifyRecipient,
  setNotifyRecipientEnabled,
  type PublicAdminAccount,
} from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Body = { email?: unknown; enabled?: unknown };

/** Felles for alle metodene: innlogging, JSON-body med e-post, og feilmeldinger admin kan lese. */
async function handle(
  request: NextRequest,
  action: (email: string, body: Body) => Promise<PublicAdminAccount>,
): Promise<NextResponse> {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  if (typeof body.email !== "string") {
    return NextResponse.json({ error: "E-postadresse mangler." }, { status: 400 });
  }

  try {
    const account = await action(body.email, body);
    return NextResponse.json({ account });
  } catch (err) {
    if (err instanceof AccountValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

/** Admin: legg til en mottaker av varsel om nye bookingforespørsler. */
export async function POST(request: NextRequest) {
  return handle(request, (email) => addNotifyRecipient(email));
}

/** Admin: skru varsel av/på for én mottaker. */
export async function PATCH(request: NextRequest) {
  return handle(request, (email, { enabled }) => {
    if (typeof enabled !== "boolean") throw new AccountValidationError("enabled må være true eller false.");
    return setNotifyRecipientEnabled(email, enabled);
  });
}

/** Admin: fjern en mottaker. */
export async function DELETE(request: NextRequest) {
  return handle(request, (email) => removeNotifyRecipient(email));
}
