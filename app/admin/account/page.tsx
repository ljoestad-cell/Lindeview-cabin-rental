import { redirect } from "next/navigation";
import { getAccount } from "@/lib/admin-account";
import { hasValidSession } from "@/lib/auth";
import { PROPERTY_NAME } from "@/lib/property";
import AccountForm from "@/components/admin/AccountForm";
import AdminHeader from "@/components/admin/AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  if (!(await hasValidSession())) {
    redirect("/admin/login");
  }

  const account = await getAccount();

  return (
    <main className="min-h-screen bg-background px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{PROPERTY_NAME}</p>
        <h1 className="mt-3 font-display text-3xl text-brand">Min konto</h1>

        <div className="mt-8">
          <AdminHeader />
        </div>

        <div className="mt-10">
          <AccountForm initialAccount={account} />
        </div>
      </div>
    </main>
  );
}
