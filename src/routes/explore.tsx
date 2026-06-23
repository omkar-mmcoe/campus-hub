import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { Tag } from "@/components/AppShell";
import { defaultPoster, formatEventDate, type Event } from "@/lib/eventra";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore events — Eventra" },
      { name: "description", content: "Search and discover events happening on campus." },
      { property: "og:title", content: "Explore events — Eventra" },
      { property: "og:description", content: "Search and discover events happening on campus." },
    ],
  }),
  component: Explore,
});

const CATEGORIES = ["all", "technical", "cultural", "sports", "workshop", "hackathon", "seminar", "social"] as const;

function Explore() {
  const { session } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", "explore", cat, q],
    queryFn: async () => {
      let query = supabase
        .from("evm_events")
        .select("*")
        .in("status", ["upcoming", "ongoing"])
        .order("start_time", { ascending: true })
        .limit(60);
      if (cat !== "all") query = query.eq("event_type", cat);
      if (q) query = query.ilike("title", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Event[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="font-heading text-sm font-bold">E</span>
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">Eventra</span>
          </Link>
          {session ? (
            <Link to="/dashboard" className="btn-secondary h-9 text-xs">Dashboard</Link>
          ) : (
            <Link to="/auth" className="btn-primary h-9 text-xs">Sign in</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="label-eyebrow">Discover</div>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Explore events</h1>
        <p className="mt-2 max-w-xl text-base text-foreground-secondary">
          Find what's happening across your campus. Filter by category or search by name.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by event title…"
              className="h-11 w-full rounded-md border border-border-strong bg-surface pl-10 pr-3.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
                cat === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:bg-surface-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <section className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="eventra-card h-72 animate-pulse bg-surface-secondary" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="eventra-card grid place-items-center p-12 text-center">
              <Icon name="event_busy" size={36} className="text-foreground-muted" />
              <h3 className="mt-3 font-heading text-lg font-semibold">No events yet</h3>
              <p className="mt-1 text-sm text-foreground-muted">Be the first to create an event for your campus.</p>
              <Link to="/create" className="btn-primary mt-4">
                <Icon name="add" size={18} /> Create event
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  to="/events/$id"
                  params={{ id: ev.id }}
                  className="eventra-card group overflow-hidden transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-surface-secondary">
                    <img
                      src={ev.poster_url || defaultPoster(ev.id)}
                      alt={ev.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <Tag tone={ev.status === "ongoing" ? "success" : "neutral"}>
                        {ev.status === "ongoing" ? "● Live" : "Upcoming"}
                      </Tag>
                      <span className="text-xs font-medium text-foreground-muted capitalize">{ev.event_type}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-heading text-lg font-semibold">{ev.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground-secondary">{ev.tagline || ev.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-foreground-muted">
                      <span className="flex items-center gap-1"><Icon name="schedule" size={14} /> {formatEventDate(ev.start_time)}</span>
                      <span className="flex items-center gap-1"><Icon name="place" size={14} /> {ev.venue}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
