// routes/_authenticated/tickets.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import { defaultPoster, formatEventDate, type Event, type Registration } from "@/lib/eventra";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, MapPin, Calendar, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "My tickets — Eventra" }] }),
  component: Tickets,
});

// ── types ────────────────────────────────────────────────────────────────────

type TicketReg = Registration & {
  event: Event | null;
};

type AttendanceInfo = {
  event_id: string;
  checked_in_at: string;
  status: string;
  session: { title: string | null } | null;
};

// ── component ─────────────────────────────────────────────────────────────────

function Tickets() {
  const { user } = useAuth();

  const { data: regs = [], isLoading: regsLoading } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_registrations")
        .select("*, event:evm_events!evm_registrations_event_id_fkey(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as TicketReg[];
    },
  });

  // Fetch attendance records for all registered events in one query
  const eventIds = regs.map(r => r.event_id).filter(Boolean);
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["my-attendance-all", user?.id, eventIds.join(",")],
    enabled: !!user && eventIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_attendance_records")
        .select("event_id, checked_in_at, status, session:evm_attendance_sessions!evm_attendance_records_session_id_fkey(title)")
        .eq("user_id", user!.id)
        .in("event_id", eventIds)
        .order("checked_in_at", { ascending: true });
      return (data ?? []) as AttendanceInfo[];
    },
  });

  // Map event_id → first attendance record (event-level, one per event)
  const attendanceByEvent = Object.fromEntries(
    attendanceRecords.map(r => [r.event_id, r])
  );

  if (regsLoading) {
    return (
      <AppShell title="My tickets">
        <TicketsHeader />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="eventra-card h-48 animate-pulse bg-surface-secondary" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My tickets">
      <TicketsHeader />

      {regs.length === 0 ? (
        <div className="eventra-card mt-8 grid place-items-center p-12 text-center">
          <Icon name="confirmation_number" size={32} className="text-foreground-muted" />
          <h2 className="mt-3 font-heading text-base font-semibold">No tickets yet</h2>
          <p className="mt-1 text-sm text-foreground-muted">Browse events to register.</p>
          <Link to="/explore" className="btn-primary mt-4">Browse events</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {regs.map(r =>
            r.event ? (
              <TicketCard
                key={r.id}
                reg={r}
                event={r.event}
                attendance={attendanceByEvent[r.event_id] ?? null}
              />
            ) : null
          )}
        </div>
      )}
    </AppShell>
  );
}

function TicketsHeader() {
  return (
    <header>
      <div className="label-eyebrow">My tickets</div>
      <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">
        Your registrations
      </h1>
      <p className="mt-1 text-base text-foreground-secondary">
        Show your QR code at the entrance to check in.
      </p>
    </header>
  );
}

// ── TicketCard ────────────────────────────────────────────────────────────────

function TicketCard({
  reg,
  event,
  attendance,
}: {
  reg: TicketReg;
  event: Event;
  attendance: AttendanceInfo | null;
}) {
  const isCheckedIn = !!attendance;
  const isLive = event.status === "ongoing";
  const isPast = event.status === "completed" || event.status === "cancelled";

  // The QR value encodes the registration's qr_code field — this is what
  // the organizer's scanner validates at the door (separate from attendance QR).
  const qrValue = reg.qr_code;

  return (
    <div className={`eventra-card overflow-hidden transition-shadow hover:shadow-md ${isCheckedIn ? "ring-1 ring-success/20" : ""}`}>
      {/* ── Event banner strip ── */}
      <div className="relative h-28 bg-surface-secondary overflow-hidden">
        <img
          src={event.poster_url || defaultPoster(event.id)}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-3">
          <StatusBadge reg={reg} attendance={attendance} isLive={isLive} />
        </div>
        {isCheckedIn && (
          <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-success flex items-center justify-center shadow-lg">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* ── Body: info + QR side by side ── */}
      <div className="grid grid-cols-[1fr_auto] gap-0">
        {/* Info column */}
        <div className="p-4 space-y-3 min-w-0">
          <div>
            <h3 className="font-heading text-base font-semibold leading-tight line-clamp-2">
              {event.title}
            </h3>
            {event.tagline && (
              <p className="mt-0.5 text-xs text-foreground-muted line-clamp-1">{event.tagline}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <MetaRow icon="schedule" text={formatEventDate(event.start_time)} />
            <MetaRow icon="place" text={`${event.venue}${event.location_city ? `, ${event.location_city}` : ""}`} />
          </div>

          {/* Attendance info — shown only when checked in */}
          {isCheckedIn && attendance && (
            <div className="rounded-lg bg-success-soft border border-success/20 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-success">Attendance recorded</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                {attendance.session?.title && (
                  <>
                    <span className="text-foreground-muted">Session</span>
                    <span className="font-medium truncate">{attendance.session.title}</span>
                  </>
                )}
                <span className="text-foreground-muted">Checked in</span>
                <span className="font-medium">
                  {new Date(attendance.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-foreground-muted">Status</span>
                <span className={`font-medium capitalize ${attendance.status === "late" ? "text-warning" : "text-success"}`}>
                  {attendance.status.replace("_", " ")}
                </span>
              </div>
            </div>
          )}

          <Link
            to="/events/$id"
            params={{ id: event.id }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground-secondary hover:text-foreground transition-colors"
          >
            View event <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* QR column */}
        <div className="flex flex-col items-center justify-center gap-2 border-l border-border bg-surface-secondary px-4 py-4">
          {/* Dashed separator dots — ticket-tear aesthetic */}
          <div className="flex flex-col gap-1 absolute -ml-[1.1rem] pointer-events-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-border" />
            ))}
          </div>

          <div className={`bg-white p-2 rounded-lg shadow-sm ${isCheckedIn ? "opacity-50" : ""}`}>
            <QRCodeSVG
              value={qrValue}
              size={88}
              level="M"
              includeMargin={false}
            />
          </div>

          {isCheckedIn ? (
            <span className="text-[10px] font-semibold text-success text-center leading-tight">
              Used ✓
            </span>
          ) : isPast ? (
            <span className="text-[10px] text-foreground-muted text-center">Expired</span>
          ) : (
            <span className="text-[10px] text-foreground-muted text-center leading-tight">
              Show at<br />entrance
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({
  reg,
  attendance,
  isLive,
}: {
  reg: TicketReg;
  attendance: AttendanceInfo | null;
  isLive: boolean;
}) {
  if (attendance) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/90 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        <CheckCircle className="h-3 w-3" /> Checked in
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> Live now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm capitalize">
      {reg.status}
    </span>
  );
}

// ── MetaRow ───────────────────────────────────────────────────────────────────

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-foreground-muted">
      <Icon name={icon} size={14} className="mt-0.5 shrink-0" />
      <span className="line-clamp-1">{text}</span>
    </div>
  );
}