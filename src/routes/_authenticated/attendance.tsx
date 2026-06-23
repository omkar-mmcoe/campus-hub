import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import type { Event, AttendanceSession, AttendanceRecord } from "@/lib/eventra";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance hub — Eventra" }] }),
  component: Attendance,
});

type AttendeeRow = AttendanceRecord & { user: { name: string; department: string | null; avatar_url: string | null } | null };

function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<string | null>(null);

  const { data: myEvents = [] } = useQuery({
    queryKey: ["organized-events-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_events")
        .select("id,title,venue,start_time,status,total_registrations")
        .eq("organizer_id", user!.id)
        .order("start_time", { ascending: false });
      return (data ?? []) as Pick<Event, "id" | "title" | "venue" | "start_time" | "status" | "total_registrations">[];
    },
  });

  useEffect(() => {
    if (!eventId && myEvents.length) setEventId(myEvents[0].id);
  }, [eventId, myEvents]);

  const { data: session } = useQuery({
    queryKey: ["attendance-session", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_attendance_sessions")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as AttendanceSession | null;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-records", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_attendance_records")
        .select("*, user:evm_users!evm_attendance_records_user_id_fkey(name,department,avatar_url)")
        .eq("session_id", session!.id)
        .order("checked_in_at", { ascending: false });
      return (data ?? []) as AttendeeRow[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`att-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evm_attendance_records", filter: `session_id=eq.${session.id}` },
        () => qc.invalidateQueries({ queryKey: ["attendance-records", session.id] })
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [session?.id, qc]);

  const startSession = useMutation({
    mutationFn: async () => {
      if (!eventId || !user) return;
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const payload = { event_id: eventId, code, t: Date.now() };
      const { error } = await supabase.from("evm_attendance_sessions").insert({
        event_id: eventId,
        session_code: code,
        title: "Main Session",
        status: "active",
        started_at: new Date().toISOString(),
        qr_code_data: btoa(JSON.stringify(payload)),
        qr_code_generated_at: new Date().toISOString(),
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance session started");
      qc.invalidateQueries({ queryKey: ["attendance-session", eventId] });
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const endSession = useMutation({
    mutationFn: async () => {
      if (!session?.id) return;
      const { error } = await supabase
        .from("evm_attendance_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session ended");
      qc.invalidateQueries({ queryKey: ["attendance-session", eventId] });
    },
  });

  const event = useMemo(() => myEvents.find((e) => e.id === eventId), [myEvents, eventId]);
  const checkedIn = records.length;
  const registered = event?.total_registrations ?? 0;
  const pct = registered ? Math.min(100, Math.round((checkedIn / registered) * 100)) : 0;

  if (myEvents.length === 0) {
    return (
      <AppShell title="Attendance hub">
        <div className="eventra-card grid place-items-center p-12 text-center">
          <Icon name="qr_code_scanner" size={36} className="text-foreground-muted" />
          <h2 className="mt-3 font-heading text-lg font-semibold">No events to track</h2>
          <p className="mt-1 text-sm text-foreground-muted">Create an event first, then start an attendance session.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Attendance hub">
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label-eyebrow">Live session</div>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Attendance hub</h1>
            <p className="mt-1 text-base text-foreground-secondary">
              Scan, verify, and monitor attendees in real time.
            </p>
          </div>
          <select
            value={eventId ?? ""}
            onChange={(e) => setEventId(e.target.value)}
            className="h-11 rounded-md border border-border-strong bg-surface px-3 text-sm"
          >
            {myEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="eventra-card overflow-hidden">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold">QR Scanner</h2>
                  <p className="text-sm text-foreground-muted">{event?.title} • {event?.venue}</p>
                </div>
                <Tag tone={session?.status === "active" ? "success" : "neutral"}>
                  {session?.status === "active" ? "● Live" : session?.status === "ended" ? "Ended" : "Idle"}
                </Tag>
              </div>
            </div>
            <div className="grid place-items-center p-8">
              <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface-secondary">
                <div className="absolute inset-0 grid place-items-center text-foreground-muted">
                  <Icon name="qr_code_scanner" size={80} />
                </div>
                <div className="absolute inset-6 rounded-lg border-2 border-primary/60" />
                {session?.status === "active" && (
                  <div className="absolute left-6 right-6 top-1/2 h-px animate-pulse bg-primary" />
                )}
              </div>
              <div className="mt-5 flex w-full max-w-sm gap-2">
                {session?.status === "active" ? (
                  <button onClick={() => endSession.mutate()} className="btn-secondary flex-1">
                    <Icon name="stop_circle" size={18} /> End session
                  </button>
                ) : (
                  <button onClick={() => startSession.mutate()} disabled={startSession.isPending} className="btn-primary flex-1">
                    <Icon name="play_arrow" size={18} /> Start session
                  </button>
                )}
              </div>
              {session?.session_code && (
                <div className="mt-3 text-xs font-mono text-foreground-muted">
                  Code: <span className="font-bold text-foreground">{session.session_code}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Registered" value={String(registered)} icon="group" />
              <StatBox label="Checked-in" value={String(checkedIn)} icon="check_circle" tone="success" />
              <StatBox label="Awaiting" value={String(Math.max(registered - checkedIn, 0))} icon="schedule" />
              <StatBox label="Session" value={session?.status ?? "—"} icon="podcasts" />
            </div>
            <div className="eventra-card p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Attendance progress</span>
                <span className="text-foreground-muted">{pct}%</span>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-secondary">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="eventra-card overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <h2 className="font-heading text-lg font-semibold">Recent check-ins</h2>
              <p className="text-sm text-foreground-muted">Live feed</p>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold">Attendee</th>
                  <th className="px-6 py-3 font-semibold">Department</th>
                  <th className="px-6 py-3 font-semibold">Time</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-foreground-muted">No check-ins yet.</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-secondary/60">
                    <td className="px-6 py-3 font-semibold">{r.user?.name || "Attendee"}</td>
                    <td className="px-6 py-3 text-foreground-secondary">{r.user?.department || "—"}</td>
                    <td className="px-6 py-3 font-mono text-xs text-foreground-muted">
                      {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : ""}
                    </td>
                    <td className="px-6 py-3">
                      <Tag tone={r.status === "late" ? "warning" : "success"}>{r.status}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatBox({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: "success" }) {
  return (
    <div className="eventra-card p-5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <Icon name={icon} size={18} className={tone === "success" ? "text-success" : "text-foreground-muted"} />
      </div>
      <div className="mt-3 font-heading text-3xl font-bold capitalize">{value}</div>
    </div>
  );
}
