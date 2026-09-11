import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export default async function AdminLoginPage() {
  if (await hasValidSession()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Lindeview
        </p>
        <h1 className="mt-3 text-center font-display text-2xl text-brand">Admin</h1>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
