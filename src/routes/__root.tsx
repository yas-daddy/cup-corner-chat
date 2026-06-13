import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { BottomNav } from "@/components/BottomNav";
import { I18nContext, useLangBootstrap } from "@/lib/i18n";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
      { title: "WC26 Predictor" },
      { name: "description", content: "Predict World Cup 2026 matches with friends and family." },
      { name: "theme-color", content: "#6d28d9" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "WC26" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Vazirmatn:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="grid min-h-[80vh] place-items-center p-6 text-center">
      <div>
        <div className="text-5xl">🤷</div>
        <p className="mt-3 text-ink-soft">Page not found</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid min-h-[80vh] place-items-center p-6 text-center">
      <div>
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-2 text-sm text-ink-soft">{error.message}</p>
      </div>
    </div>
  ),
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
  const i18n = useLangBootstrap();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nContext.Provider value={i18n}>
        <div className="app-shell">
          <Outlet />
          <BottomNav />
        </div>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
}
