"use client";

import { rangesOverlap, today, toIso, type DateRange } from "@/lib/dates";

type SelectedRange = { checkIn: string | null; checkOut: string | null };

type Props = {
  season: { start: string; end: string };
  minNights: number;
  blocked: DateRange[];
  tentative: DateRange[];
  value: SelectedRange;
  onChange: (value: SelectedRange) => void;
};

const WEEKDAY_LABELS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];
const MONTH_LABELS = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

/** Måneder (år, 0-indeksert måned) mellom season.start og season.end (eksklusiv). */
function monthsInSeason(season: { start: string; end: string }): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let cursor = `${season.start.slice(0, 7)}-01`;
  while (cursor < season.end) {
    const [year, month] = cursor.split("-").map(Number);
    out.push({ year, month: month - 1 });
    cursor = toIso(new Date(Date.UTC(year, month, 1)));
  }
  return out;
}

/** Én kalenderrute (mandag–søndag) for en måned. `null` = utenfor måneden. */
function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay(): 0 = søndag. Vi vil ha mandag først.
  const leadingBlanks = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(Date.UTC(year, month, i + 1)))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function isBlocked(iso: string, ranges: DateRange[]): boolean {
  return ranges.some((r) => iso >= r.start && iso < r.end);
}

function hasBlockedWithin(range: DateRange, blocked: DateRange[]): boolean {
  return blocked.some((b) => rangesOverlap(range, b));
}

export default function BookingCalendar({ season, minNights, blocked, tentative, value, onChange }: Props) {
  const minDate = today() > season.start ? today() : season.start;

  function handleClick(iso: string) {
    const { checkIn, checkOut } = value;

    if (!checkIn || checkOut) {
      onChange({ checkIn: iso, checkOut: null });
      return;
    }

    if (iso <= checkIn) {
      onChange({ checkIn: iso, checkOut: null });
      return;
    }

    if (hasBlockedWithin({ start: checkIn, end: iso }, blocked)) {
      // Spenner over en opptatt periode – start på nytt fra denne datoen.
      onChange({ checkIn: iso, checkOut: null });
      return;
    }

    onChange({ checkIn, checkOut: iso });
  }

  function dayState(iso: string): "disabled" | "selected" | "in-range" | "tentative" | "available" {
    const { checkIn, checkOut } = value;
    if (checkIn && checkOut && iso >= checkIn && iso < checkOut) return "in-range";
    if (iso === checkIn || iso === checkOut) return "selected";

    if (iso < minDate || iso >= season.end) return "disabled";
    if (isBlocked(iso, blocked)) return "disabled";

    // Under valg av utsjekk: deaktiver datoer som bryter minimumsopphold.
    if (checkIn && !checkOut) {
      if (iso <= checkIn) return "disabled";
      const nights = (Date.parse(iso) - Date.parse(checkIn)) / 86_400_000;
      if (nights < minNights) return "disabled";
      if (hasBlockedWithin({ start: checkIn, end: iso }, blocked)) return "disabled";
    }

    if (isBlocked(iso, tentative)) return "tentative";
    return "available";
  }

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {monthsInSeason(season).map(({ year, month }) => (
          <div key={`${year}-${month}`} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-center font-display text-lg text-brand">
              {MONTH_LABELS[month]} {year}
            </p>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildMonthGrid(year, month).flatMap((week, wi) =>
                week.map((iso, di) => {
                  if (!iso) return <span key={`${wi}-${di}`} />;
                  const state = dayState(iso);
                  const day = Number(iso.slice(8, 10));
                  const base = "flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors";
                  const styles: Record<string, string> = {
                    disabled: "cursor-not-allowed text-muted/40 line-through",
                    selected: "bg-accent text-white font-semibold",
                    "in-range": "bg-accent/35 font-medium text-brand",
                    tentative: "bg-brand/10 text-muted",
                    available: "text-foreground hover:bg-brand/10 cursor-pointer",
                  };
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={state === "disabled"}
                      onClick={() => handleClick(iso)}
                      className={`${base} ${styles[state]}`}
                      aria-pressed={state === "selected" || state === "in-range"}
                      title={state === "tentative" ? "Under vurdering – kan fortsatt bookes" : undefined}
                    >
                      {day}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-accent" /> Valgt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand/10" /> Forespørsel under vurdering
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-muted/30" /> Ikke tilgjengelig
        </span>
      </div>
    </div>
  );
}
