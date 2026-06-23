import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import { EVENT_TYPES, type EventInsert } from "@/lib/eventra";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({ meta: [{ title: "Create event — Eventra" }] }),
  component: CreateEvent,
});

function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    tagline: "",
    description: "",
    event_type: "technical" as (typeof EVENT_TYPES)[number],
    venue: "",
    location_city: "",
    start_time: "",
    end_time: "",
    max_participants: "",
    registration_fee: "0",
    poster_url: "",
    publish: true,
  });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const payload: EventInsert = {
        organizer_id: user.id,
        title: form.title,
        tagline: form.tagline || null,
        description: form.description || null,
        event_type: form.event_type,
        venue: form.venue,
        location_city: form.location_city || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        registration_fee: Number(form.registration_fee) || 0,
        poster_url: form.poster_url || null,
        status: form.publish ? "upcoming" : "draft",
        published_at: form.publish ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase.from("evm_events").insert(payload).select("id").single();
      if (error) throw error;
      toast.success(form.publish ? "Event published!" : "Draft saved");
      navigate({ to: "/events/$id", params: { id: data.id } });
    } catch (err) {
      toast.error("Couldn't save event", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Create event">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
        <form onSubmit={submit} className="space-y-8">
          <header>
            <div className="label-eyebrow">New event</div>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Create event</h1>
            <p className="mt-1 text-base text-foreground-secondary">
              Fill in the essentials. You can refine media, agenda, and resources after publishing.
            </p>
          </header>

          <section className="eventra-card space-y-5 p-6">
            <h2 className="font-heading text-lg font-semibold">Basics</h2>
            <Field label="Title" value={form.title} onChange={(v) => set("title", v)} required placeholder="Advanced Generative Design" />
            <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} placeholder="A workshop on the future of design tooling" />
            <div>
              <label className="label-eyebrow">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-eyebrow">Type</label>
                <select
                  value={form.event_type}
                  onChange={(e) => set("event_type", e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm capitalize outline-none focus:border-primary"
                >
                  {EVENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <Field label="Poster URL" value={form.poster_url} onChange={(v) => set("poster_url", v)} placeholder="https://…" />
            </div>
          </section>

          <section className="eventra-card space-y-5 p-6">
            <h2 className="font-heading text-lg font-semibold">When & where</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time" type="datetime-local" value={form.start_time} onChange={(v) => set("start_time", v)} required />
              <Field label="End time" type="datetime-local" value={form.end_time} onChange={(v) => set("end_time", v)} required />
              <Field label="Venue" value={form.venue} onChange={(v) => set("venue", v)} required placeholder="Studio B" />
              <Field label="City" value={form.location_city} onChange={(v) => set("location_city", v)} placeholder="Cambridge" />
            </div>
          </section>

          <section className="eventra-card space-y-5 p-6">
            <h2 className="font-heading text-lg font-semibold">Registration</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max participants" type="number" value={form.max_participants} onChange={(v) => set("max_participants", v)} placeholder="100" />
              <Field label="Registration fee (₹)" type="number" value={form.registration_fee} onChange={(v) => set("registration_fee", v)} />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => set("publish", e.target.checked)}
                className="h-4 w-4 rounded border-border-strong"
              />
              Publish immediately (otherwise saved as draft)
            </label>
          </section>

          <div className="flex justify-end gap-3">
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
              {busy ? "Saving…" : form.publish ? "Publish event" : "Save draft"}
              <Icon name="arrow_forward" size={18} />
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="label-eyebrow mb-3">Live preview</div>
          <div className="eventra-card overflow-hidden">
            <div className="aspect-[16/10] bg-surface-secondary">
              {form.poster_url ? (
                <img src={form.poster_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-foreground-muted">
                  <Icon name="image" size={36} />
                </div>
              )}
            </div>
            <div className="p-5">
              <span className="label-eyebrow capitalize">{form.event_type}</span>
              <h3 className="mt-2 font-heading text-lg font-semibold">{form.title || "Your event title"}</h3>
              <p className="mt-1 text-sm text-foreground-secondary">{form.tagline || "Tagline appears here."}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-foreground-muted">
                <span>{form.start_time ? new Date(form.start_time).toLocaleString() : "Date TBD"}</span>
                <span>{form.venue || "Venue TBD"}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
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
        className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
