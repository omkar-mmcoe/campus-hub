// routes/_authenticated/attendance.tsx

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Tag } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import type { Event, AttendanceSession, AttendanceRecord } from "@/lib/eventra";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Confetti from "react-confetti";
import {
  QrCode, ScanQrCode, Users, CheckCircle, Clock, UserX,
  Play, Square, RefreshCw, Camera, Loader2, Sparkles,
  StopCircle, LayoutGrid, ChevronDown, ChevronUp,
} from "lucide-react";
import jsQR from "jsqr";

function scanQRFromImageData(imageData: ImageData, w: number, h: number) {
  try {
    const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
    return code ? { data: code.data } : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Eventra" }] }),
  component: Attendance,
});

type AttendeeRow = AttendanceRecord & {
  user: {
    name: string;
    department: string | null;
    avatar_url: string | null;
    roll_number: string | null;
  } | null;
};

type SessionWithDetails = AttendanceSession & {
  event: Pick<Event, "id" | "title" | "venue" | "start_time" | "total_registrations" | "organizer_id"> | null;
};

const QR_REFRESH_INTERVAL = 60;

// ─── helpers ────────────────────────────────────────────────────────────────

function statusTone(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "on_time") return "success";
  if (s === "late") return "warning";
  return "neutral";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── main component ──────────────────────────────────────────────────────────

