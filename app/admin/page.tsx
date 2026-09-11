import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import { listForAdmin } from "@/lib/bookings";
import BookingsTable from "@/components/admin/BookingsTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasValidSession())) {
    redirect("/admin/login");
  }

  const bookings = await listForAdmin();

  return (
    <main className="min-h-screen bg-background px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Lindeview</p>
        <h1 className="mt-3 font-display text-3xl text-brand">Administrer bookinger</h1>
        <div className="mt-8">
          <BookingsTable initialBookings={bookings} />
        </div>
      </div>
    </main>
  );
}
