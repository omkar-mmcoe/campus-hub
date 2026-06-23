import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { Tag } from "@/components/AppShell";
import { defaultPoster, formatEventDate, type Event, type EventAgenda, type Review } from "@/lib/eventra";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/events/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Event — Eventra` },
      { name: "description", content: `Details for event ${params.id}.` },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_events")
        .select("*, organizer:evm_users!evm_events_organizer_id_fkey(name,avatar_url,college_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as (Event & { organizer: { name: string; avatar_url: string | null; college_name: string | null } | null }) | null;
    },
  });

  const { data: agenda = [] } = useQuery({
    queryKey: ["event-agenda", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_event_agenda")
        .select("*")
        .eq("event_id", id)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as EventAgenda[];
    },
  });

  const { data: myReg } = useQuery({
    queryKey: ["my-reg", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_registrations")
        .select("id,status,qr_code,checked_in")
        .eq("event_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["event-reviews", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_reviews")
        .select("*, user:evm_users!evm_reviews_user_id_fkey(name,avatar_url)")
        .eq("event_id", id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as (Review & { user: { name: string; avatar_url: string | null } | null })[];
    },
  });

  const register = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("evm_registrations").insert({
        user_id: user.id,
        event_id: id,
        status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registered!", { description: "Your QR ticket is in My Tickets." });
      qc.invalidateQueries({ queryKey: ["my-reg", id] });
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["my-registrations"] });
    },
    onError: (e) => toast.error("Couldn't register", { description: (e as Error).message }),
  });

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-foreground-muted">Loading…</div>;
  }
  if (!event) {
    return (
      <div className="grid min-h-screen place-items-center text-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Event not found</h1>
          <Link to="/explore" className="btn-primary mt-4">Back to explore</Link>
        </div>
      </div>
    );
  }

  const isOrganizer = user?.id === event.organizer_id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/explore" className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground">
            <Icon name="arrow_back" size={18} /> Back to explore
          </Link>
          {session ? (
            <Link to="/dashboard" className="btn-secondary h-9 text-xs">Dashboard</Link>
          ) : (
            <Link to="/auth" className="btn-primary h-9 text-xs">Sign in</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="aspect-[16/8] overflow-hidden rounded-xl border border-border bg-surface-secondary">
          <img
            src={event.banner_url || event.poster_url || defaultPoster(event.id)}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag tone={event.status === "ongoing" ? "success" : "neutral"}>
                {event.status === "ongoing" ? "● Live" : event.status}
              </Tag>
              <span className="text-xs font-medium capitalize text-foreground-muted">{event.event_type}</span>
            </div>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight lg:text-4xl">{event.title}</h1>
            {event.tagline && <p className="mt-2 max-w-2xl text-base text-foreground-secondary">{event.tagline}</p>}
          </div>
          <div className="flex gap-2">
            {isOrganizer ? (
              <Link to="/attendance" search={{ event: event.id } as never} className="btn-primary">
                <Icon name="qr_code_scanner" size={18} /> Run attendance
              </Link>
            ) : myReg ? (
              <div className="rounded-md border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
                ✓ You're registered
              </div>
            ) : !session ? (
              <button onClick={() => navigate({ to: "/auth" })} className="btn-primary">
                Sign in to register
              </button>
            ) : (
              <button onClick={() => register.mutate()} disabled={register.isPending} className="btn-primary">
                {register.isPending ? "Registering…" : "Register now"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <section className="eventra-card p-6">
              <h2 className="font-heading text-lg font-semibold">About this event</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
                {event.description || "No description yet."}
              </p>
            </section>

            {agenda.length > 0 && (
              <section className="eventra-card p-6">
                <h2 className="font-heading text-lg font-semibold">Agenda</h2>
                <ul className="mt-4 space-y-3">
                  {agenda.map((a) => (
                    <li key={a.id} className="flex gap-4 border-l-2 border-border pl-4">
                      <div className="min-w-24 text-xs font-mono text-foreground-muted">
                        {new Date(a.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{a.title}</div>
                        {a.speaker_name && <div className="text-xs text-foreground-muted">{a.speaker_name}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="eventra-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">Reviews</h2>
                {myReg?.checked_in && (
                  <Link to="/review" search={{ event: event.id }} className="btn-secondary h-9 text-xs">
                    Write a review
                  </Link>
                )}
              </div>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-foreground-muted">No reviews yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="border-b border-border pb-4 last:border-none">
                      <div className="flex items-center gap-3">
                        <img
                          src={r.user?.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${r.user?.name ?? "U"}`}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                        <div className="text-sm font-semibold">{r.user?.name || "Attendee"}</div>
                        <div className="ml-auto text-xs text-accent">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                      </div>
                      {r.comment && <p className="mt-2 text-sm text-foreground-secondary">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <div className="eventra-card p-5">
              <div className="label-eyebrow">When</div>
              <div className="mt-1 text-sm font-semibold">{formatEventDate(event.start_time)}</div>
              <div className="mt-3 label-eyebrow">Where</div>
              <div className="mt-1 text-sm font-semibold">{event.venue}</div>
              {event.location_city && <div className="text-xs text-foreground-muted">{event.location_city}</div>}
              <div className="mt-3 label-eyebrow">Capacity</div>
              <div className="mt-1 text-sm font-semibold">
                {event.total_registrations} / {event.max_participants || "∞"} registered
              </div>
              {(event.registration_fee ?? 0) > 0 && (
                <>
                  <div className="mt-3 label-eyebrow">Fee</div>
                  <div className="mt-1 text-sm font-semibold">₹{event.registration_fee}</div>
                </>
              )}
            </div>

            {event.organizer && (
              <div className="eventra-card p-5">
                <div className="label-eyebrow">Organizer</div>
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={event.organizer.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${event.organizer.name}`}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <div className="text-sm font-semibold">{event.organizer.name}</div>
                    {event.organizer.college_name && (
                      <div className="text-xs text-foreground-muted">{event.organizer.college_name}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
