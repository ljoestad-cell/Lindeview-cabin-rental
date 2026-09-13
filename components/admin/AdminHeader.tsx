"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
      <nav className="flex gap-5 text-sm font-medium">
        <Link
          href="/admin"
          className={pathname === "/admin" ? "text-brand" : "text-muted hover:text-brand"}
        >
          Kalender og bookinger
        </Link>
        <Link
          href="/admin/account"
          className={pathname === "/admin/account" ? "text-brand" : "text-muted hover:text-brand"}
        >
          Min konto
        </Link>
      </nav>
      <button
        type="button"
        onClick={logout}
        className="rounded-full border border-line px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
      >
        Logg ut
      </button>
    </div>
  );
}
