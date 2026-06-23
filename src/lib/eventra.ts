import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type EventStatus = "draft" | "upcoming" | "ongoing" | "completed" | "cancelled";

export type Event = Tables<"evm_events">;
export type EventInsert = TablesInsert<"evm_events">;
export type EventAgenda = Tables<"evm_event_agenda">;
export type Registration = Tables<"evm_registrations">;
export type Review = Tables<"evm_reviews">;
export type AttendanceSession = Tables<"evm_attendance_sessions">;
export type AttendanceRecord = Tables<"evm_attendance_records">;
export type Notification = Tables<"evm_notifications">;
export type Profile = Tables<"evm_users">;

export const EVENT_TYPES = [
  "technical",
  "cultural",
  "sports",
  "workshop",
  "hackathon",
  "seminar",
  "social",
] as const;

const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&q=80",
  "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80",
];

export function defaultPoster(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_POSTERS[hash % FALLBACK_POSTERS.length];
}

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
