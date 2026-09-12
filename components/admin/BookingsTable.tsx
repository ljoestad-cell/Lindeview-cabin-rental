"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/lib/pricing";
import type { Booking, BookingStatus } from "@/lib/types";
import PaymentPanel from "@/components/admin/PaymentPanel";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Venter",
  confirmed: "Bekreftet",
  declined: "Avslått",
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-accent/15 text-accent-dark",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-700",
};

export default function BookingsTable({ initialBookings }: { initialBookings: Booking[] }) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(id: string, status: "confirmed" | "declined") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke oppdatere bookingen.");
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Slette denne bookingen permanent?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Kunne ikke slette bookingen.");
        return;
      }
      setBookings((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  if (bookings.length === 0) {
    return (
      <div>
        <TopBar onLogout={logout} />
        <p className="mt-10 text-muted">Ingen bookingforespørsler ennå.</p>
      </div>
    );
  }

  return (
    <div>
      <TopBar onLogout={logout} />
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
                <p className="mt-2 font-display text-lg text-brand">
                  {b.checkIn} → {b.checkOut} · {b.nights} netter
                </p>
                <p className="text-sm text-muted">
                  {b.name} · {b.email} · {b.phone} · {b.guests} gjester
                </p>
                {b.message && <p className="mt-2 text-sm text-foreground">«{b.message}»</p>}
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatEur(b.pricing.total)} totalt
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {b.status === "pending" && (
                  <>
                    <ActionButton
                      onClick={() => updateStatus(b.id, "confirmed")}
                      disabled={busyId === b.id}
                      variant="primary"
                    >
                      Bekreft
                    </ActionButton>
                    <ActionButton
                      onClick={() => updateStatus(b.id, "declined")}
                      disabled={busyId === b.id}
                    >
                      Avslå
                    </ActionButton>
                  </>
                )}
                {b.status === "confirmed" && (
                  <ActionButton onClick={() => updateStatus(b.id, "declined")} disabled={busyId === b.id}>
                    Avbestill
                  </ActionButton>
                )}
                <ActionButton onClick={() => remove(b.id)} disabled={busyId === b.id} variant="danger">
                  Slett
                </ActionButton>
              </div>
            </div>

            {b.status === "confirmed" && (
              <PaymentPanel
                booking={b}
                onUpdate={(updated) => setBookings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBar({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted">Klikk Bekreft eller Avslå for å behandle en forespørsel.</p>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-full border border-line px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
      >
        Logg ut
      </button>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  const styles = {
    default: "border border-line text-brand hover:bg-brand/5",
    primary: "bg-accent text-white hover:bg-accent-dark",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
