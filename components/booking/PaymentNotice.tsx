import { Lock } from "lucide-react";
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
      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        <span>
          Sikker betaling via <span className="font-semibold text-[#635BFF]">Stripe</span>
        </span>
      </div>
    </div>
  );
}
