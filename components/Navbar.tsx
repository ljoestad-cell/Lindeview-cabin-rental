const links = [
  { href: "#om", label: "Om hytta" },
  { href: "#fasiliteter", label: "Fasiliteter" },
  { href: "#aktiviteter", label: "Aktiviteter" },
  { href: "#galleri", label: "Galleri" },
];

export default function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
        <a
          href="#"
          className="font-display text-2xl tracking-wide text-white"
        >
          Lindeview
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
        <a
          href="#bestill"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
        >
          Sjekk tilgjengelighet
        </a>
      </nav>
    </header>
  );
}
