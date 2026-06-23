import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Eventra" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { name, college_name: college },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Eventra!", { description: "Let's complete your profile." });
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error("Authentication failed", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-heading text-sm font-bold">E</span>
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">Eventra</span>
        </Link>
        <Link to="/explore" className="text-sm font-medium text-foreground-muted hover:text-foreground">
          Browse events →
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-6 py-12 lg:py-20">
        <div className="label-eyebrow">Campus OS</div>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight lg:text-4xl">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-base text-foreground-secondary">
          {mode === "signin"
            ? "Sign in to manage events, attendance, and communities."
            : "Join your campus operating system in under a minute."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <>
              <Field label="Full name" value={name} onChange={setName} placeholder="John Carter" required />
              <Field label="University" value={college} onChange={setCollege} placeholder="MIT University" required />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="john@mit.edu" required />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required minLength={8} />

          <button disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            <Icon name="arrow_forward" size={18} />
          </button>
        </form>

        <p className="mt-6 text-sm text-foreground-secondary">
          {mode === "signin" ? "New to Eventra?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; required?: boolean; minLength?: number;
}) {
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
