import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import { listBlockedRanges, listForAdmin } from "@/lib/bookings";
import AdminCalendar from "@/components/admin/AdminCalendar";
import BookingsTable from "@/components/admin/BookingsTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasValidSession())) {
    redirect("/admin/login");
  }

  const [bookings, blockedRanges] = await Promise.all([listForAdmin(), listBlockedRanges()]);

  return (
    <main className="min-h-screen bg-background px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Lindeview</p>
        <h1 className="mt-3 font-display text-3xl text-brand">Administrer bookinger</h1>

        <section className="mt-10">
          <h2 className="font-display text-xl text-brand">Kalender</h2>
          <div className="mt-4">
            <AdminCalendar bookings={bookings} initialBlockedRanges={blockedRanges} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl text-brand">Bookingforespørsler</h2>
          <div className="mt-4">
            <BookingsTable initialBookings={bookings} />
          </div>
        </section>
      </div>
    </main>
  );
}
