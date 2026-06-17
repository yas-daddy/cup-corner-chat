import { Link } from "@tanstack/react-router";
import { Home, Trophy, ListChecks, Goal, DollarSign } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BottomNav() {
  const { t } = useI18n();
  const items = [
    { to: "/", label: t("home"), Icon: Home },
    { to: "/bet", label: t("bet"), Icon: DollarSign },
    { to: "/results", label: t("results"), Icon: Goal },
    { to: "/leaderboard", label: t("leaderboard"), Icon: Trophy },
    { to: "/my-picks", label: t("my_picks"), Icon: ListChecks },
  ] as const;

  return (
    <nav className="tab-bar">
      {items.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-ink-soft" }}
          className="flex flex-col items-center justify-center gap-1 py-1 text-xs font-medium"
        >
          <Icon className="h-6 w-6" strokeWidth={2.2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
