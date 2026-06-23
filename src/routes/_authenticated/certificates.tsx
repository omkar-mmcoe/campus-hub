// First, install the required library
// npm install jszip file-saver
// npm install --save-dev @types/jszip @types/file-saver
import jsPDF from "jspdf"; 
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";
import { type Event } from "@/lib/eventra";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import JSZip from "jszip";
import * as fileSaver from "file-saver";
const { saveAs } = fileSaver
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "Generate Certificates — Eventra" }] }),
  component: Certificates,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type CertificateData = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  department: string | null;
  roll_number: string | null;
  college_name: string | null;
  checked_in: boolean;
  registered_at: string;
};

type CertificateTemplate = "elegant" | "gold" | "modern";

// ─── Main Component ───────────────────────────────────────────────────────────

function Certificates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [template, setTemplate] = useState<CertificateTemplate>("elegant");
  const [includeAttendedOnly, setIncludeAttendedOnly] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const certRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [initialLoad, setInitialLoad] = useState(true);
  const [certificatesReady, setCertificatesReady] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);

  // ── Fetch organizer's events ──────────────────────────────────────────────
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["organizer-events-certs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evm_events")
        .select("id, title, event_type, start_time, venue, status, total_registrations, description")
        .eq("organizer_id", user!.id)
        .in("status", ["completed", "ongoing", "upcoming"])
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });

  // ── Fetch event registrations with attendance ────────────────────────────
  const { data: registrations = [], refetch } = useQuery({
    queryKey: ["event-certificates", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data: regs, error: regError } = await supabase
        .from("evm_registrations")
        .select(`
          id,
          user_id,
          checked_in,
          created_at,
          user:evm_users!evm_registrations_user_id_fkey (
            name,
            email,
            department,
            roll_number,
            college_name
          )
        `)
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: true });

      if (regError) throw regError;

      return (regs || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.user?.name || "Unknown",
        email: r.user?.email || "",
        department: r.user?.department || null,
        roll_number: r.user?.roll_number || null,
        college_name: r.user?.college_name || null,
        checked_in: r.checked_in || false,
        registered_at: r.created_at,
      })) as CertificateData[];
    },
  });

  // ── Filter students ──────────────────────────────────────────────────────
  const filteredStudents = registrations.filter((s) => {
    if (includeAttendedOnly) return s.checked_in;
    return true;
  });

  // ── Set default event ────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  // ── Auto-select all filtered students ────────────────────────────────────
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const newSelected = new Set(filteredStudents.map((s) => s.id));
      const currentIds = Array.from(selectedStudents).sort();
      const newIds = Array.from(newSelected).sort();
      if (currentIds.length !== newIds.length || currentIds.some((id, i) => id !== newIds[i])) {
        setSelectedStudents(newSelected);
      }
    } else {
      if (selectedStudents.size > 0) {
        setSelectedStudents(new Set());
      }
    }
    setInitialLoad(false);
  }, [filteredStudents, includeAttendedOnly]);

  // ── Mark certificates as ready ────────────────────────────────────────────
  useEffect(() => {
    if (registrations.length > 0) {
      const timer = setTimeout(() => {
        setCertificatesReady(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [registrations, template]);

  // ── Toggle individual student ────────────────────────────────────────────
  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  // ── Preview certificate ──────────────────────────────────────────────────
  const previewStudent = filteredStudents.find((s) => s.id === previewStudentId);

  // ── Generate certificate as image with high quality ──────────────────────
  const captureCertificate = async (element: HTMLDivElement): Promise<string> => {
    try {
      element.style.display = 'block';
      element.style.visibility = 'visible';
      element.style.opacity = '1';
      
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: 900,
        height: 636,
        onclone: (clonedDoc) => {
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const style = (el as HTMLElement).style;
            style.opacity = '1';
            style.visibility = 'visible';
            style.display = 'block';
          });
        }
      });

      return canvas.toDataURL("image/png", 1.0);
    } catch (error) {
      console.error("Error capturing certificate:", error);
      throw new Error("Unable to render certificate");
    }
  };

  // ── Generate and download as ZIP ────────────────────────────────────────
  const generateAndDownloadZIP = async () => {
    const selected = registrations.filter((s) => selectedStudents.has(s.id));
    if (selected.length === 0) {
      toast.error("No students selected");
      return;
    }

    if (!certificatesReady) {
      toast.error("Certificates are still loading. Please wait...");
      return;
    }

    setGenerating(true);
    setTotalToGenerate(selected.length);
    setGenerationProgress(0);

    const event = events.find((e) => e.id === selectedEventId);
    if (!event) {
      toast.error("Event not found");
      setGenerating(false);
      return;
    }

    toast.info(`Generating ${selected.length} certificates...`);

    try {
      setCertificatesReady(false);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setCertificatesReady(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const zip = new JSZip();
      const certificatesFolder = zip.folder("certificates");
      let successCount = 0;
      const failedStudents: string[] = [];

      for (let i = 0; i < selected.length; i++) {
        const student = selected[i];
        const element = certRefs.current.get(student.id);
        
        if (!element) {
          console.warn(`No element found for student ${student.id}`);
          failedStudents.push(student.name);
          setGenerationProgress(i + 1);
          continue;
        }

        try {
          element.style.display = 'block';
          element.style.visibility = 'visible';
          element.style.opacity = '1';
          
          const imgData = await captureCertificate(element);
          const base64Data = imgData.split(',')[1];
          
          const sanitizedName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `${sanitizedName}_${student.id.slice(0, 8)}.png`;
          
          certificatesFolder?.file(filename, base64Data, { base64: true });
          successCount++;
          
          setGenerationProgress(i + 1);
          
          if (i % 3 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (err) {
          console.error(`Failed for ${student.name}:`, err);
          failedStudents.push(student.name);
          setGenerationProgress(i + 1);
        }
      }

      if (successCount === 0) {
        throw new Error("No certificates could be generated");
      }

      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });

      const eventName = event.title.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(zipBlob, `certificates_${eventName}_${new Date().toISOString().split('T')[0]}.zip`);

      let message = `Successfully generated ${successCount} of ${selected.length} certificates`;
      if (failedStudents.length > 0) {
        message += `. Failed: ${failedStudents.join(', ')}`;
        toast.warning(message, { duration: 5000 });
      } else {
        toast.success(message);
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to generate certificates", {
        description: (error as Error).message,
      });
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
      setTotalToGenerate(0);
    }
  };

  // ── Generate and download as Single PDF ──────────────────────────────────
  const generateAsPDF = async () => {
    const selected = registrations.filter((s) => selectedStudents.has(s.id));
    if (selected.length === 0) {
      toast.error("No students selected");
      return;
    }

    if (!certificatesReady) {
      toast.error("Certificates are still loading. Please wait...");
      return;
    }

    setGenerating(true);
    toast.info(`Generating ${selected.length} certificates as PDF...`);

    try {
      const event = events.find((e) => e.id === selectedEventId);
      if (!event) throw new Error("Event not found");

      setCertificatesReady(false);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setCertificatesReady(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      let successCount = 0;

      for (let i = 0; i < selected.length; i++) {
        const student = selected[i];
        const element = certRefs.current.get(student.id);
        
        if (!element) {
          console.warn(`No element found for student ${student.id}`);
          continue;
        }

        try {
          element.style.display = 'block';
          element.style.visibility = 'visible';
          element.style.opacity = '1';
          
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: 900,
            height: 636,
          });
          
          const imgData = canvas.toDataURL("image/png", 1.0);
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          const imgAspect = canvas.width / canvas.height;
          let imgWidth = pdfWidth - 20;
          let imgHeight = imgWidth / imgAspect;
          
          if (imgHeight > pdfHeight - 20) {
            imgHeight = pdfHeight - 20;
            imgWidth = imgHeight * imgAspect;
          }
          
          const imgX = (pdfWidth - imgWidth) / 2;
          const imgY = (pdfHeight - imgHeight) / 2;

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth, imgHeight);

          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          const certId = `CERT-${event.id.slice(0, 4)}-${student.id.slice(0, 6)}`;
          pdf.text(certId, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
          
          successCount++;
        } catch (err) {
          console.error(`Failed for ${student.name}:`, err);
        }
      }

      if (successCount === 0) {
        throw new Error("No certificates could be generated");
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `certificates-${event.title.slice(0, 30)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Generated ${successCount} of ${selected.length} certificates as PDF`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF", {
        description: (error as Error).message,
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (eventsLoading) {
    return (
      <AppShell title="Certificates">
        <div className="flex h-96 items-center justify-center">
          <div className="text-foreground-muted">Loading events...</div>
        </div>
      </AppShell>
    );
  }

  if (events.length === 0) {
    return (
      <AppShell title="Certificates">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <Icon name="description" size={48} className="text-foreground-muted" />
          <h2 className="mt-4 font-heading text-xl font-semibold">No events found</h2>
          <p className="mt-2 text-sm text-foreground-muted max-w-md">
            You need to have events with registered participants to generate certificates.
          </p>
          <Link to="/create" className="btn-primary mt-6">
            <Icon name="add" size={18} /> Create Event
          </Link>
        </div>
      </AppShell>
    );
  }

  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <AppShell title="Certificates">
      <div className="space-y-8">
        {/* Header */}
        <header className="flex items-end justify-between">
          <div>
            <div className="label-eyebrow">Certificates</div>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight lg:text-4xl">
              Generate Certificates
            </h1>
            <p className="mt-1 text-base text-foreground-secondary">
              Create professional certificates for event participants. Choose a template and generate as PNG images in a ZIP file.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="btn-secondary h-9 text-xs"
            >
              <Icon name="refresh" size={16} /> Refresh
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="eventra-card p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Event selector */}
            <div>
              <label className="label-eyebrow">Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Template selector */}
            <div>
              <label className="label-eyebrow">Template</label>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setTemplate("elegant")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    template === "elegant"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-surface-secondary"
                  }`}
                >
                  Elegant
                </button>
                <button
                  onClick={() => setTemplate("gold")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    template === "gold"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-surface-secondary"
                  }`}
                >
                  Gold
                </button>
                <button
                  onClick={() => setTemplate("modern")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    template === "modern"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-surface-secondary"
                  }`}
                >
                  Modern
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAttendedOnly}
                  onChange={(e) => setIncludeAttendedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong"
                />
                Only attended students
              </label>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 w-full">
                <button
                  onClick={generateAndDownloadZIP}
                  disabled={generating || selectedStudents.size === 0 || !certificatesReady}
                  className="btn-primary flex-1 disabled:opacity-60"
                >
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {generationProgress}/{totalToGenerate}
                    </span>
                  ) : (
                    <>
                      <Icon name="folder_zip" size={18} />
                      Download ZIP ({selectedStudents.size})
                    </>
                  )}
                </button>
                <button
                  onClick={generateAsPDF}
                  disabled={generating || selectedStudents.size === 0 || !certificatesReady}
                  className="btn-secondary disabled:opacity-60"
                  title="Download as PDF (single file)"
                >
                  <Icon name="picture_as_pdf" size={18} />
                </button>
              </div>
              {generating && (
                <div className="w-full h-1 bg-surface-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(generationProgress / totalToGenerate) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-foreground-muted border-t border-border">
            <span>Total: <strong className="text-foreground">{registrations.length}</strong></span>
            <span>Attended: <strong className="text-success">{registrations.filter(s => s.checked_in).length}</strong></span>
            <span>Selected: <strong className="text-primary">{selectedStudents.size}</strong></span>
            <button
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {selectedStudents.size === filteredStudents.length ? "Deselect All" : "Select All"}
            </button>
            {!certificatesReady && registrations.length > 0 && (
              <span className="text-xs text-foreground-muted">Loading certificates...</span>
            )}
          </div>
        </div>

        {/* Student List + Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
          {/* Student List */}
          <div className="eventra-card overflow-hidden">
            <div className="border-b border-border p-4">
              <h3 className="font-heading text-sm font-semibold">Participants</h3>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-sm text-foreground-muted">
                  No participants found
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredStudents.map((s) => (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer ${
                        previewStudentId === s.id
                          ? "bg-primary/10"
                          : "hover:bg-surface-secondary"
                      }`}
                      onClick={() => setPreviewStudentId(s.id)}
                    >
                      <Checkbox
                        checked={selectedStudents.has(s.id)}
                        onCheckedChange={() => toggleStudent(s.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="truncate text-xs text-foreground-muted">
                          {s.department || "No department"} • {s.roll_number || "No roll"}
                        </div>
                      </div>
                      {s.checked_in ? (
                        <Badge variant="default" className="text-[10px] bg-success">✓ Attended</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Registered</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="eventra-card overflow-hidden">
            <div className="border-b border-border p-4 flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold">Preview</h3>
              {previewStudent && (
                <span className="text-xs text-foreground-muted">
                  {previewStudent.name}
                </span>
              )}
            </div>
            <div className="flex items-center justify-center p-4 bg-surface-secondary/50 min-h-[420px]">
              {previewStudent ? (
                <div 
                  ref={(el) => {
                    if (el && previewStudent) {
                      certRefs.current.set(previewStudent.id, el);
                    }
                  }}
                  data-certificate
                  style={{ display: 'block', visibility: 'visible', opacity: 1 }}
                >
                  <CertificateTemplate
                    student={previewStudent}
                    event={currentEvent!}
                    template={template}
                  />
                </div>
              ) : (
                <div className="text-center text-foreground-muted">
                  <Icon name="visibility" size={32} />
                  <p className="mt-2 text-sm">Select a participant to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden certificate renderer for all students */}
        <div 
          style={{ 
            position: 'fixed', 
            left: '-9999px', 
            top: '0',
            width: '900px',
            height: '636px',
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: 0,
            zIndex: -1
          }}
        >
          {registrations.map((s) => (
            <div 
              key={s.id} 
              ref={(el) => {
                if (el) {
                  certRefs.current.set(s.id, el);
                }
              }}
              data-certificate
              style={{ 
                display: 'block', 
                visibility: 'visible',
                opacity: 1,
                width: '900px',
                height: '636px'
              }}
            >
              <CertificateTemplate
                student={s}
                event={currentEvent!}
                template={template}
              />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Certificate Template Component ──────────────────────────────────────────

const CertificateTemplate = ({
  student,
  event,
  template,
}: {
  student: CertificateData;
  event: Event;
  template: CertificateTemplate;
}) => {
  const isAttended = student.checked_in;
  const certType = isAttended ? "Attendance" : "Participation";
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // ─── ELEGANT TEMPLATE ──────────────────────────────────────────────────────
  if (template === "elegant") {
    return (
      <div style={{
        width: '900px',
        height: '636px',
        backgroundColor: '#FBF9F6',
        borderRadius: '12px',
        border: '1px solid #E5E0D8',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Georgia", "Times New Roman", serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        {/* Decorative inner border */}
        <div style={{
          position: 'absolute',
          inset: '12px',
          border: '2px solid #D4C9B8',
          borderRadius: '8px',
          pointerEvents: 'none'
        }} />
        
        <div style={{
          position: 'absolute',
          inset: '18px',
          border: '1px solid #E8E2D8',
          borderRadius: '4px',
          pointerEvents: 'none'
        }} />

        {/* Top decorative bar */}
        <div style={{
          height: '6px',
          background: 'linear-gradient(to right, #8B7A5E, #C4A87C, #8B7A5E)',
          position: 'relative',
          zIndex: 1
        }} />

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 50px 25px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Decorative corners */}
          <div style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            width: '36px',
            height: '36px',
            borderTop: '2px solid #C4A87C',
            borderLeft: '2px solid #C4A87C',
            borderRadius: '2px 0 0 0'
          }} />
          <div style={{
            position: 'absolute',
            top: '30px',
            right: '30px',
            width: '36px',
            height: '36px',
            borderTop: '2px solid #C4A87C',
            borderRight: '2px solid #C4A87C',
            borderRadius: '0 2px 0 0'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '30px',
            width: '36px',
            height: '36px',
            borderBottom: '2px solid #C4A87C',
            borderLeft: '2px solid #C4A87C',
            borderRadius: '0 0 0 2px'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '30px',
            right: '30px',
            width: '36px',
            height: '36px',
            borderBottom: '2px solid #C4A87C',
            borderRight: '2px solid #C4A87C',
            borderRadius: '0 0 2px 0'
          }} />

          {/* Decorative emblem */}
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '2px solid #C4A87C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            background: 'rgba(196, 168, 124, 0.08)'
          }}>
            <span style={{ fontSize: '28px' }}>✦</span>
          </div>

          <p style={{
            fontSize: '13px',
            fontWeight: 400,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: '#8B7A5E',
            margin: 0,
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            Certificate of {certType}
          </p>

          <div style={{
            width: '80px',
            height: '1px',
            background: 'linear-gradient(to right, transparent, #C4A87C, transparent)',
            margin: '6px auto 8px'
          }} />

          <p style={{
            fontSize: '13px',
            color: '#8B7A5E',
            margin: 0,
            fontStyle: 'italic',
            letterSpacing: '0.05em'
          }}>
            This certifies that
          </p>

          <h1 style={{
            fontSize: '44px',
            fontWeight: 700,
            color: '#2C2420',
            margin: '4px 0 2px 0',
            letterSpacing: '0.02em',
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            {student.name}
          </h1>

          {student.department && (
            <p style={{
              fontSize: '15px',
              color: '#5A4F45',
              margin: '2px 0',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontStyle: 'italic'
            }}>
              {student.department}
              {student.roll_number && ` · ${student.roll_number}`}
            </p>
          )}

          {student.college_name && (
            <p style={{
              fontSize: '14px',
              color: '#7A6F65',
              margin: '0 0 4px 0',
              fontFamily: '"Georgia", "Times New Roman", serif'
            }}>
              {student.college_name}
            </p>
          )}

          <p style={{
            fontSize: '15px',
            color: '#5A4F45',
            margin: '4px 0',
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            has {isAttended ? "attended" : "participated in"}
          </p>

          <h2 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#2C2420',
            margin: '2px 0',
            fontFamily: '"Georgia", "Times New Roman", serif',
            letterSpacing: '0.01em'
          }}>
            {event.title}
          </h2>

          {event.description && (
            <p style={{
              fontSize: '13px',
              color: '#7A6F65',
              margin: '4px 0 6px',
              maxWidth: '550px',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontStyle: 'italic'
            }}>
              {event.description}
            </p>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '12px',
            color: '#8B7A5E',
            marginTop: '6px',
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            <span>{event.venue}</span>
            <span style={{ width: '1px', height: '10px', backgroundColor: '#D4C9B8' }} />
            <span>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</span>
            <span style={{ width: '1px', height: '10px', backgroundColor: '#D4C9B8' }} />
            <span>{formatDate(event.start_time)}</span>
          </div>

          <div style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontSize: '10px',
            color: '#B0A59A',
            fontFamily: '"Georgia", "Times New Roman", serif',
            letterSpacing: '0.05em'
          }}>
            <span>Certificate ID: {student.id.slice(0, 8).toUpperCase()}</span>
            <span style={{ width: '1px', height: '8px', backgroundColor: '#D4C9B8' }} />
            <span>Issued: {currentDate}</span>
          </div>
        </div>

        {/* Bottom decorative bar */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(to right, transparent, #C4A87C, transparent)',
          position: 'relative',
          zIndex: 1
        }} />
      </div>
    );
  }

  // ─── GOLD TEMPLATE ──────────────────────────────────────────────────────────
  if (template === "gold") {
    return (
      <div style={{
        width: '900px',
        height: '636px',
        backgroundColor: '#1A1A1A',
        borderRadius: '12px',
        border: '1px solid #C9A84C',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Georgia", "Times New Roman", serif',
        boxShadow: '0 4px 30px rgba(201, 168, 76, 0.15)'
      }}>
        {/* Gold border frame */}
        <div style={{
          position: 'absolute',
          inset: '10px',
          border: '2px solid #C9A84C',
          borderRadius: '8px',
          pointerEvents: 'none',
          opacity: 0.6
        }} />
        
        <div style={{
          position: 'absolute',
          inset: '16px',
          border: '1px solid rgba(201, 168, 76, 0.3)',
          borderRadius: '4px',
          pointerEvents: 'none'
        }} />

        {/* Top gold bar */}
        <div style={{
          height: '5px',
          background: 'linear-gradient(to right, transparent, #C9A84C, #F4D47C, #C9A84C, transparent)',
          position: 'relative',
          zIndex: 1
        }} />

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 50px 25px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Gold corner accents */}
          <div style={{
            position: 'absolute',
            top: '28px',
            left: '28px',
            width: '30px',
            height: '30px',
            borderTop: '2px solid #C9A84C',
            borderLeft: '2px solid #C9A84C',
            borderRadius: '2px 0 0 0',
            opacity: 0.7
          }} />
          <div style={{
            position: 'absolute',
            top: '28px',
            right: '28px',
            width: '30px',
            height: '30px',
            borderTop: '2px solid #C9A84C',
            borderRight: '2px solid #C9A84C',
            borderRadius: '0 2px 0 0',
            opacity: 0.7
          }} />
          <div style={{
            position: 'absolute',
            bottom: '28px',
            left: '28px',
            width: '30px',
            height: '30px',
            borderBottom: '2px solid #C9A84C',
            borderLeft: '2px solid #C9A84C',
            borderRadius: '0 0 0 2px',
            opacity: 0.7
          }} />
          <div style={{
            position: 'absolute',
            bottom: '28px',
            right: '28px',
            width: '30px',
            height: '30px',
            borderBottom: '2px solid #C9A84C',
            borderRight: '2px solid #C9A84C',
            borderRadius: '0 0 2px 0',
            opacity: 0.7
          }} />

          {/* Gold emblem */}
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '2px solid #C9A84C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            background: 'rgba(201, 168, 76, 0.05)'
          }}>
            <span style={{ fontSize: '30px' }}>🏆</span>
          </div>

          <p style={{
            fontSize: '12px',
            fontWeight: 300,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: '#C9A84C',
            margin: 0,
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            Certificate of {certType}
          </p>

          <div style={{
            width: '100px',
            height: '1px',
            background: 'linear-gradient(to right, transparent, #C9A84C, transparent)',
            margin: '6px auto 10px'
          }} />

          <p style={{
            fontSize: '13px',
            color: '#C9A84C',
            margin: 0,
            fontFamily: '"Georgia", "Times New Roman", serif',
            letterSpacing: '0.1em'
          }}>
            This certifies that
          </p>

          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            color: '#F4D47C',
            margin: '4px 0 2px 0',
            letterSpacing: '0.03em',
            fontFamily: '"Georgia", "Times New Roman", serif',
            textShadow: '0 0 30px rgba(201, 168, 76, 0.1)'
          }}>
            {student.name}
          </h1>

          {student.department && (
            <p style={{
              fontSize: '15px',
              color: '#C9A84C',
              margin: '2px 0',
              fontFamily: '"Georgia", "Times New Roman", serif',
              opacity: 0.8
            }}>
              {student.department}
              {student.roll_number && ` · ${student.roll_number}`}
            </p>
          )}

          {student.college_name && (
            <p style={{
              fontSize: '14px',
              color: '#A89060',
              margin: '0 0 4px 0',
              fontFamily: '"Georgia", "Times New Roman", serif'
            }}>
              {student.college_name}
            </p>
          )}

          <p style={{
            fontSize: '15px',
            color: '#C9A84C',
            margin: '4px 0',
            fontFamily: '"Georgia", "Times New Roman", serif',
            opacity: 0.8
          }}>
            has {isAttended ? "attended" : "participated in"}
          </p>

          <h2 style={{
            fontSize: '30px',
            fontWeight: 600,
            color: '#F4D47C',
            margin: '2px 0',
            fontFamily: '"Georgia", "Times New Roman", serif',
            letterSpacing: '0.02em'
          }}>
            {event.title}
          </h2>

          {event.description && (
            <p style={{
              fontSize: '13px',
              color: '#A89060',
              margin: '4px 0 6px',
              maxWidth: '550px',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontStyle: 'italic'
            }}>
              {event.description}
            </p>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '12px',
            color: '#A89060',
            marginTop: '6px',
            fontFamily: '"Georgia", "Times New Roman", serif'
          }}>
            <span>{event.venue}</span>
            <span style={{ width: '1px', height: '10px', backgroundColor: 'rgba(201, 168, 76, 0.3)' }} />
            <span>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</span>
            <span style={{ width: '1px', height: '10px', backgroundColor: 'rgba(201, 168, 76, 0.3)' }} />
            <span>{formatDate(event.start_time)}</span>
          </div>

          <div style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontSize: '10px',
            color: '#6A6050',
            fontFamily: '"Georgia", "Times New Roman", serif',
            letterSpacing: '0.05em'
          }}>
            <span>Certificate ID: {student.id.slice(0, 8).toUpperCase()}</span>
            <span style={{ width: '1px', height: '8px', backgroundColor: 'rgba(201, 168, 76, 0.3)' }} />
            <span>Issued: {currentDate}</span>
          </div>
        </div>

        {/* Bottom gold bar */}
        <div style={{
          height: '5px',
          background: 'linear-gradient(to right, transparent, #C9A84C, #F4D47C, #C9A84C, transparent)',
          position: 'relative',
          zIndex: 1
        }} />
      </div>
    );
  }

  // ─── MODERN TEMPLATE ──────────────────────────────────────────────────────
  return (
    <div style={{
      width: '900px',
      height: '636px',
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E8ECF0',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
    }}>
      {/* Left accent panel */}
      <div style={{
        width: '220px',
        background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
        color: 'white',
        position: 'relative',
        flexShrink: 0
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '30px',
          right: '20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.02)',
        }} />
        
        {/* Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          position: 'relative',
          zIndex: 1
        }}>
          <span style={{ fontSize: '30px' }}>📜</span>
        </div>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginBottom: '4px'
          }}>
            Certificate
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            marginBottom: '6px'
          }}>
            {certType}
          </div>
          <div style={{
            width: '30px',
            height: '1px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            margin: '8px auto'
          }} />
          <div style={{
            fontSize: '11px',
            opacity: 0.5,
            fontFamily: 'monospace'
          }}>
            #{student.id.slice(0, 8).toUpperCase()}
          </div>
          <div style={{
            fontSize: '11px',
            opacity: 0.4,
            marginTop: '4px'
          }}>
            {formatDate(event.start_time)}
          </div>
        </div>
      </div>

      {/* Right content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 40px 25px',
        textAlign: 'center',
        background: '#FFFFFF'
      }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          margin: 0
        }}>
          Awarded to
        </p>

        <h1 style={{
          fontSize: '42px',
          fontWeight: 700,
          color: '#0F172A',
          margin: '4px 0 2px 0',
          letterSpacing: '-0.02em'
        }}>
          {student.name}
        </h1>

        {student.department && (
          <p style={{
            fontSize: '14px',
            color: '#475569',
            margin: '2px 0',
            fontWeight: 400
          }}>
            {student.department}
            {student.roll_number && ` · ${student.roll_number}`}
          </p>
        )}

        {student.college_name && (
          <p style={{
            fontSize: '13px',
            color: '#64748B',
            margin: '0 0 4px 0'
          }}>
            {student.college_name}
          </p>
        )}

        <div style={{
          width: '50px',
          height: '2px',
          backgroundColor: '#E2E8F0',
          margin: '8px auto'
        }} />

        <p style={{
          fontSize: '14px',
          color: '#475569',
          margin: '4px 0'
        }}>
          for {isAttended ? "attending" : "participating in"}
        </p>

        <h2 style={{
          fontSize: '26px',
          fontWeight: 600,
          color: '#0F172A',
          margin: '2px 0'
        }}>
          {event.title}
        </h2>

        {event.description && (
          <p style={{
            fontSize: '13px',
            color: '#64748B',
            margin: '4px 0 6px',
            maxWidth: '480px',
            lineHeight: 1.4
          }}>
            {event.description}
          </p>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: '#94A3B8',
          marginTop: '6px'
        }}>
          <span>{event.venue}</span>
          <span style={{ width: '1px', height: '10px', backgroundColor: '#E2E8F0' }} />
          <span>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</span>
          <span style={{ width: '1px', height: '10px', backgroundColor: '#E2E8F0' }} />
          <span>{formatDate(event.start_time)}</span>
        </div>

        <div style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '10px',
          color: '#CBD5E1',
          fontFamily: 'monospace'
        }}>
          <span>Issued: {currentDate}</span>
          <span style={{ width: '1px', height: '8px', backgroundColor: '#E2E8F0' }} />
          <span>ID: {student.id.slice(0, 12)}</span>
        </div>

        {/* Bottom status indicator */}
        <div style={{
          marginTop: '12px',
          padding: '4px 16px',
          borderRadius: '20px',
          backgroundColor: isAttended ? '#ECFDF5' : '#F1F5F9',
          fontSize: '10px',
          fontWeight: 500,
          color: isAttended ? '#065F46' : '#475569',
          letterSpacing: '0.05em'
        }}>
          {isAttended ? '✓ Attendance Confirmed' : '✓ Participation Confirmed'}
        </div>
      </div>
    </div>
  );
};

export default Certificates;