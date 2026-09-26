import { MIN_NIGHTS, SEASON_LABEL } from "@/lib/config";
import { formatEur, type Prices } from "@/lib/pricing";

export default function StayFacts({ prices }: { prices: Prices }) {
  const facts = [
    { label: "Pris", value: `${formatEur(prices.nightlyRate)} per natt` },
    { label: "Minimum opphold", value: `${MIN_NIGHTS} netter` },
    { label: "Rengjøringsgebyr", value: formatEur(prices.cleaningFee) },
    { label: "Fiskekort", value: "Inkludert" },
    { label: "Sesong", value: SEASON_LABEL },
  ];

  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <p className="text-sm font-medium text-foreground">Godt å vite</p>
      <ul className="mt-3 divide-y divide-line">
        {facts.map((fact) => (
          <li key={fact.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="text-muted">{fact.label}</span>
            <span className="font-medium text-foreground">{fact.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
