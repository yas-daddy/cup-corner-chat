import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";
import { resolveBracket, type ResolvedMatch, type ResolvedSlot, type Round } from "@/lib/bracket";

type EspnMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  state: "pre" | "in" | "post";
  completed: boolean;
  clock_display: string | null;
  status_detail: string | null;
  group_label: string | null;
  linked_match_id: string | null;
  is_knockout?: boolean | null;
  advanced_side?: "home" | "away" | null;
};

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

const sb = supabase as unknown as {
  from: (t: string) => any;
  channel: (name: string) => any;
  removeChannel: (ch: unknown) => unknown;
};

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "WC26 — Results" },
      { name: "description", content: "Live World Cup 2026 scores, standings, and key events." },
    ],
  }),
  component: ResultsPage,
});

type SubTab = "fixtures" | "standings" | "bracket";

function ResultsPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<SubTab>("fixtures");
  const [matches, setMatches] = useState<EspnMatch[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [m, s] = await Promise.all([
      sb.from("espn_matches").select("*").order("kickoff_at", { ascending: true }),
      sb.from("espn_standings").select("*").order("group_label", { ascending: true }).order("rank", { ascending: true }),
    ]);
    setMatches((m.data as EspnMatch[]) ?? []);
    setStandings((s.data as Standing[]) ?? []);
    setLoading(false);
  }

  // Initial load
  useEffect(() => {
    void loadAll();
  }, []);

  // Realtime: patch matches/standings in place. Per-match events are loaded
  // on the match detail page (which the cards link into), not here.
  useEffect(() => {
    const ch = sb
      .channel("results_stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "espn_matches" }, (payload: any) => {
        const row = payload.new as EspnMatch | null;
        const old = payload.old as EspnMatch | null;
        setMatches((prev) => {
          if (payload.eventType === "DELETE" && old) return prev.filter((m) => m.id !== old.id);
          if (!row) return prev;
          const idx = prev.findIndex((m) => m.id === row.id);
          if (idx === -1) return [...prev, row].sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at));
          const next = prev.slice();
          next[idx] = row;
          return next;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "espn_standings" }, (payload: any) => {
        const row = payload.new as Standing | null;
        const old = payload.old as Standing | null;
        setStandings((prev) => {
          if (payload.eventType === "DELETE" && old)
            return prev.filter((s) => !(s.group_label === old.group_label && s.team_code === old.team_code));
          if (!row) return prev;
          const i = prev.findIndex((s) => s.group_label === row.group_label && s.team_code === row.team_code);
          if (i === -1) return [...prev, row];
          const next = prev.slice();
          next[i] = row;
          return next;
        });
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">{t("results") ?? "Results"}</h1>
        <p className="text-sm text-ink-soft">{t("results_subtitle") ?? "Live World Cup scores & standings"}</p>
      </header>

      <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1 text-sm font-medium">
        <SubTabBtn active={tab === "fixtures"} onClick={() => setTab("fixtures")}>
          {t("results_fixtures") ?? "Fixtures"}
        </SubTabBtn>
        <SubTabBtn active={tab === "standings"} onClick={() => setTab("standings")}>
          {t("results_standings") ?? "Standings"}
        </SubTabBtn>
        <SubTabBtn active={tab === "bracket"} onClick={() => setTab("bracket")}>
          {t("results_bracket") ?? "Bracket"}
        </SubTabBtn>
      </div>

      {loading && <div className="grid min-h-[40vh] place-items-center text-ink-soft">{t("loading")}</div>}

      {!loading && tab === "fixtures" && <FixturesView matches={matches} lang={lang} />}
      {!loading && tab === "standings" && <StandingsView rows={standings} />}
      {!loading && tab === "bracket" && <BracketView standings={standings} matches={matches} />}
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

function FixturesView({ matches, lang }: { matches: EspnMatch[]; lang: string }) {
  // Finished matches only, grouped by day, newest day first and newest-within-day first.
  const days = useMemo(() => {
    const past: Map<string, EspnMatch[]> = new Map();
    for (const m of matches) {
      if (m.state !== "post") continue;
      const day = new Date(m.kickoff_at).toLocaleDateString(lang === "fa" ? "fa-IR" : undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      if (!past.has(day)) past.set(day, []);
      past.get(day)!.push(m);
    }
    for (const list of past.values()) {
      list.sort((a, b) => +new Date(b.kickoff_at) - +new Date(a.kickoff_at));
    }
    return Array.from(past.entries()).reverse();
  }, [matches, lang]);

  if (!days.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        No finished matches yet.
      </div>
    );
  }

  return (
    <div>
      {days.map(([day, list]) => (
        <Section key={day} title={day}>
          {list.map((m) => (
            <FixtureRow key={m.id} m={m} />
          ))}
        </Section>
      ))}
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2
        className={`mb-2 px-1 text-sm font-bold uppercase tracking-wide ${
          accent ? "text-accent" : "text-ink-soft"
        }`}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FixtureRow({ m }: { m: EspnMatch }) {
  const homeCode = resolveTeamCode(m.home_code, m.home_team);
  const awayCode = resolveTeamCode(m.away_code, m.away_team);
  const time = new Date(m.kickoff_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel =
    m.state === "in" ? m.clock_display || "LIVE" : m.state === "post" ? "FT" : time;

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-ink-soft">
          {m.group_label ?? m.status_detail ?? ""}
        </span>
        <span
          className={`text-xs font-semibold ${
            m.state === "in" ? "text-accent" : "text-ink-soft"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{flagFromCode(homeCode)}</span>
          <span className="truncate font-semibold">{m.home_team}</span>
        </div>
        <div className="px-2 text-center text-lg font-extrabold tabular-nums">
          {m.state === "pre" ? "—" : `${m.home_score ?? 0} : ${m.away_score ?? 0}`}
        </div>
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="truncate text-end font-semibold">{m.away_team}</span>
          <span className="text-2xl">{flagFromCode(awayCode)}</span>
        </div>
      </div>
    </>
  );

  const className =
    "block rounded-2xl border border-border bg-surface p-3 transition active:opacity-80";

  if (m.linked_match_id) {
    return (
      <Link to="/matches/$matchId" params={{ matchId: m.linked_match_id }} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function StandingsView({ rows }: { rows: Standing[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Standing[]>();
    for (const r of rows) {
      const arr = map.get(r.group_label) ?? [];
      arr.push(r);
      map.set(r.group_label, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.pts - a.pts || b.gd - a.gd);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        Standings not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([name, list]) => (
        <section key={name}>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">{name}</h2>
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
                {list.map((r) => (
                  <tr key={r.team_code} className="border-t border-border/70">
                    <td className="py-2 pl-3">
                      <span className="mr-2 align-middle text-lg">{flagFromCode(r.team_code)}</span>
                      <span className="align-middle font-medium">{r.team_name}</span>
                    </td>
                    <td className="px-1 text-center tabular-nums">{r.gp}</td>
                    <td className="px-1 text-center tabular-nums">{r.w}</td>
                    <td className="px-1 text-center tabular-nums">{r.d}</td>
                    <td className="px-1 text-center tabular-nums">{r.l}</td>
                    <td className="px-1 text-center tabular-nums">
                      {r.gd > 0 ? `+${r.gd}` : r.gd}
                    </td>
                    <td className="px-2 text-right font-bold tabular-nums">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <BestThirdsTable groups={groups} />
    </div>
  );
}

function BestThirdsTable({ groups }: { groups: Array<[string, Standing[]]> }) {
  // Pick each group's 3rd-placed row (rank=3, or sorted index 2 if rank null).
  const thirds = useMemo(() => {
    const out: Array<Standing & { groupShort: string }> = [];
    for (const [name, list] of groups) {
      if (list.length < 3) continue;
      const sorted = list
        .slice()
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.pts - a.pts || b.gd - a.gd);
      const third = sorted[2];
      if (!third) continue;
      const m = name.match(/Group\s+([A-Z0-9]+)/i);
      out.push({ ...third, groupShort: m ? m[1].toUpperCase() : name });
    }
    out.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    return out;
  }, [groups]);

  if (thirds.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
        Best 3rd-Placed Teams
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-soft">
              <th className="py-2 pl-3 text-left font-medium">Team</th>
              <th className="px-1 text-center font-medium">Grp</th>
              <th className="px-1 text-center font-medium">P</th>
              <th className="px-1 text-center font-medium">W</th>
              <th className="px-1 text-center font-medium">D</th>
              <th className="px-1 text-center font-medium">L</th>
              <th className="px-1 text-center font-medium">GD</th>
              <th className="px-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {thirds.map((r, i) => {
              const cutoffRow = i === 7;
              const advances = i < 8;
              return (
                <FragmentRow
                  key={r.team_code + r.groupShort}
                  r={r}
                  advances={advances}
                  cutoffBelow={cutoffRow}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({
  r,
  advances,
  cutoffBelow,
}: {
  r: Standing & { groupShort: string };
  advances: boolean;
  cutoffBelow: boolean;
}) {
  return (
    <>
      <tr
        className={`border-t border-border/70 ${
          advances ? "" : "text-ink-soft opacity-70"
        }`}
      >
        <td className="py-2 pl-3">
          <span className="mr-2 align-middle text-lg">{flagFromCode(r.team_code)}</span>
          <span className="align-middle font-medium">{r.team_name}</span>
        </td>
        <td className="px-1 text-center text-xs font-semibold tracking-wider">{r.groupShort}</td>
        <td className="px-1 text-center tabular-nums">{r.gp}</td>
        <td className="px-1 text-center tabular-nums">{r.w}</td>
        <td className="px-1 text-center tabular-nums">{r.d}</td>
        <td className="px-1 text-center tabular-nums">{r.l}</td>
        <td className="px-1 text-center tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
        <td className="px-2 text-right font-bold tabular-nums">{r.pts}</td>
      </tr>
      {cutoffBelow && (
        <tr>
          <td colSpan={8} className="border-y-2 border-dashed border-success/60 bg-success/5 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-success">
            ── Qualifies for R32 above this line ──
          </td>
        </tr>
      )}
    </>
  );
}

const BRACKET_COLUMNS: { round: Round; title: string }[] = [
  { round: "R32", title: "Round of 32" },
  { round: "R16", title: "Round of 16" },
  { round: "QF", title: "Quarter-finals" },
  { round: "SF", title: "Semi-finals" },
  { round: "F", title: "Final" },
  { round: "3P", title: "3rd Place" },
];

function BracketView({ standings, matches }: { standings: Standing[]; matches: EspnMatch[] }) {
  const resolved = useMemo(
    () =>
      resolveBracket(
        standings.map((s) => ({
          group_label: s.group_label,
          team_code: s.team_code,
          team_name: s.team_name,
          rank: s.rank,
          pts: s.pts,
          gd: s.gd,
          gf: s.gf,
          gp: s.gp,
        })),
        matches.map((m) => ({
          state: m.state,
          home_code: m.home_code,
          away_code: m.away_code,
          home_team: m.home_team,
          away_team: m.away_team,
          home_score: m.home_score,
          away_score: m.away_score,
          is_knockout: !!m.is_knockout,
          advanced_side: m.advanced_side ?? null,
        })),
      ),
    [standings, matches],
  );

  // Index resolved bracket matches by their id so we can find scores from
  // ESPN's actual fixture data (matched by codes).
  const espnByPair = useMemo(() => {
    const map = new Map<string, EspnMatch>();
    for (const em of matches) {
      if (!em.home_code || !em.away_code) continue;
      map.set(pairKey(em.home_code, em.away_code), em);
    }
    return map;
  }, [matches]);

  const byRound = useMemo(() => {
    const map = new Map<Round, ResolvedMatch[]>();
    for (const r of resolved) {
      const arr = map.get(r.round) ?? [];
      arr.push(r);
      map.set(r.round, arr);
    }
    return map;
  }, [resolved]);

  // Fixed column height keeps R32 (16 matches) legible on wide screens; the
  // outer container is horizontally scrollable on mobile so nothing is cut.
  const columnHeight = 1120;
  // Columns are ordered R32 → R16 → QF → SF → F. The 3rd-place playoff is
  // rendered separately below since it doesn't participate in the vertical
  // pyramid.
  const mainRounds = BRACKET_COLUMNS.filter((c) => c.round !== "3P");

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex min-w-max items-stretch gap-0" style={{ height: columnHeight }}>
        {mainRounds.map((col, colIdx) => {
          const roundMatches = byRound.get(col.round) ?? [];
          const isLast = colIdx === mainRounds.length - 1;
          return (
            <div key={col.round} className="flex shrink-0 flex-col" style={{ width: 188 }}>
              <h3 className="h-6 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                {col.title}
              </h3>
              <div className="relative flex flex-1 flex-col justify-around py-1">
                {roundMatches.map((m, i) => (
                  <BracketSlot
                    key={m.id}
                    m={m}
                    espn={espnByPair.get(pairKey(m.top.team_code ?? "", m.bottom.team_code ?? ""))}
                    connector={isLast ? "none" : i % 2 === 0 ? "down" : "up"}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {byRound.get("3P")?.map((m) => (
        <div key={m.id} className="mt-6 w-full max-w-sm">
          <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
            3rd Place
          </h3>
          <BracketMatchCard
            m={m}
            espn={espnByPair.get(pairKey(m.top.team_code ?? "", m.bottom.team_code ?? ""))}
          />
        </div>
      ))}
    </div>
  );
}

function pairKey(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return "__none__";
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function BracketSlot({
  m,
  espn,
  connector,
}: {
  m: ResolvedMatch;
  espn: EspnMatch | undefined;
  connector: "up" | "down" | "none";
}) {
  return (
    <div className="relative flex flex-1 items-center px-1">
      <div className="w-full">
        <BracketMatchCard m={m} espn={espn} />
      </div>
      {connector !== "none" && (
        <>
          {/* Horizontal tail extending right from the card */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-full top-1/2 h-px bg-border/70"
            style={{ width: 12 }}
          />
          {/* Half of the vertical link between this card and its sibling */}
          <span
            aria-hidden
            className="pointer-events-none absolute border-border/70"
            style={{
              left: "calc(100% + 12px)",
              width: 0,
              borderLeftWidth: 1,
              borderLeftStyle: "solid",
              top: connector === "down" ? "50%" : "0",
              height: connector === "down" ? "50%" : "50%",
            }}
          />
          {/* Rightward horizontal into the next round — only from the middle
              of the pair. The bottom-of-pair slot draws this since its top
              starts at the pair's midpoint. */}
          {connector === "up" && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-full h-px bg-border/70"
              style={{ top: "0", width: 24 }}
            />
          )}
        </>
      )}
    </div>
  );
}

function BracketMatchCard({ m, espn }: { m: ResolvedMatch; espn: EspnMatch | undefined }) {
  const topWon = !!m.winner && m.winner.team_code != null && m.winner.team_code === m.top.team_code;
  const bottomWon = !!m.winner && m.winner.team_code != null && m.winner.team_code === m.bottom.team_code;
  const settled = !!m.winner;
  const live = espn?.state === "in";

  // Figure out which side of the ESPN row is which bracket slot so scores
  // line up with team labels even when home/away is swapped.
  let topScore: number | null = null;
  let bottomScore: number | null = null;
  if (espn && m.top.team_code && m.bottom.team_code) {
    if (espn.home_code === m.top.team_code) {
      topScore = espn.home_score;
      bottomScore = espn.away_score;
    } else if (espn.home_code === m.bottom.team_code) {
      topScore = espn.away_score;
      bottomScore = espn.home_score;
    }
  }

  return (
    <div
      className={`rounded-xl border bg-surface text-[11px] shadow-sm transition ${
        live
          ? "border-accent/60 ring-1 ring-accent/40"
          : settled
            ? "border-border"
            : "border-border/60"
      }`}
    >
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-ink-soft">
        <span>{m.label}</span>
        {live ? (
          <span className="font-semibold text-accent">{espn?.clock_display ?? "LIVE"}</span>
        ) : settled ? (
          <span>FT</span>
        ) : null}
      </div>
      <SlotRow s={m.top} won={topWon} dimmed={settled && !topWon} score={topScore} />
      <div className="mx-2 h-px bg-border/60" />
      <SlotRow s={m.bottom} won={bottomWon} dimmed={settled && !bottomWon} score={bottomScore} />
    </div>
  );
}

function SlotRow({
  s,
  won,
  dimmed,
  score,
}: {
  s: ResolvedSlot;
  won: boolean;
  dimmed: boolean;
  score: number | null;
}) {
  const concrete = !!s.team_name;
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 ${
        won
          ? "font-bold text-ink"
          : concrete
            ? dimmed
              ? "text-ink-soft"
              : "text-ink"
            : "italic text-ink-soft"
      }`}
    >
      <span className="text-sm leading-none">{s.team_code ? flagFromCode(s.team_code) : "🏳️"}</span>
      <span className="min-w-0 flex-1 truncate">{s.team_name ?? s.placeholder}</span>
      {score !== null && (
        <span className={`shrink-0 tabular-nums ${won ? "text-ink" : "text-ink-soft"}`}>
          {score}
        </span>
      )}
    </div>
  );
}
