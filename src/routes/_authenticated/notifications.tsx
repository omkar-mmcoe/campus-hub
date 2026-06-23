import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import type { Notification } from "@/lib/eventra";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Eventra" }] }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Notification[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "evm_notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] })
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("evm_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const iconFor = (t: string) => {
    switch (t) {
      case "registration": return "person_add";
      case "attendance": return "qr_code_scanner";
      case "certificate": return "verified";
      case "review": return "star";
      case "reminder": return "alarm";
      case "payment": return "payments";
      default: return "campaign";
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-end justify-between">
          <div>
            <div className="label-eyebrow">Inbox</div>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Notifications</h1>
            <p className="mt-1 text-base text-foreground-secondary">Activity across your events, communities, and roles.</p>
          </div>
          <button onClick={() => markAll.mutate()} className="btn-ghost text-foreground-secondary">
            <Icon name="done_all" size={18} /> Mark all read
          </button>
        </header>

        {items.length === 0 ? (
          <div className="eventra-card grid place-items-center p-12 text-center">
            <Icon name="inbox" size={32} className="text-foreground-muted" />
            <h3 className="mt-3 font-heading text-base font-semibold">All clear</h3>
            <p className="mt-1 text-sm text-foreground-muted">You don't have any notifications yet.</p>
          </div>
        ) : (
          <ul className="eventra-card divide-y divide-border overflow-hidden">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-secondary ${!n.is_read ? "bg-accent-soft/30" : ""}`}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-secondary text-foreground-secondary">
                  <Icon name={iconFor(n.type)} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-sm font-semibold">{n.title}</h3>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground-secondary">{n.message}</p>
                </div>
                {!n.is_read && <Tag tone="accent">New</Tag>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
