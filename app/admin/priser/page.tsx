import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import { getPrices } from "@/lib/prices";
import { PROPERTY_NAME } from "@/lib/property";
import AdminHeader from "@/components/admin/AdminHeader";
import PricesForm from "@/components/admin/PricesForm";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  if (!(await hasValidSession())) {
    redirect("/admin/login");
  }

  const prices = await getPrices();

  return (
    <main className="min-h-screen bg-background px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{PROPERTY_NAME}</p>
        <h1 className="mt-3 font-display text-3xl text-brand">Priser</h1>

        <div className="mt-8">
          <AdminHeader />
        </div>

        <div className="mt-10">
          <PricesForm initialPrices={prices} />
        </div>
      </div>
    </main>
  );
}
