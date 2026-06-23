import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import { defaultPoster, formatEventDate, type Event, type Registration } from "@/lib/eventra";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "My tickets — Eventra" }] }),
  component: Tickets,
});

function Tickets() {
  const { user } = useAuth();
  const { data: regs = [] } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_registrations")
        .select("*, event:evm_events!evm_registrations_event_id_fkey(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as (Registration & { event: Event | null })[];
    },
  });

  return (
    <AppShell title="My tickets">
      <header>
        <div className="label-eyebrow">My tickets</div>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Your registrations</h1>
        <p className="mt-1 text-base text-foreground-secondary">Show this QR at the entrance to check in.</p>
      </header>

      {regs.length === 0 ? (
        <div className="eventra-card mt-8 grid place-items-center p-12 text-center">
          <Icon name="confirmation_number" size={32} className="text-foreground-muted" />
          <h2 className="mt-3 font-heading text-base font-semibold">No tickets yet</h2>
          <p className="mt-1 text-sm text-foreground-muted">Browse events to register.</p>
          <Link to="/explore" className="btn-primary mt-4">Browse events</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {regs.map((r) =>
            r.event ? (
              <div key={r.id} className="eventra-card overflow-hidden">
                <div className="grid grid-cols-[1fr_auto]">
                  <div className="p-5">
                    <Tag tone={r.checked_in ? "success" : r.event.status === "ongoing" ? "accent" : "neutral"}>
                      {r.checked_in ? "Checked in" : r.status}
                    </Tag>
                    <h3 className="mt-2 font-heading text-lg font-semibold">{r.event.title}</h3>
                    <div className="mt-1 text-xs text-foreground-muted">{formatEventDate(r.event.start_time)}</div>
                    <div className="mt-3 text-xs text-foreground-muted">{r.event.venue}</div>
                    <Link to="/events/$id" params={{ id: r.event.id }} className="mt-4 inline-flex text-xs font-semibold text-foreground underline">
                      View event →
                    </Link>
                  </div>
                  <div className="grid place-items-center bg-surface-secondary p-4">
                    <div className="grid h-28 w-28 place-items-center rounded bg-white text-[10px]">
                      <Icon name="qr_code_2" size={88} className="text-foreground" />
                    </div>
                  </div>
                </div>
                {r.event.poster_url && (
                  <img src={r.event.poster_url || defaultPoster(r.event.id)} alt="" className="hidden" />
                )}
              </div>
            ) : null
          )}
        </div>
      )}
    </AppShell>
  );
}
