import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { JudgeModeProvider } from "../lib/judge-mode";
import { AppLayout } from "../components/layout/AppLayout";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-atmosphere px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-cream">404</h1>
        <p className="mt-4 text-muted">This page is not in the archive.</p>
        <Link to="/" className="ghost-btn mt-8 inline-block">
          Return to Portal
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-atmosphere px-4">
      <div className="max-w-md text-center">
        <h1 className="section-title text-2xl">Something interrupted the review board.</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="gold-btn mt-8"
        >
          Reconvene
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shura — Clinical AI Council" },
      { name: "description", content: "Shura — a transparent multi-agent clinical review system supporting physician decision-making." },
      { property: "og:title", content: "Shura — Clinical AI Council" },
      { property: "og:description", content: "Transparent multi-agent clinical review board with full provenance, grounding validation, and human oversight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <JudgeModeProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
        <Toaster theme="dark" position="top-right" />
      </JudgeModeProvider>
    </QueryClientProvider>
  );
}
