export default function PaymentNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-background p-5 text-sm text-muted">
      <p className="font-medium text-foreground">Betaling</p>
      <p className="mt-1">
        Betalingsløsning kommer på plass før lansering. Du betaler ingenting nå — når
        forespørselen din er bekreftet, får du en sikker betalingslenke på e-post.
      </p>
    </div>
  );
}
