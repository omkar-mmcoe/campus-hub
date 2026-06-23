import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";

const searchSchema = z.object({ event: z.string().optional() });

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Write a review — Eventra" }] }),
  validateSearch: searchSchema,
  component: ReviewPage,
});

function ReviewPage() {
  const { user } = useAuth();
  const { event: eventId } = Route.useSearch();
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);
  const [organizerRating, setOrganizerRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["reviewable", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_registrations")
        .select("event_id, event:evm_events!evm_registrations_event_id_fkey(id,title,end_time)")
        .eq("user_id", user!.id);
      return ((data ?? []).map((r) => r.event).filter(Boolean) as { id: string; title: string; end_time: string }[]);
    },
  });

  const [selectedEvent, setSelectedEvent] = useState<string>("");
  useEffect(() => {
    if (eventId) setSelectedEvent(eventId);
    else if (!selectedEvent && events[0]) setSelectedEvent(events[0].id);
  }, [eventId, events, selectedEvent]);

  const submit = async () => {
    if (!user || !selectedEvent) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("evm_reviews").upsert(
        { event_id: selectedEvent, user_id: user.id, rating, organizer_rating: organizerRating, comment },
        { onConflict: "event_id,user_id" }
      );
      if (error) throw error;
      toast.success("Review submitted!");
      navigate({ to: "/events/$id", params: { id: selectedEvent } });
    } catch (e) {
      toast.error("Couldn't submit", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Write a review">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <div className="label-eyebrow">Feedback</div>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Write a review</h1>
          <p className="mt-1 text-base text-foreground-secondary">Help organizers improve and other students decide.</p>
        </header>

        <section className="eventra-card space-y-6 p-6">
          <div>
            <label className="label-eyebrow">Event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm"
            >
              <option value="">Select an event…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>

          <Stars label="Overall" value={rating} onChange={setRating} />
          <Stars label="Organizer" value={organizerRating} onChange={setOrganizerRating} />

          <div>
            <label className="label-eyebrow">Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              placeholder="What did you love? What could be better?"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end">
            <button onClick={submit} disabled={busy || !selectedEvent} className="btn-primary disabled:opacity-60">
              {busy ? "Submitting…" : "Submit review"} <Icon name="send" size={16} />
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Stars({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`grid h-10 w-10 place-items-center rounded-md transition-colors ${
              n <= value ? "text-accent" : "text-foreground-muted hover:text-foreground"
            }`}
          >
            <Icon name="star" size={28} filled={n <= value} />
          </button>
        ))}
      </div>
    </div>
  );
}
