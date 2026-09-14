export default function Footer() {
  return (
    <footer className="bg-brand py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 sm:flex-row sm:items-start sm:justify-between sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="font-display text-2xl text-white">Lindeview</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">
              Eksklusiv villmarkshytte på Hillestadheia — stillhet, natur og høy
              standard, samlet på ett sted.
            </p>
          </div>
          <div className="h-56 w-80 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
            <iframe
              src="https://www.google.com/maps?q=Kringeltj%C3%B8nn%2C+D%C3%B8lemo&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Kart over Kringeltjønn, Dølemo"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm text-white/70">
          <p className="font-medium text-white">Kontakt</p>
          <p>Morten Ljøstad</p>
          <a href="mailto:post@lindeview.no" className="hover:text-white">
            post@lindeview.no
          </a>
          <a href="tel:+4790591820" className="hover:text-white">
            +47 90 59 18 20
          </a>
          <p>Hillestadheia</p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 px-6 pt-6 text-xs text-white/40 sm:px-10">
        © {new Date().getFullYear()} Lindeview. Alle rettigheter forbeholdt.
      </div>
    </footer>
  );
}
