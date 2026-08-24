export default function Footer() {
  return (
    <footer className="bg-brand py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 sm:flex-row sm:items-start sm:justify-between sm:px-10">
        <div>
          <p className="font-display text-2xl text-white">Lindeview</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">
            Eksklusiv villmarkshytte på Hillestadheia — stillhet, natur og høy
            standard, samlet på ett sted.
          </p>
        </div>

        <div className="flex flex-col gap-1 text-sm text-white/70">
          <p className="font-medium text-white">Kontakt</p>
          <a href="mailto:post@lindeview.no" className="hover:text-white">
            post@lindeview.no
          </a>
          <a href="tel:+4700000000" className="hover:text-white">
            +47 000 00 000
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
