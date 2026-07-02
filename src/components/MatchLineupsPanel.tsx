import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";

const sb = supabase as unknown as {
  from: (t: string) => any;
  channel: (name: string) => any;
  removeChannel: (ch: unknown) => unknown;
};

type LineupPlayer = {
  match_id: string;
  team_code: string;
  idx: number;
  full_name: string;
  jersey_number: number | null;
  position: string | null;
  is_starter: boolean;
  captain: boolean;
  formation: string | null;
};

// Shows the starting XI and bench for a match. Silent (renders nothing) when
// ESPN hasn't published the sheet yet. Realtime subscription so when the sync
// route drops the sheet the panel appears without a reload.
export function MatchLineupsPanel({
  matchId,
  homeCode,
  awayCode,
  homeTeam,
  awayTeam,
}: {
  matchId: string;
  homeCode: string;
  awayCode: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const { t, tc } = useI18n();
  const [rows, setRows] = useState<LineupPlayer[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await sb
        .from("match_lineups")
        .select("*")
        .eq("match_id", matchId)
        .order("idx", { ascending: true });
      if (!active) return;
      setRows((data as LineupPlayer[] | null) ?? []);
    }
    void load();
    const ch = sb
      .channel(`lineups:${matchId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_lineups",
          filter: `match_id=eq.${matchId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      void sb.removeChannel(ch);
    };
  }, [matchId]);

  if (rows.length === 0) return null;

  const forCode = (code: string) => rows.filter((r) => r.team_code === code);
  const homeRows = forCode(homeCode);
  const awayRows = forCode(awayCode);

  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
        {t("lineups_title") ?? "Lineups"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <LineupColumn code={homeCode} team={homeTeam} players={homeRows} tc={tc} t={t} />
        <LineupColumn code={awayCode} team={awayTeam} players={awayRows} tc={tc} t={t} />
      </div>
    </section>
  );
}

function LineupColumn({
  code,
  team,
  players,
  tc,
  t,
}: {
  code: string;
  team: string;
  players: LineupPlayer[];
  tc: (s: string) => string;
  t: (k: string) => string;
}) {
  const starters = players.filter((p) => p.is_starter);
  const bench = players.filter((p) => !p.is_starter);
  const formation = starters[0]?.formation ?? players[0]?.formation ?? null;

  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-ink-soft">
        {t("lineup_not_published") ?? "Lineup not published yet."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none">{flagFromCode(code)}</span>
          <p className="truncate font-semibold">{tc(team)}</p>
        </div>
        {formation && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {formation}
          </span>
        )}
      </div>

      {starters.length > 0 && (
        <>
          <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
            {t("lineup_starters") ?? "Starting XI"}
          </p>
          <ul className="mb-3 space-y-0.5">
            {starters.map((p) => (
              <LineupRow key={`s-${p.idx}`} p={p} />
            ))}
          </ul>
        </>
      )}

      {bench.length > 0 && (
        <>
          <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
            {t("lineup_bench") ?? "Bench"} ({bench.length})
          </p>
          <ul className="space-y-0.5">
            {bench.map((p) => (
              <LineupRow key={`b-${p.idx}`} p={p} muted />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function LineupRow({ p, muted = false }: { p: LineupPlayer; muted?: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
        muted ? "text-ink-soft" : "text-ink"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold tabular-nums ring-1 ${
          muted
            ? "bg-bg text-ink-soft ring-border"
            : "bg-primary/15 text-primary ring-primary/30"
        }`}
      >
        {p.jersey_number ?? "?"}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {p.full_name}
        {p.captain && (
          <span className="ml-1 inline-flex items-center rounded-full bg-[color:var(--gold)]/20 px-1 text-[9px] font-extrabold text-[color:var(--gold)]">
            C
          </span>
        )}
      </span>
      {p.position && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-soft">
          {p.position}
        </span>
      )}
    </li>
  );
}
