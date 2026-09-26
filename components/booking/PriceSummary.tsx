import { DEFAULT_EXTRAS, formatEur, quote, type BookingExtras, type Prices } from "@/lib/pricing";

type Props = {
  prices: Prices;
  checkIn: string | null;
  checkOut: string | null;
  extras?: BookingExtras;
};

export default function PriceSummary({ prices, checkIn, checkOut, extras = DEFAULT_EXTRAS }: Props) {
  if (!checkIn || !checkOut) {
    return (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <p className="text-sm text-muted">
          Velg innsjekk og utsjekk i kalenderen for å se pris.
        </p>
      </div>
    );
  }

  const {
    nights,
    nightlyRate,
    nightsTotal,
    cleaningFee,
    evChargerTotal,
    petTotal,
    beddingTotal,
    total,
  } = quote(prices, checkIn, checkOut, extras);

  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">
            {nights} {nights === 1 ? "natt" : "netter"} × {formatEur(nightlyRate)}
          </dt>
          <dd className="font-medium text-foreground">{formatEur(nightsTotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Rengjøringsgebyr</dt>
          <dd className="font-medium text-foreground">{formatEur(cleaningFee)}</dd>
        </div>
        {extras.evChargers > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted">Lading av el-bil × {extras.evChargers}</dt>
            <dd className="font-medium text-foreground">{formatEur(evChargerTotal)}</dd>
          </div>
        )}
        {extras.pets > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted">Kjæledyr × {extras.pets}</dt>
            <dd className="font-medium text-foreground">{formatEur(petTotal)}</dd>
          </div>
        )}
        {extras.bedding > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted">Sengetøy &amp; håndklær × {extras.bedding}</dt>
            <dd className="font-medium text-foreground">{formatEur(beddingTotal)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line pt-3 text-base">
          <dt className="font-display text-brand">Totalt</dt>
          <dd className="font-display text-lg text-brand">{formatEur(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
