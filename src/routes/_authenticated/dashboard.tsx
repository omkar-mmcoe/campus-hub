import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import { defaultPoster, formatEventDate, type Event, type Registration } from "@/lib/eventra";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Eventra" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();

  const { data: organized = [] } = useQuery({
    queryKey: ["organized-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_events")
        .select("*")
        .eq("organizer_id", user!.id)
        .order("start_time", { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Event[];
    },
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["my-registrations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_registrations")
        .select("*, event:evm_events!evm_registrations_event_id_fkey(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as (Registration & { event: Event | null })[];
    },
  });

  const totalRegs = organized.reduce((s, e) => s + (e.total_registrations ?? 0), 0);
  const avgRating = organized.length
    ? organized.reduce((s, e) => s + Number(e.average_rating ?? 0), 0) / organized.length
    : 0;
  const liveEvents = organized.filter((e) => e.status === "ongoing").length;

  return (
    <AppShell title="Dashboard">
      <div className="space-y-10">
        <header>
          <div className="label-eyebrow">Today</div>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">
            Welcome back, {profile?.name?.split(" ")[0] || "friend"}
          </h1>
          <p className="mt-1 text-base text-foreground-secondary">
            Here's what's happening across your events and communities.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Events organized" value={String(organized.length)} icon="event_note" />
          <Stat label="Live now" value={String(liveEvents)} icon="podcasts" tone="success" />
          <Stat label="Total registrations" value={String(totalRegs)} icon="group" />
          <Stat label="Average rating" value={avgRating ? avgRating.toFixed(2) : "—"} icon="star" tone="accent" />
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold">My events</h2>
            <Link to="/create" className="btn-primary h-9 text-xs">
              <Icon name="add" size={16} /> New event
            </Link>
          </div>
          {organized.length === 0 ? (
            <div className="eventra-card mt-4 grid place-items-center p-10 text-center">
              <Icon name="event_available" size={32} className="text-foreground-muted" />
              <h3 className="mt-3 font-heading text-base font-semibold">No events yet</h3>
              <p className="mt-1 text-sm text-foreground-muted">Spin up your first event in minutes.</p>
              <Link to="/create" className="btn-primary mt-4">Create event</Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {organized.map((ev) => (
                <Link
                  key={ev.id}
                  to="/events/$id"
                  params={{ id: ev.id }}
                  className="eventra-card overflow-hidden transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/9] bg-surface-secondary">
                    <img src={ev.poster_url || defaultPoster(ev.id)} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <Tag tone={ev.status === "ongoing" ? "success" : ev.status === "draft" ? "warning" : "neutral"}>
                      {ev.status}
                    </Tag>
                    <h3 className="mt-2 line-clamp-1 font-heading text-base font-semibold">{ev.title}</h3>
                    <div className="mt-2 flex items-center justify-between text-xs text-foreground-muted">
                      <span>{formatEventDate(ev.start_time)}</span>
                      <span>{ev.total_registrations} regs</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold">Your upcoming tickets</h2>
          {registrations.length === 0 ? (
            <p className="mt-2 text-sm text-foreground-muted">
              You haven't registered for any events yet.{" "}
              <Link to="/explore" className="font-semibold text-foreground underline">Browse events</Link>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {registrations.slice(0, 5).map((r) =>
                r.event ? (
                  <li key={r.id} className="eventra-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-md bg-surface-secondary">
                        <img src={r.event.poster_url || defaultPoster(r.event.id)} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{r.event.title}</div>
                        <div className="text-xs text-foreground-muted">{formatEventDate(r.event.start_time)}</div>
                      </div>
                    </div>
                    {r.checked_in ? <Tag tone="success">Checked in</Tag> : <Tag>Ready</Tag>}
                  </li>
                ) : null
              )}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: "success" | "accent" }) {
  return (
    <div className="eventra-card p-5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <Icon
          name={icon}
          size={18}
          className={tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : "text-foreground-muted"}
        />
      </div>
      <div className="mt-3 font-heading text-3xl font-bold">{value}</div>
    </div>
  );
}
