import { CHARGE_DAYS_BEFORE_CHECKIN, DEPOSIT_AMOUNT } from "@/lib/config";
import { formatEur } from "@/lib/pricing";

export default function PaymentNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-background p-5 text-sm text-muted">
      <p className="font-medium text-foreground">Betaling</p>
      <p className="mt-1">
        Du betaler ingenting nå. Når forespørselen din er bekreftet, får du en
        sikker lenke for å registrere en betalingsmetode. Hovedbeløpet
        trekkes automatisk {CHARGE_DAYS_BEFORE_CHECKIN} dager før innsjekk. I
        tillegg reserveres et depositum på {formatEur(DEPOSIT_AMOUNT)} ved
        utsjekk, og frigis normalt innen noen dager hvis alt er i orden.
      </p>
    </div>
  );
}
