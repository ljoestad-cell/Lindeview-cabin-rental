import { formatEur } from "@/lib/pricing";

type Props = {
  label: string;
  description: string;
  pricePerUnit: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
};

export default function QuantityField({ label, description, pricePerUnit, max, value, onChange }: Props) {
  function clamp(next: number) {
    onChange(Math.max(0, Math.min(max, next)));
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted">
          {description} · {formatEur(pricePerUnit)} pr. booking
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => clamp(value - 1)}
          disabled={value <= 0}
          aria-label={`Færre – ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-4 text-center text-sm font-semibold text-foreground">{value}</span>
        <button
          type="button"
          onClick={() => clamp(value + 1)}
          disabled={value >= max}
          aria-label={`Flere – ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
