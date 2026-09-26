import { JWT } from "google-auth-library";
import type { DateRange } from "@/lib/dates";
import { PROPERTY_NAME } from "@/lib/property";
import type { Booking } from "@/lib/types";

/**
 * Google Calendar-integrasjon via en service-konto (ingen innlogging for
 * eieren – kalenderen deles med service-kontoens e-postadresse i Google
 * Calendar sine delingsinnstillinger).
 *
 * Så lenge GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL /
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ikke er satt, gjør alle funksjonene
 * ingenting (eller returnerer tomt) i stedet for å kaste – resten av
 * bookingflyten fungerer helt uavhengig av Google-oppsettet, akkurat som
 * betalingsløsningen. Koble til senere ved å sette miljøvariablene.
 */

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type GoogleConfig = {
  calendarId: string;
  email: string;
  privateKey: string;
};

function getConfig(): GoogleConfig | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!calendarId || !email || !rawKey) return null;
  // Private-nøkkelen lagres ofte i env med escapede linjeskift ("\n" som tekst).
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return { calendarId, email, privateKey };
}

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.info(
    "[calendar] Google Calendar er ikke konfigurert (mangler GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY). Bookinger lagres uten kalendersynk.",
  );
}

let client: JWT | null = null;
function getClient(config: GoogleConfig): JWT {
  if (!client) {
    client = new JWT({
      email: config.email,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }
  return client;
}

/** Henter opptatte perioder fra Google Calendar. Tom liste hvis ikke konfigurert. */
export async function getBusyRanges(window: DateRange): Promise<DateRange[]> {
  const config = getConfig();
  if (!config) {
    warnNotConfigured();
    return [];
  }

  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events`);
  url.searchParams.set("timeMin", `${window.start}T00:00:00Z`);
  url.searchParams.set("timeMax", `${window.end}T00:00:00Z`);
  url.searchParams.set("singleEvents", "true");

  const res = await getClient(config).request<{
    items?: { start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string } }[];
  }>({ url: url.toString(), method: "GET" });

  return (res.data.items ?? [])
    .map((event) => {
      const start = event.start?.date ?? event.start?.dateTime?.slice(0, 10);
      const end = event.end?.date ?? event.end?.dateTime?.slice(0, 10);
      if (!start || !end) return null;
      return { start, end };
    })
    .filter((range): range is DateRange => range !== null);
}

/** Oppretter eller oppdaterer kalenderhendelsen for en booking. No-op uten oppsett. */
export async function upsertEvent(booking: Booking): Promise<string | null> {
  const config = getConfig();
  if (!config) {
    warnNotConfigured();
    return null;
  }

  const body = {
    summary: `${PROPERTY_NAME} – ${booking.name} (${booking.status === "confirmed" ? "bekreftet" : "forespørsel"})`,
    description: `${booking.guests} gjester · ${booking.email} · ${booking.phone}\n\n${booking.message}`,
    start: { date: booking.checkIn },
    end: { date: booking.checkOut },
  };

  const base = `${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events`;
  const c = getClient(config);

  if (booking.calendarEventId) {
    const res = await c.request<{ id: string }>({
      url: `${base}/${booking.calendarEventId}`,
      method: "PUT",
      data: body,
    });
    return res.data.id;
  }

  const res = await c.request<{ id: string }>({ url: base, method: "POST", data: body });
  return res.data.id;
}

/** Sletter kalenderhendelsen for en booking (f.eks. ved avslag). No-op uten oppsett. */
export async function deleteEvent(booking: Booking): Promise<void> {
  const config = getConfig();
  if (!config || !booking.calendarEventId) return;

  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events/${booking.calendarEventId}`;
  await getClient(config).request({ url, method: "DELETE" });
}
