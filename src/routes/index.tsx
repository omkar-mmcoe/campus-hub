import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eventra — Campus Operating System" },
      { name: "description", content: "Discover campus events, register, check in via QR, and review experiences — all in one place." },
      { property: "og:title", content: "Eventra — Campus Operating System" },
      { property: "og:description", content: "Discover campus events, register, check in via QR, and review experiences — all in one place." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80" },
    ],
  }),
  component: Welcome,
});

const slides = [
  {
    title: "Discover Campus Events",
    copy: "Hackathons, jazz nights, founder talks — see everything happening on your campus in one editorial feed.",
    img: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
  },
  {
    title: "Connect with Community",
    copy: "Meet students who share your interests. Build lasting bonds through shared experiences.",
    img: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&q=80",
  },
];

function Welcome() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-heading text-sm font-bold">E</span>
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">Eventra</span>
        </div>
        <Link to="/explore" className="text-sm font-medium text-foreground-muted hover:text-foreground">
          Browse events →
        </Link>
      </header>

      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-12 lg:py-20">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <img src={slides[0].img} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                <span className="tag-pill bg-white/15 text-white backdrop-blur">Featured</span>
                <h2 className="mt-4 font-heading text-3xl font-bold leading-tight">{slides[0].title}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">{slides[0].copy}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <img src={slides[1].img} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="label-eyebrow">Communities</div>
                <div className="mt-1 font-heading text-base font-semibold">{slides[1].title}</div>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5">
              <div>
                <div className="label-eyebrow">Trusted by</div>
                <div className="mt-2 font-heading text-3xl font-bold">240+</div>
                <div className="text-sm text-foreground-muted">campuses worldwide</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-foreground-secondary">
                <Icon name="verified" size={16} />
                Faculty-grade reliability
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <div className="label-eyebrow">Campus OS</div>
          <h1 className="mt-3 font-heading text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
            Welcome to Eventra
          </h1>
          <p className="mt-3 max-w-md text-base text-foreground-secondary">
            Events, registrations, attendance, and reviews — built for students, organizers, clubs, and faculty.
          </p>

          <div className="mt-8 space-y-3">
            <Link to="/auth" className="btn-primary w-full">
              <Icon name="login" size={18} /> Sign in or create account
            </Link>
            <Link to="/explore" className="btn-secondary w-full">
              <Icon name="explore" size={18} /> Browse events as guest
            </Link>
          </div>

          <p className="mt-6 text-xs text-foreground-muted">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </p>
        </section>
      </main>
    </div>
  );
}
