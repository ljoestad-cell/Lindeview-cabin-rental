import { Star } from "lucide-react";

const reviews = [
  {
    quote:
      "Vi bodde i boligen i 12 dager sommeren 2025 med to familier. Huset, utsikten og roen var helt fantastisk. Vi følte oss veldig komfortable. Innredningen på overnattingsstedet er svært god! Separat toalett, fire soverom og vakre stuemøbler. Vi gikk ikke glipp av noe på kjøkkenet heller. Fra brødristeren til grillen til vaffeljernet – alt er tilgjengelig. Området inviterer deg til å gå turer, gå og fiske. Vi gir fem stjerner til alt og en stor takk til vertene våre!",
    name: "Ronny",
    context: "Familietur, sommer 2025",
  },
  {
    quote:
      "Vi hadde et herlig opphold her. Beliggenheten er vakker. Det er andre hytter i nærheten, men det føles fortsatt fantastisk avsidesliggende fordi du kan gå rett ut av huset og inn i naturen, med flere nydelige turstier som starter rett ved døren. Og utsikten er selvfølgelig fantastisk. Selve huset er moderne, komfortabelt og veldig godt utstyrt. Virkelig alt du trenger, fra en vaskemaskin til til og med en kakeform! Vi elsket den komfortable sofaen, og det var rikelig med steder rundt i huset hvor vi kunne sitte ute og nyte solen hele dagen. Vi bodde her om sommeren og elsket absolutt naturen og fotturene.",
    name: "Sietske",
    context: "Venneturer, sommer 2026",
  },
  {
    quote:
      "Vi var i Mortens vakre hus i 10 dager. Huset er veldig stort, og vi manglet ingenting – alt var tilgjengelig i tilstrekkelige mengder. Et nydelig turområde ligger rett utenfor døren, så vi kunne ta noen flotte turer. Hvis du vil kjøre litt lenger, kan du besøke de vakre kystbyene. Vi likte Grimstad veldig godt. Det er også bra at det er to store kjøleskap i huset, slik at man kan lagre nok mat. Vi nøt hver dag og hadde en flott ferie.",
    name: "Kerstin",
    context: "Ferie, sommer 2026",
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
      <p className="mt-2 text-sm text-muted">
        Lindeview er også markedsført på{" "}
        <a
          href="https://www.airbnb.no/rooms/942451723603454434?check_in=2027-06-07&check_out=2027-06-14&search_mode=regular_search&source_impression_id=p3_2bf6ca12-64c2-479b-9cb4-fff11ce2dbc8_6504dc59-f263-45c0-90b5-277658082ca4_0_942451723603454434_0&previous_page_section_name=1000&federated_search_id=2bf6ca12-64c2-479b-9cb4-fff11ce2dbc8"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent underline hover:text-accent-dark"
        >
          Airbnb
        </a>
        , der du finner flere uavhengige omtaler.
      </p>
    </section>
  );
}
