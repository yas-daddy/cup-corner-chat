import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";
import type { Match } from "@/lib/types";

type Standing = {
  group_label: string;
  team_code: string;
  team_name: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  rank: number | null;
};

const sb = supabase as unknown as { from: (t: string) => any };

type Tab = "matches" | "standing";

export const Route = createFileRoute("/teams/$teamCode")({
  head: ({ params }) => ({
    meta: [
      { title: `WC26 — ${params.teamCode}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { teamCode: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();
  const { t, tc, n } = useI18n();

  const [matches, setMatches] = useState<Match[]>([]);
  const [groupRows, setGroupRows] = useState<Standing[]>([]);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab | null>(null);

  // Matches involving this team.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await sb
        .from("matches")
        .select("*")
        .or(`home_code.eq.${code},away_code.eq.${code}`)
        .order("kickoff_at", { ascending: true });
      if (!active) return;
      const list = (data as Match[] | null) ?? [];
      setMatches(list);
      // Derive canonical team name from the first matching row.
      const first = list.find((m) => m.home_code === code) ?? list.find((m) => m.away_code === code);
      if (first) setTeamName(first.home_code === code ? first.home_team : first.away_team);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code]);

  // Standing: find the team's group, then load every row in that group.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: own } = await sb
        .from("espn_standings")
        .select("group_label")
        .eq("team_code", code)
        .maybeSingle();
      const group = (own as { group_label: string } | null)?.group_label;
      if (!group) {
        if (active) setGroupRows([]);
        return;
      }
      const { data: rows } = await sb
        .from("espn_standings")
        .select("*")
        .eq("group_label", group);
      if (!active) return;
      setGroupRows((rows as Standing[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [code]);

  // All matches in chronological order (oldest first → upcoming last).
  const sortedMatches = useMemo(
    () => matches.slice().sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at)),
    [matches],
  );

  // Pick the default tab once data is available.
  useEffect(() => {
    if (tab !== null || loading) return;
    setTab(sortedMatches.length ? "matches" : "standing");
  }, [tab, loading, sortedMatches.length]);

  const displayName = teamName ?? code;

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-3xl">{flagFromCode(code)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("team") ?? "Team"}</p>
          <h1 className="truncate text-xl font-extrabold">{tc(displayName)}</h1>
        </div>
      </header>

      <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1 text-sm font-medium">
        <SubTabBtn active={tab === "matches"} onClick={() => setTab("matches")}>
          {t("team_matches") ?? "Matches"}
        </SubTabBtn>
        <SubTabBtn active={tab === "standing"} onClick={() => setTab("standing")}>
          {t("team_standing") ?? "Standing"}
        </SubTabBtn>
      </div>

      {loading && (
        <div className="grid min-h-[30vh] place-items-center text-ink-soft">{t("loading")}</div>
      )}

      {!loading && tab === "matches" && (
        <MatchList matches={sortedMatches} code={code} emptyLabel={t("no_matches_yet") ?? "No matches yet."} />
      )}
      {!loading && tab === "standing" && (
        <StandingView rows={groupRows} highlightCode={code} n={n} t={t} />
      )}
    </div>
  );
}

function SubTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 transition ${
        active ? "bg-bg text-ink shadow-sm" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MatchList({
  matches,
  code,
  emptyLabel,
}: {
  matches: Match[];
  code: string;
  emptyLabel: string;
}) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {matches.map((m) => (
        <TeamMatchRow key={m.id} match={m} code={code} />
      ))}
    </ul>
  );
}

function TeamMatchRow({ match, code }: { match: Match; code: string }) {
  const { tc, n } = useI18n();
  const isHome = match.home_code === code;
  const opponentName = isHome ? match.away_team : match.home_team;
  const opponentCode = resolveTeamCode(
    isHome ? match.away_code : match.home_code,
    opponentName,
  );
  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const haveScore = match.home_score != null && match.away_score != null;
  const ourScore = isHome ? match.home_score : match.away_score;
  const theirScore = isHome ? match.away_score : match.home_score;

  return (
    <li>
      <Link
        to="/matches/$matchId"
        params={{ matchId: match.id }}
        className="block rounded-2xl border border-border bg-surface p-3 transition active:opacity-80"
      >
        <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
          <span className="truncate">
            {match.stage ?? ""}
            {match.group_name ? ` · ${match.group_name}` : ""}
          </span>
          <span className={live ? "font-semibold text-accent" : ""}>
            {finished ? "FT" : live ? "LIVE" : kickoff}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{flagFromCode(opponentCode)}</span>
            <span className="truncate font-semibold">{tc(opponentName)}</span>
          </div>
          {(finished || (live && haveScore)) && (
            <span className="rounded-full bg-bg px-3 py-1 text-sm font-bold tabular-nums shadow-sm ring-1 ring-border">
              {n(ourScore ?? 0)} : {n(theirScore ?? 0)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function StandingView({
  rows,
  highlightCode,
  n,
  t,
}: {
  rows: Standing[];
  highlightCode: string;
  n: (v: number) => string;
  t: (k: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("not_in_group_stage") ?? "Group stage standings unavailable."}
      </div>
    );
  }
  const sorted = rows.slice().sort((a, b) => {
    if (a.rank != null && b.rank != null && a.rank !== b.rank) return a.rank - b.rank;
    return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf;
  });
  const groupLabel = sorted[0]?.group_label ?? "";
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
        {groupLabel}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-soft">
              <th className="py-2 pl-3 text-left font-medium">Team</th>
              <th className="px-1 text-center font-medium">P</th>
              <th className="px-1 text-center font-medium">W</th>
              <th className="px-1 text-center font-medium">D</th>
              <th className="px-1 text-center font-medium">L</th>
              <th className="px-1 text-center font-medium">GD</th>
              <th className="px-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const mine = r.team_code === highlightCode;
              return (
                <tr
                  key={r.team_code}
                  className={`border-t border-border/70 ${mine ? "bg-primary/10" : ""}`}
                >
                  <td className="py-2 pl-3">
                    <span className="mr-2 align-middle text-lg">{flagFromCode(r.team_code)}</span>
                    <span className={`align-middle ${mine ? "font-bold text-ink" : "font-medium"}`}>
                      {r.team_name}
                    </span>
                  </td>
                  <td className="px-1 text-center tabular-nums">{n(r.gp)}</td>
                  <td className="px-1 text-center tabular-nums">{n(r.w)}</td>
                  <td className="px-1 text-center tabular-nums">{n(r.d)}</td>
                  <td className="px-1 text-center tabular-nums">{n(r.l)}</td>
                  <td className="px-1 text-center tabular-nums">
                    {r.gd > 0 ? `+${n(r.gd)}` : n(r.gd)}
                  </td>
                  <td className="px-2 text-right font-bold tabular-nums">{n(r.pts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
