import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Complete your profile — Eventra" }] }),
  component: Onboarding,
});

const INTERESTS = ["Technical", "Cultural", "Sports", "Workshop", "Hackathon", "Seminar", "Music", "Design", "Entrepreneurship"];
const ROLES = [
  { k: "student", label: "Student", icon: "school" },
  { k: "organizer", label: "Organizer", icon: "groups" },
  { k: "club_lead", label: "Club lead", icon: "campaign" },
  { k: "faculty", label: "Faculty", icon: "menu_book" },
];

function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [roll, setRoll] = useState("");
  const [role, setRole] = useState("student");
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setCollege(profile.college_name || "");
      setDepartment(profile.department || "");
      setRole(profile.role || "student");
      setInterests(profile.interests || []);
    }
  }, [profile]);

  const toggle = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("evm_users")
        .update({
          name, college_name: college, department, roll_number: roll,
          role, interests, onboarding_complete: true,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile saved");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
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
          <span className="font-heading text-lg font-bold">Eventra</span>
        </Link>
        <Link to="/dashboard" className="text-sm font-medium text-foreground-muted hover:text-foreground">
          Skip for now
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 lg:py-20">
        <div className="label-eyebrow">Step 2 of 3</div>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Complete your profile</h1>
        <p className="mt-2 text-base text-foreground-secondary">
          A few details so we can tailor events, communities, and workshops to you.
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
          <div className="h-full w-2/3 bg-primary" />
        </div>

        <div className="mt-10 space-y-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Full name" value={name} onChange={setName} placeholder="John Carter" />
            <Field label="University" value={college} onChange={setCollege} placeholder="MIT University" />
            <Field label="Roll / ID number" value={roll} onChange={setRoll} placeholder="2021CS1023" />
            <Field label="Department" value={department} onChange={setDepartment} placeholder="Computer Science" />
          </div>

          <div>
            <div className="label-eyebrow mb-2">I am a</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ROLES.map((r) => (
                <button
                  key={r.k}
                  onClick={() => setRole(r.k)}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                    role === r.k ? "border-primary bg-surface" : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <Icon name={r.icon} size={22} />
                  <span className="text-sm font-semibold">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label-eyebrow mb-2">Pick a few interests</div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    interests.includes(t)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <Link to="/dashboard" className="btn-ghost">
              <Icon name="arrow_back" size={18} /> Skip
            </Link>
            <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
              {busy ? "Saving…" : "Save & continue"} <Icon name="arrow_forward" size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
