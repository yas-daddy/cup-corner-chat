import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Trophy, ListChecks, Goal, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const [gamesNew, setGamesNew] = useState(false);

  useEffect(() => {
    try {
      setGamesNew(localStorage.getItem("wc26.games.visited") !== "1");
    } catch {
      /* noop */
    }
    const onStorage = () => {
      try {
        setGamesNew(localStorage.getItem("wc26.games.visited") !== "1");
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const items = [
    { to: "/", label: t("home"), Icon: Home, badge: false },
    { to: "/games", label: t("games") ?? "Games", Icon: Gamepad2, badge: gamesNew },
    { to: "/games", label: t("games") ?? "Games", Icon: Gamepad2, badge: gamesNew },
    { to: "/results", label: t("results"), Icon: Goal, badge: false },
    { to: "/leaderboard", label: t("leaderboard"), Icon: Trophy, badge: false },
    { to: "/my-picks", label: t("my_picks"), Icon: ListChecks, badge: false },
  ] as const;

  return (
    <nav className="tab-bar">
      {items.map(({ to, label, Icon, badge }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-ink-soft" }}
          className="relative flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium"
        >
          <span className="relative">
            <Icon className="h-6 w-6" strokeWidth={2.2} />
            {badge && (
              <span className="absolute -right-1 -top-1 inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--gold)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--gold)]" />
              </span>
            )}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
