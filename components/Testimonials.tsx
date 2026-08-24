import { Star } from "lucide-react";

const reviews = [
  {
    quote:
      "Helt magisk beliggenhet — vi så knapt et annet menneske på tre dager. Kjøkkenet er i en klasse for seg selv.",
    name: "Kari H.",
    context: "Familietur, sommer",
  },
  {
    quote:
      "Padlet ut fra vannet rett nedenfor hytta hver morgen. Fiskekortet som fulgte med var en kjempefin bonus.",
    name: "Erik S.",
    context: "Venneturer, høst",
  },
  {
    quote:
      "Vi kom for turstiene og ble for utsikten. Standarden på hytta overgikk alt vi hadde forventet.",
    name: "Ingrid & Thomas",
    context: "Par, vinter",
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Gjestene
        </p>
        <h2 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
          Det gjestene sier
        </h2>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-3">
        {reviews.map((review) => (
          <figure
            key={review.name}
            className="rounded-2xl bg-surface p-8 ring-1 ring-line"
          >
            <div className="flex gap-1 text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" strokeWidth={0} />
              ))}
            </div>
            <blockquote className="mt-5 text-base leading-relaxed text-foreground">
              &ldquo;{review.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 text-sm text-muted">
              <span className="font-medium text-foreground">{review.name}</span>
              {" · "}
              {review.context}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">
        Eksempelomtaler — erstattes med ekte gjesteomtaler etter hvert som de
        kommer inn.
      </p>
    </section>
  );
}
