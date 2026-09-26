import { CLEANING_FEE, MIN_NIGHTS, NIGHTLY_RATE, SEASON_LABEL } from "@/lib/config";
import { formatEur } from "@/lib/pricing";

const FACTS = [
  { label: "Pris", value: `${formatEur(NIGHTLY_RATE)} per natt` },
  { label: "Minimum opphold", value: `${MIN_NIGHTS} netter` },
  { label: "Rengjøringsgebyr", value: formatEur(CLEANING_FEE) },
  { label: "Fiskekort", value: "Inkludert" },
  { label: "Sesong", value: SEASON_LABEL },
];

export default function StayFacts() {
  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <p className="text-sm font-medium text-foreground">Godt å vite</p>
      <ul className="mt-3 divide-y divide-line">
        {FACTS.map((fact) => (
          <li key={fact.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="text-muted">{fact.label}</span>
            <span className="font-medium text-foreground">{fact.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
