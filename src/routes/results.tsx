import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";

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
};

type EspnEvent = {
  match_id: string;
  idx: number;
  type_text: string;
  clock_display: string | null;
  team_code: string | null;
  athlete_name: string | null;
  is_scoring_play: boolean;
  is_own_goal: boolean;
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
  const [events, setEvents] = useState<EspnEvent[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    let active = true;
    (async () => {
      const [m, s] = await Promise.all([
        sb.from("espn_matches").select("*").order("kickoff_at", { ascending: true }),
        sb.from("espn_standings").select("*").order("group_label", { ascending: true }).order("rank", { ascending: true }),
      ]);
      if (!active) return;
      setMatches((m.data as EspnMatch[]) ?? []);
      setStandings((s.data as Standing[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load events only for matches that are live or post (saves payload).
  useEffect(() => {
    const ids = matches.filter((m) => m.state !== "pre").map((m) => m.id);
    if (!ids.length) {
      setEvents([]);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await sb
        .from("espn_match_events")
        .select("*")
        .in("match_id", ids)
        .order("idx", { ascending: true });
      if (!active) return;
      setEvents((data as EspnEvent[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [matches]);

  // Realtime: patch matches/events/standings in place.
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "espn_match_events" }, (payload: any) => {
        const row = payload.new as EspnEvent;
        setEvents((prev) =>
          prev.some((e) => e.match_id === row.match_id && e.idx === row.idx) ? prev : [...prev, row],
        );
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

  const eventsByMatch = useMemo(() => {
    const map = new Map<string, EspnEvent[]>();
    for (const e of events) {
      const arr = map.get(e.match_id) ?? [];
      arr.push(e);
      map.set(e.match_id, arr);
    }
    return map;
  }, [events]);

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

      {!loading && tab === "fixtures" && (
        <FixturesView matches={matches} eventsByMatch={eventsByMatch} lang={lang} />
      )}
      {!loading && tab === "standings" && <StandingsView rows={standings} />}
      {!loading && tab === "bracket" && (
        <div className="grid min-h-[40vh] place-items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-ink-soft">
          <div>
            <div className="text-4xl">🏆</div>
            <p className="mt-3 text-sm">
              {t("results_bracket_empty") ?? "Available once knockouts begin."}
            </p>
          </div>
        </div>
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

function FixturesView({
  matches,
  eventsByMatch,
  lang,
}: {
  matches: EspnMatch[];
  eventsByMatch: Map<string, EspnEvent[]>;
  lang: string;
}) {
  const grouped = useMemo(() => {
    const live: EspnMatch[] = [];
    const past: Map<string, EspnMatch[]> = new Map();
    const upcoming: Map<string, EspnMatch[]> = new Map();
    for (const m of matches) {
      if (m.state === "in") {
        live.push(m);
        continue;
      }
      const day = new Date(m.kickoff_at).toLocaleDateString(lang === "fa" ? "fa-IR" : undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const target = m.state === "post" ? past : upcoming;
      if (!target.has(day)) target.set(day, []);
      target.get(day)!.push(m);
    }
    return { live, past, upcoming };
  }, [matches, lang]);

  if (!matches.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        No fixtures yet.
      </div>
    );
  }

  return (
    <div>
      {grouped.live.length > 0 && (
        <Section title="LIVE" accent>
          {grouped.live.map((m) => (
            <FixtureRow key={m.id} m={m} events={eventsByMatch.get(m.id) ?? []} />
          ))}
        </Section>
      )}
      {Array.from(grouped.past.entries())
        .reverse()
        .map(([day, list]) => (
          <Section key={`p-${day}`} title={day}>
            {list.map((m) => (
              <FixtureRow key={m.id} m={m} events={eventsByMatch.get(m.id) ?? []} />
            ))}
          </Section>
        ))}
      {Array.from(grouped.upcoming.entries()).map(([day, list]) => (
        <Section key={`u-${day}`} title={day}>
          {list.map((m) => (
            <FixtureRow key={m.id} m={m} events={eventsByMatch.get(m.id) ?? []} />
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

function FixtureRow({ m, events }: { m: EspnMatch; events: EspnEvent[] }) {
  const [open, setOpen] = useState(false);
  const hasEvents = events.length > 0;
  const homeCode = resolveTeamCode(m.home_code, m.home_team);
  const awayCode = resolveTeamCode(m.away_code, m.away_team);
  const time = new Date(m.kickoff_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel =
    m.state === "in"
      ? m.clock_display || "LIVE"
      : m.state === "post"
        ? "FT"
        : time;
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <button
        type="button"
        onClick={() => hasEvents && setOpen((v) => !v)}
        className="block w-full text-left"
      >
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
      </button>
      {open && hasEvents && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
          {events.map((e) => (
            <li
              key={`${e.match_id}-${e.idx}`}
              className="flex items-center gap-2 text-ink-soft"
            >
              <span className="w-10 shrink-0 font-mono tabular-nums">{e.clock_display ?? ""}</span>
              <span className="w-5 text-center">{iconForEvent(e)}</span>
              <span className="truncate">
                {e.athlete_name ?? ""}
                {e.is_own_goal ? " (OG)" : ""}
                {e.team_code ? ` — ${e.team_code}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function iconForEvent(e: EspnEvent) {
  const t = (e.type_text || "").toLowerCase();
  if (t.includes("yellow")) return "🟨";
  if (t.includes("red")) return "🟥";
  if (t.includes("goal") || e.is_scoring_play) return "⚽";
  return "•";
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
    </div>
  );
}