function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<"scanner" | "organizer">("scanner");
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null); // which session's QR is shown
  const [qrRefreshCountdown, setQrRefreshCountdown] = useState(QR_REFRESH_INTERVAL);
  const [scanFeedback, setScanFeedback] = useState<"idle" | "scanning" | "success" | "error" | "already">("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lastScanRef = useRef<string>("");

  // ── organizer events ──────────────────────────────────────────────────────
  const { data: myEvents = [] } = useQuery({
    queryKey: ["organized-events", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_events")
        .select("id,title,venue,start_time,status,total_registrations,event_type")
        .eq("organizer_id", user!.id)
        .order("start_time", { ascending: false })
        .limit(20);
      return (data ?? []) as Pick<Event, "id" | "title" | "venue" | "start_time" | "status" | "total_registrations" | "event_type">[];
    },
  });

  useEffect(() => {
    if (!selectedEventId && myEvents.length) setSelectedEventId(myEvents[0].id);
  }, [selectedEventId, myEvents]);

  // ── ALL sessions for this event ───────────────────────────────────────────
  const { data: allSessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["all-sessions", selectedEventId],
    enabled: !!selectedEventId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_attendance_sessions")
        .select("*, event:evm_events!evm_attendance_sessions_event_id_fkey(id,title,venue,start_time,total_registrations,organizer_id)")
        .eq("event_id", selectedEventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionWithDetails[];
    },
  });

  // The "active" session to show a live QR for (defaults to the most recent active one)
  const activeSessions = useMemo(() => allSessions.filter(s => s.status === "active"), [allSessions]);
  const displaySession = useMemo(
    () => allSessions.find(s => s.id === activeSessionId) ?? activeSessions[0] ?? allSessions[0] ?? null,
    [allSessions, activeSessions, activeSessionId],
  );

  // Keep activeSessionId in sync when sessions load
  useEffect(() => {
    if (activeSessions.length && !activeSessionId) {
      setActiveSessionId(activeSessions[0].id);
    }
  }, [activeSessions, activeSessionId]);

  // ── ALL attendance records for this event (across all sessions) ───────────
  const { data: allRecords = [] } = useQuery({
    queryKey: ["all-attendance-records", selectedEventId],
    enabled: !!selectedEventId,
    staleTime: 3_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_attendance_records")
        .select("*, user:evm_users!evm_attendance_records_user_id_fkey(name,department,avatar_url,roll_number)")
        .eq("event_id", selectedEventId!)
        .order("checked_in_at", { ascending: false });
      return (data ?? []) as AttendeeRow[];
    },
  });

  // ── current user's record for this event (event-level, not session-level) ─
  const { data: myEventRecord } = useQuery({
    queryKey: ["my-event-record", user?.id, selectedEventId],
    enabled: !!user && !!selectedEventId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("evm_attendance_records")
        .select("id, checked_in_at, status, session_id")
        .eq("user_id", user!.id)
        .eq("event_id", selectedEventId!)
        .order("checked_in_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── realtime: new check-ins for any session of this event ─────────────────
  useEffect(() => {
    if (!selectedEventId) return;
    const ch = supabase
      .channel(`evt-att-${selectedEventId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "evm_attendance_records",
        filter: `event_id=eq.${selectedEventId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["all-attendance-records", selectedEventId] });
        qc.invalidateQueries({ queryKey: ["all-sessions", selectedEventId] });
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [selectedEventId, qc]);

  // ── QR countdown for the displayed session ────────────────────────────────
  useEffect(() => {
    if (displaySession?.status === "active") {
      setQrRefreshCountdown(QR_REFRESH_INTERVAL);
      countdownIntervalRef.current = window.setInterval(() => {
        setQrRefreshCountdown(prev => {
          if (prev <= 1) { refetchSessions(); return QR_REFRESH_INTERVAL; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
    return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); };
  }, [displaySession?.status, displaySession?.id, refetchSessions]);

  // ── start new session ─────────────────────────────────────────────────────
  const startSession = useMutation({
    mutationFn: async (sessionTitle: string) => {
      if (!selectedEventId || !user) throw new Error("No event selected");
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const payload = {
        event_id: selectedEventId,
        session_code: code,
        timestamp: Date.now(),
        expires_in: QR_REFRESH_INTERVAL,
      };
      const { data, error } = await supabase.from("evm_attendance_sessions").insert({
        event_id: selectedEventId,
        session_code: code,
        title: sessionTitle,
        status: "active",
        started_at: new Date().toISOString(),
        qr_code_data: btoa(JSON.stringify(payload)),
        qr_code_generated_at: new Date().toISOString(),
        created_by: user.id,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      toast.success("Session started");
      setActiveSessionId(newId);
      qc.invalidateQueries({ queryKey: ["all-sessions", selectedEventId] });
    },
    onError: (e) => toast.error("Failed to start session", { description: (e as Error).message }),
  });

  // ── end session ───────────────────────────────────────────────────────────
  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("evm_attendance_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session ended");
      qc.invalidateQueries({ queryKey: ["all-sessions", selectedEventId] });
    },
  });

  // ── QR scan processing ────────────────────────────────────────────────────
  const processQRScan = useCallback(async (qrData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setScanFeedback("scanning");

    try {
      let decoded: { event_id: string; session_code: string; timestamp: number; expires_in: number };
      try {
        decoded = JSON.parse(atob(qrData));
      } catch {
        setScanFeedback("error");
        toast.error("Invalid QR Code");
        setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 2000);
        return;
      }

      const { event_id, session_code, timestamp, expires_in } = decoded;

      // Expiry check
      if ((Date.now() - timestamp) / 1000 > expires_in) {
        setScanFeedback("error");
        toast.error("QR Code Expired", { description: "Ask the organizer to refresh the QR code" });
        setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 2000);
        return;
      }

      // Validate session
      const { data: sessionData } = await supabase
        .from("evm_attendance_sessions")
        .select("id, status, event_id, title")
        .eq("event_id", event_id)
        .eq("session_code", session_code)
        .eq("status", "active")
        .maybeSingle();

      if (!sessionData) {
        setScanFeedback("error");
        toast.error("Session not found or already ended");
        setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 2000);
        return;
      }

      // Registration check
      const { data: reg } = await supabase
        .from("evm_registrations")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!reg) {
        setScanFeedback("error");
        toast.error("Not Registered", { description: "You are not registered for this event" });
        setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 2000);
        return;
      }

      // ── EVENT-LEVEL duplicate check (across ALL sessions) ─────────────────
      const { data: existingRecord } = await supabase
        .from("evm_attendance_records")
        .select("id, checked_in_at, session_id")
        .eq("event_id", event_id)
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();

      if (existingRecord) {
        setScanFeedback("already");
        toast.info("Attendance already recorded for this event", {
          description: "You can only check in once per event, regardless of session.",
        });
        qc.invalidateQueries({ queryKey: ["my-event-record", user!.id, event_id] });
        setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 3000);
        return;
      }

      // Insert
      const { error } = await supabase.from("evm_attendance_records").insert({
        session_id: sessionData.id,
        user_id: user!.id,
        event_id: event_id,
        checked_in_at: new Date().toISOString(),
        status: "on_time",
      });
      if (error) throw error;

      setScanFeedback("success");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      toast.success("🎉 Checked In!", {
        description: `Marked present for ${sessionData.title ?? "this session"}`,
        duration: 5000,
      });
      qc.invalidateQueries({ queryKey: ["my-event-record", user!.id, event_id] });
      setTimeout(() => navigate({ to: "/tickets" }), 1800);
    } catch {
      setScanFeedback("error");
      toast.error("Something went wrong. Please try again.");
      setTimeout(() => { setScanFeedback("idle"); lastScanRef.current = ""; }, 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [user, qc, navigate, isProcessing]);

  // ── camera ────────────────────────────────────────────────────────────────
  const scanQRFromVideo = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const result = scanQRFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height);
    if (result && result.data !== lastScanRef.current) {
      lastScanRef.current = result.data;
      processQRScan(result.data);
    }
  }, [isProcessing, processQRScan]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      setScanFeedback("idle");
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = window.setInterval(scanQRFromVideo, 250);
    } catch {
      toast.error("Camera Access Denied", { description: "Allow camera access to scan QR codes" });
    }
  }, [scanQRFromVideo]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    setScanning(false);
    setScanFeedback("idle");
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (selectedTab === "scanner") startCamera();
    else stopCamera();
  }, [selectedTab]); // eslint-disable-line

  // ── event-level stats ─────────────────────────────────────────────────────
  const selectedEvent = useMemo(() => myEvents.find(e => e.id === selectedEventId), [myEvents, selectedEventId]);
  const uniqueAttendees = useMemo(() => new Set(allRecords.map(r => r.user_id)).size, [allRecords]);
  const registered = selectedEvent?.total_registrations ?? 0;
  const pct = registered ? Math.min(100, Math.round((uniqueAttendees / registered) * 100)) : 0;
  const lateCount = allRecords.filter(r => r.status === "late").length;
  const noShows = Math.max(0, registered - uniqueAttendees);

  // per-session record counts
  const recordsBySession = useMemo(() => {
    const map: Record<string, AttendeeRow[]> = {};
    for (const r of allRecords) {
      if (!map[r.session_id]) map[r.session_id] = [];
      map[r.session_id].push(r);
    }
    return map;
  }, [allRecords]);

  // session lookup by id
  const sessionMap = useMemo(() => {
    const m: Record<string, SessionWithDetails> = {};
    for (const s of allSessions) m[s.id] = s;
    return m;
  }, [allSessions]);

  const isOrganizer = myEvents.length > 0;

  return (
    <AppShell title="Attendance">
      {showConfetti && (
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={250} />
      )}

      <div className="space-y-8">
        <header>
          <div className="label-eyebrow">Check-in</div>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">Attendance</h1>
          <p className="mt-1 text-base text-foreground-secondary">
            Scan QR codes to check in, or manage event attendance across sessions.
          </p>
        </header>

        <Tabs value={selectedTab} onValueChange={v => setSelectedTab(v as "scanner" | "organizer")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <ScanQrCode className="h-4 w-4" />Scanner
            </TabsTrigger>
            <TabsTrigger value="organizer" className="flex items-center gap-2" disabled={!isOrganizer}>
              <LayoutGrid className="h-4 w-4" />Organizer
            </TabsTrigger>
          </TabsList>

          {/* ══ SCANNER TAB ══════════════════════════════════════════════════ */}
          <TabsContent value="scanner">
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <ScanQrCode className="h-5 w-5 text-primary" />QR Scanner
                </CardTitle>
                <CardDescription>
                  {myEventRecord
                    ? "✓ Your attendance is already recorded for this event"
                    : scanning ? "Scanning for QR codes…" : "Point your camera at the event QR code"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-6">

                {/* ── Already checked-in banner ── */}
                {myEventRecord && (() => {
                  const sess = sessionMap[myEventRecord.session_id];
                  return (
                    <div className="mb-6 w-full max-w-md rounded-xl border border-success/30 bg-success-soft p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />
                        <div className="space-y-2 w-full">
                          <p className="text-sm font-semibold text-success">Attendance already recorded</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-foreground-muted">Session</span>
                            <span className="font-medium">{sess?.title ?? "—"}</span>
                            <span className="text-foreground-muted">Checked in at</span>
                            <span className="font-medium">{fmtTime(myEventRecord.checked_in_at)}</span>
                            <span className="text-foreground-muted">Status</span>
                            <span className={`font-medium capitalize ${myEventRecord.status === "late" ? "text-warning" : "text-success"}`}>
                              {myEventRecord.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Camera viewfinder ── */}
                <div className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden bg-black shadow-2xl">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="absolute inset-0 pointer-events-none">
                    {/* corner brackets */}
                    <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/80 rounded-tl" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/80 rounded-tr" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/80 rounded-bl" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/80 rounded-br" />

                    {scanning && scanFeedback === "idle" && (
                      <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2">
                        <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-pulse" />
                      </div>
                    )}

                    {scanFeedback === "success" && (
                      <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="text-center text-white">
                          <CheckCircle className="h-16 w-16 mx-auto animate-bounce" />
                          <p className="mt-2 font-semibold text-lg">Checked in!</p>
                        </div>
                      </div>
                    )}
                    {scanFeedback === "already" && (
                      <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="text-center text-white">
                          <CheckCircle className="h-16 w-16 mx-auto" />
                          <p className="mt-2 font-semibold text-lg">Already recorded</p>
                        </div>
                      </div>
                    )}
                    {scanFeedback === "error" && (
                      <div className="absolute inset-0 bg-red-500/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="text-center text-white">
                          <div className="h-16 w-16 mx-auto rounded-full bg-red-500/50 flex items-center justify-center">
                            <span className="text-4xl">✕</span>
                          </div>
                          <p className="mt-2 font-semibold text-lg">Invalid QR</p>
                        </div>
                      </div>
                    )}
                    {scanFeedback === "scanning" && (
                      <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                        <div className="text-center text-white">
                          <Loader2 className="h-12 w-12 mx-auto animate-spin" />
                          <p className="mt-2 font-semibold">Processing…</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!scanning && (
                    <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-md">
                      <div className="text-center text-white">
                        <Camera className="h-16 w-16 mx-auto text-white/60" />
                        <h3 className="mt-4 font-heading text-xl font-semibold">Camera Off</h3>
                        <Button onClick={startCamera} className="mt-6 bg-white text-black hover:bg-white/90">
                          Start Camera
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {scanning && (
                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={stopCamera}><Square className="mr-2 h-4 w-4" />Stop</Button>
                    <Button variant="outline" onClick={() => { stopCamera(); setTimeout(startCamera, 200); }}>
                      <RefreshCw className="mr-2 h-4 w-4" />Restart
                    </Button>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground-muted">
                  <div className={`h-2 w-2 rounded-full ${scanning ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  <span>{scanning ? "Scanning active" : "Camera off"}</span>
                </div>

                <Alert className="mt-6 bg-primary/5 border-primary/20">
                  <AlertTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />How to check in
                  </AlertTitle>
                  <AlertDescription>
                    Hold the QR code steady in front of your camera. You only need to check in once per event — your attendance is recorded across all sessions.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ ORGANIZER TAB ════════════════════════════════════════════════ */}
          <TabsContent value="organizer" className="space-y-6">
            {!isOrganizer ? (
              <Card className="border-dashed">
                <CardContent className="pt-12 text-center">
                  <LayoutGrid className="h-16 w-16 mx-auto text-foreground-muted" />
                  <h3 className="mt-4 font-heading text-xl font-semibold">No Events Organized</h3>
                  <Link to="/create" className="btn-primary mt-6 inline-flex">Create Event</Link>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── Event + session selector row ── */}
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={selectedEventId ?? ""}
                    onChange={e => { setSelectedEventId(e.target.value); setActiveSessionId(null); }}
                    className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {myEvents.map(e => (
                      <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                    ))}
                  </select>

                  {/* active-session pill switcher */}
                  {activeSessions.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {activeSessions.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setActiveSessionId(s.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            activeSessionId === s.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface text-foreground hover:bg-surface-secondary"
                          }`}
                        >
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400 align-middle" />
                          {s.title ?? "Session"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Split layout: QR left, stats right ── */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                  {/* LEFT: QR panel */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <QrCode className="h-4 w-4 text-primary" />
                            {displaySession?.title ?? "Attendance Session"}
                          </CardTitle>
                          <CardDescription>{selectedEvent?.title} • {selectedEvent?.venue}</CardDescription>
                        </div>
                        <Badge variant={displaySession?.status === "active" ? "default" : "secondary"} className="px-3 py-1 shrink-0">
                          {displaySession?.status === "active"
                            ? <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>
                            : displaySession?.status === "ended" ? "Ended" : "—"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center pb-6 gap-4">
                      {displaySession?.status === "active" && displaySession.qr_code_data ? (
                        <>
                          <div className="bg-white p-3 rounded-xl shadow-lg">
                            <QRCodeSVG value={displaySession.qr_code_data} size={220} level="H" includeMargin />
                          </div>
                          <div className="w-full space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono bg-surface-secondary px-3 py-1.5 rounded-lg text-xs">
                                Code: <span className="font-bold text-primary">{displaySession.session_code}</span>
                              </span>
                              <span className="flex items-center gap-1.5 text-foreground-muted text-xs">
                                <Clock className="h-3.5 w-3.5" />{qrRefreshCountdown}s
                              </span>
                            </div>
                            <div className="h-1 bg-surface-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 rounded-full"
                                style={{ width: `${(qrRefreshCountdown / QR_REFRESH_INTERVAL) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 w-full">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => refetchSessions()}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh QR
                            </Button>
                            <Button
                              variant="destructive" size="sm" className="flex-1"
                              onClick={() => endSession.mutate(displaySession.id)}
                              disabled={endSession.isPending}
                            >
                              <StopCircle className="h-3.5 w-3.5 mr-1.5" />End Session
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-6 text-center w-full">
                          <QrCode className="h-16 w-16 text-foreground-muted/30" />
                          <div>
                            <p className="font-medium text-foreground-secondary">
                              {displaySession?.status === "ended" ? "Session Ended" : "No Active Session"}
                            </p>
                            {displaySession?.status === "ended" && displaySession.ended_at && (
                              <p className="text-xs text-foreground-muted mt-1">
                                Ended at {fmtTime(displaySession.ended_at)}
                              </p>
                            )}
                          </div>
                          <NewSessionButton
                            existingCount={allSessions.length}
                            onStart={title => startSession.mutate(title)}
                            isPending={startSession.isPending}
                          />
                        </div>
                      )}

                      {/* Mini stats */}
                      <div className="w-full grid grid-cols-2 gap-2 mt-1">
                        <div className="rounded-lg bg-surface-secondary p-3 text-center">
                          <p className="label-eyebrow">Unique attendees</p>
                          <p className="font-heading text-2xl font-bold mt-1 text-success">{uniqueAttendees}</p>
                        </div>
                        <div className="rounded-lg bg-surface-secondary p-3 text-center">
                          <p className="label-eyebrow">Registered</p>
                          <p className="font-heading text-2xl font-bold mt-1">{registered}</p>
                        </div>
                      </div>
                      <div className="w-full space-y-1.5">
                        <div className="flex justify-between text-xs text-foreground-muted">
                          <span>Overall attendance rate</span>
                          <span className="font-semibold text-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>

                      {/* Start new session button when a session is already active */}
                      {displaySession?.status === "active" && (
                        <div className="w-full pt-1">
                          <NewSessionButton
                            existingCount={allSessions.length}
                            onStart={title => startSession.mutate(title)}
                            isPending={startSession.isPending}
                            variant="ghost"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* RIGHT: Event-level stat summary */}
                  <div className="flex flex-col gap-4">
                    {/* 4-up stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStatBox label="Registered" value={String(registered)} tone={undefined}
                        icon={<Users className="h-4 w-4 text-foreground-muted" />} />
                      <MiniStatBox label="Unique attendees" value={String(uniqueAttendees)} tone="success"
                        icon={<CheckCircle className="h-4 w-4 text-success" />} />
                      <MiniStatBox label="Late arrivals" value={String(lateCount)} tone="warning"
                        icon={<Clock className="h-4 w-4 text-warning" />} />
                      <MiniStatBox label="No-shows" value={String(noShows)} tone="danger"
                        icon={<UserX className="h-4 w-4 text-danger" />} />
                    </div>

                    {/* Session-wise breakdown */}
                    <Card className="border-0 shadow-lg flex-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Sessions</CardTitle>
                        <CardDescription>{allSessions.length} session{allSessions.length !== 1 ? "s" : ""} total</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {allSessions.length === 0 ? (
                          <p className="text-xs text-foreground-muted py-4 text-center">No sessions yet</p>
                        ) : allSessions.map(s => {
                          const count = (recordsBySession[s.id] ?? []).length;
                          return (
                            <div key={s.id} className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{s.title ?? "Session"}</p>
                                <p className="text-xs text-foreground-muted">
                                  {s.started_at ? fmtTime(s.started_at) : "—"}
                                  {s.ended_at ? ` – ${fmtTime(s.ended_at)}` : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold">{count}</p>
                                <p className="text-[10px] text-foreground-muted">check-ins</p>
                              </div>
                              <Badge
                                variant={s.status === "active" ? "default" : "secondary"}
                                className="text-[10px] px-2 py-0.5 shrink-0"
                              >
                                {s.status === "active" ? "Live" : "Ended"}
                              </Badge>
                              {s.status === "active" && (
                                <button
                                  onClick={() => setActiveSessionId(s.id)}
                                  className="text-[10px] font-semibold text-primary hover:underline shrink-0"
                                >
                                  Show QR
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* ── Full attendee table ── */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4 text-primary" />All Attendees
                        </CardTitle>
                        <CardDescription>Across all sessions for this event</CardDescription>
                      </div>
                      <Badge variant="outline">{uniqueAttendees} unique / {allRecords.length} records</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 overflow-x-auto">
                    {allRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-foreground-muted">
                        <Users className="h-10 w-10 opacity-30 mb-3" />
                        <p className="text-sm font-medium">No check-ins yet</p>
                        <p className="text-xs mt-1">Share the session QR code with attendees</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-secondary text-left text-xs uppercase tracking-wider text-foreground-muted">
                            <th className="px-4 py-3 font-semibold rounded-tl-lg">Name</th>
                            <th className="px-4 py-3 font-semibold">Roll No.</th>
                            <th className="px-4 py-3 font-semibold">Department</th>
                            <th className="px-4 py-3 font-semibold">Session</th>
                            <th className="px-4 py-3 font-semibold">Check-in Time</th>
                            <th className="px-4 py-3 font-semibold rounded-tr-lg">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {allRecords.map(r => {
                            const sess = sessionMap[r.session_id];
                            return (
                              <tr key={r.id} className="hover:bg-surface-secondary/60 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {r.user?.avatar_url ? (
                                      <img src={r.user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                                    ) : (
                                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-bold text-primary">
                                          {(r.user?.name ?? "?")[0].toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <span className="font-semibold truncate max-w-[120px]">{r.user?.name ?? "—"}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-foreground-muted font-mono text-xs">
                                  {r.user?.roll_number ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-foreground-secondary">
                                  {r.user?.department ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-foreground-secondary text-xs">
                                  {sess?.title ?? "—"}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-foreground-muted">
                                  {r.checked_in_at ? fmtTime(r.checked_in_at) : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <Tag tone={statusTone(r.status)}>
                                    {r.status.replace("_", " ")}
                                  </Tag>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ─── New session button with inline name input ────────────────────────────────

function NewSessionButton({
  existingCount,
  onStart,
  isPending,
  variant = "default",
}: {
  existingCount: number;
  onStart: (title: string) => void;
  isPending: boolean;
  variant?: "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const defaultTitle = `Session ${existingCount + 1}`;

  if (!open) {
    return (
      <Button
        variant={variant === "ghost" ? "outline" : "default"}
        size="sm"
        className="w-full"
        onClick={() => { setTitle(defaultTitle); setOpen(true); }}
      >
        <Play className="h-3.5 w-3.5 mr-1.5" />
        {existingCount === 0 ? "Start Session" : "Start New Session"}
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 animate-in fade-in duration-150">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Session name (e.g. Morning Batch)"
        className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary"
        onKeyDown={e => {
          if (e.key === "Enter") { onStart(title.trim() || defaultTitle); setOpen(false); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <Button
          size="sm" className="flex-1"
          disabled={isPending}
          onClick={() => { onStart(title.trim() || defaultTitle); setOpen(false); }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          Start
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Stat box ─────────────────────────────────────────────────────────────────

function MiniStatBox({ label, value, icon, tone }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "success" | "warning" | "danger";
}) {
  const valueColors = { success: "text-success", warning: "text-warning", danger: "text-danger" };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="label-eyebrow">{label}</span>
          {icon}
        </div>
        <div className={`font-heading text-2xl font-bold ${tone ? valueColors[tone] : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}