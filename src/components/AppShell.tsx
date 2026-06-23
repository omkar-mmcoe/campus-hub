import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-surface-secondary text-foreground-secondary",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`tag-pill capitalize ${tones[tone]}`}>{children}</span>;
}

const NAV: { to: string; label: string; icon: string }[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/explore", label: "Explore", icon: "explore" },
  { to: "/create", label: "Create event", icon: "add_circle" },
  { to: "/tickets", label: "My tickets", icon: "confirmation_number" },
  { to: "/attendance", label: "Attendance", icon: "qr_code_scanner" },
  { to: "/notifications", label: "Notifications", icon: "notifications" },
  { to: "/certificates", label: "Certificates", icon: "description" },
  { to: "/review", label: "Reviews", icon: "reviews" }
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const navList = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground-secondary hover:bg-surface-secondary hover:text-foreground"
            }`}
          >
            <Icon name={item.icon} size={20} filled={active} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-heading text-sm font-bold">E</span>
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">Eventra</span>
        </Link>
        {navList}
        <div className="mt-auto border-t border-border pt-4">
          <div className="flex items-center gap-3 px-2">
            <img
              src={profile?.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${profile?.name ?? "U"}`}
              alt=""
              className="h-9 w-9 rounded-full bg-surface-secondary"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{profile?.name || "Member"}</div>
              <div className="truncate text-xs text-foreground-muted capitalize">{profile?.role || "student"}</div>
            </div>
            <button onClick={handleSignOut} title="Sign out" className="text-foreground-muted hover:text-foreground">
              <Icon name="logout" size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col sticky top-0 z-30 ">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="font-heading text-sm font-bold">E</span>
            </div>
            <span className="font-heading text-base font-bold">Eventra</span>
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="text-foreground">
            <Icon name={open ? "close" : "menu"} size={24} />
          </button>
        </header>

        {open && (
          <div className="border-b border-border bg-surface px-4 py-4 lg:hidden">
            {navList}
            <button onClick={handleSignOut} className="btn-secondary mt-3 w-full">
              <Icon name="logout" size={18} /> Sign out
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
