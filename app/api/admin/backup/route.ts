import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { bookingsToCsv, buildBackup } from "@/lib/backup";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Admin: last ned sikkerhetskopi. `?format=csv` gir bare bookingene som regneark, ellers alt som JSON. */
export async function GET(request: NextRequest) {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  const backup = await buildBackup();
  const stamp = today();

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(bookingsToCsv(backup.bookings), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lindeview-bookinger-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lindeview-sikkerhetskopi-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
