import { formatNok, quote } from "@/lib/pricing";

type Props = {
  checkIn: string | null;
  checkOut: string | null;
};

export default function PriceSummary({ checkIn, checkOut }: Props) {
  if (!checkIn || !checkOut) {
    return (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-sm text-muted">
          Velg innsjekk og utsjekk i kalenderen for å se pris.
        </p>
      </div>
    );
  }

  const { nights, nightlyRate, nightsTotal, cleaningFee, total } = quote(checkIn, checkOut);

  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">
            {nights} {nights === 1 ? "natt" : "netter"} × {formatNok(nightlyRate)}
          </dt>
          <dd className="font-medium text-foreground">{formatNok(nightsTotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Rengjøringsgebyr</dt>
          <dd className="font-medium text-foreground">{formatNok(cleaningFee)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3 text-base">
          <dt className="font-display text-brand">Totalt</dt>
          <dd className="font-display text-lg text-brand">{formatNok(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
