"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { PROPERTY_NAME } from "@/lib/property";

const links = [
  { anchor: "om", label: "Om hytta" },
  { anchor: "fasiliteter", label: "Fasiliteter" },
  { anchor: "aktiviteter", label: "Aktiviteter" },
  { anchor: "galleri", label: "Galleri" },
];

/**
 * Forsiden har menyen over et mørkt hero-bilde (hvit tekst, ankerlenker).
 * Undersidene (/book, /vilkar, /personvern) har lys bakgrunn, så der brukes
 * mørk tekst, og ankrene peker tilbake til forsiden.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const onBookPage = pathname.startsWith("/book");

  const href = (anchor: string) => (isHome ? `#${anchor}` : `/#${anchor}`);
  const text = isHome ? "text-white" : "text-brand";
  const linkText = isHome ? "text-white/85 hover:text-white" : "text-muted hover:text-brand";
  const iconHover = isHome ? "hover:bg-white/10" : "hover:bg-brand/5";

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <Link href={isHome ? "#" : "/"} className={`font-display text-2xl tracking-wide ${text}`}>
          {PROPERTY_NAME}
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.anchor}
              href={href(link.anchor)}
              className={`text-sm font-medium transition-colors ${linkText}`}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!onBookPage && (
            <a
              href={isHome ? "#bestill" : "/book"}
              className="rounded-full bg-accent px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark sm:px-5 sm:text-sm"
            >
              Sjekk tilgjengelighet
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Lukk meny" : "Åpne meny"}
            className={`rounded-full p-2 transition-colors md:hidden ${text} ${iconHover}`}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="mx-4 mb-4 rounded-2xl bg-brand p-2 shadow-xl md:hidden">
          {links.map((link) => (
            <a
              key={link.anchor}
              href={href(link.anchor)}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
