import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";
import { Minus, Plus, Check } from "lucide-react";
import {
  MAX_STAKE_PCT,
  potentialPayout,
  type Selection,
} from "@/lib/bet-config";
import { formatDecimal } from "@/lib/odds";

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  kickoff_at: string;
  status: string;
};

type EspnOdds = {
  linked_match_id: string | null;
  odds_provider: string | null;
  odds_home_decimal: number | null;
  odds_draw_decimal: number | null;
  odds_away_decimal: number | null;
};

type Bet = {
  id: string;
  player_id: string;
  match_id: string;
  selection: Selection;
  stake: number;
  decimal_odds: number;
  status: "pending" | "won" | "lost" | "void";
  payout: number | null;
  placed_at: string;
  settled_at: string | null;
};

const sb = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (ch: unknown) => unknown;
};

const PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export const Route = createFileRoute("/bet")({
  head: () => ({
    meta: [
      { title: "WC26 — Bet" },
      { name: "description", content: "Place dollar-bets on World Cup matches." },
    ],
  }),
  component: BetPage,
});

type Tab = "place" | "my";

function BetPage() {
  const { t } = useI18n();
  const { player, loading: playerLoading, setPlayer } = useCurrentPlayer();
  const [tab, setTab] = useState<Tab>("place");

  if (playerLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">{t("bet") ?? "Bet"}</h1>
        <p className="text-sm text-ink-soft">{t("bet_subtitle") ?? "Wager dollars on 1X2 odds"}</p>
      </header>

      <BalanceHeader playerId={player.id} />

      <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1 text-sm font-medium">
        <SubTabBtn active={tab === "place"} onClick={() => setTab("place")}>
          {t("place_bet") ?? "Place"}
        </SubTabBtn>
        <SubTabBtn active={tab === "my"} onClick={() => setTab("my")}>
          {t("my_bets") ?? "My Bets"}
        </SubTabBtn>
      </div>

      {tab === "place" && <PlaceView playerId={player.id} />}
      {tab === "my" && <MyBetsView playerId={player.id} />}
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

function useBalance(playerId: string | null): number {
  const [bal, setBal] = useState(0);
  useEffect(() => {
    if (!playerId) return;
    let active = true;
    (async () => {
      const { data } = await sb
        .from("bank_balances")
        .select("balance")
        .eq("player_id", playerId)
        .maybeSingle();
      if (!active) return;
      setBal((data as { balance: number } | null)?.balance ?? 0);
    })();
    const ch = sb
      .channel(`bal:${playerId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bet_transactions",
          filter: `player_id=eq.${playerId}`,
        },
        async () => {
          const { data } = await sb
            .from("bank_balances")
            .select("balance")
            .eq("player_id", playerId)
            .maybeSingle();
          if (active) setBal((data as { balance: number } | null)?.balance ?? 0);
        },
      )
      .subscribe();
    return () => {
      active = false;
      void sb.removeChannel(ch);
    };
  }, [playerId]);
  return bal;
}

function BalanceHeader({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const balance = useBalance(playerId);
  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-ink-soft">
        {t("balance") ?? "Balance"}
      </p>
      <p className="text-3xl font-extrabold tabular-nums text-[color:var(--gold)]">
        ${balance}
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        {t("max_stake_hint") ?? "Max stake per bet"}: ${Math.floor(balance * MAX_STAKE_PCT)}
      </p>
    </div>
  );
}

// --- Place view -----------------------------------------------------------

function PlaceView({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [oddsByMatch, setOddsByMatch] = useState<Record<string, EspnOdds>>({});
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const nowIso = new Date().toISOString();
      const [m, espn, b] = await Promise.all([
        sb
          .from("matches")
          .select("id, home_team, away_team, home_code, away_code, kickoff_at, status")
          .gt("kickoff_at", nowIso)
          .eq("status", "SCHEDULED")
          .order("kickoff_at", { ascending: true }),
        sb
          .from("espn_matches")
          .select(
            "linked_match_id, odds_provider, odds_home_decimal, odds_draw_decimal, odds_away_decimal",
          )
          .not("linked_match_id", "is", null),
        sb
          .from("bets")
          .select("*")
          .eq("player_id", playerId)
          .eq("status", "pending"),
      ]);
      if (!active) return;
      setMatches((m.data as Match[]) ?? []);
      const odds: Record<string, EspnOdds> = {};
      for (const r of (espn.data as EspnOdds[]) ?? []) {
        if (r.linked_match_id) odds[r.linked_match_id] = r;
      }
      setOddsByMatch(odds);
      setBets((b.data as Bet[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [playerId]);

  // Realtime: re-fetch my bets when the bets table updates.
  useEffect(() => {
    const ch = sb
      .channel(`my_bets:${playerId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `player_id=eq.${playerId}` },
        async () => {
          const { data } = await sb
            .from("bets")
            .select("*")
            .eq("player_id", playerId)
            .eq("status", "pending");
          setBets((data as Bet[]) ?? []);
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [playerId]);

  const betByMatch = useMemo(() => {
    const m = new Map<string, Bet>();
    for (const b of bets) m.set(b.match_id, b);
    return m;
  }, [bets]);

  const matchesWithOdds = useMemo(
    () =>
      matches.filter((m) => {
        const o = oddsByMatch[m.id];
        return o && (o.odds_home_decimal || o.odds_draw_decimal || o.odds_away_decimal);
      }),
    [matches, oddsByMatch],
  );

  if (loading) {
    return <div className="grid min-h-[30vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }
  if (matchesWithOdds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("no_odds_yet") ?? "No upcoming matches with odds yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matchesWithOdds.map((m) => (
        <PlaceMatchCard
          key={m.id}
          match={m}
          odds={oddsByMatch[m.id]}
          playerId={playerId}
          existingBet={betByMatch.get(m.id) ?? null}
        />
      ))}
    </div>
  );
}

function PlaceMatchCard({
  match,
  odds,
  playerId,
  existingBet,
}: {
  match: Match;
  odds: EspnOdds;
  playerId: string;
  existingBet: Bet | null;
}) {
  const { t } = useI18n();
  const homeCode = resolveTeamCode(match.home_code, match.home_team);
  const awayCode = resolveTeamCode(match.away_code, match.away_team);
  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
        <span>{kickoff}</span>
        {odds.odds_provider && <span>{odds.odds_provider}</span>}
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{flagFromCode(homeCode)}</span>
          <span className="truncate font-semibold">{match.home_team}</span>
        </div>
        <span className="text-xs uppercase tracking-wider text-ink-soft">vs</span>
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="truncate font-semibold">{match.away_team}</span>
          <span className="text-2xl">{flagFromCode(awayCode)}</span>
        </div>
      </div>

      {existingBet ? (
        <PlacedSummary bet={existingBet} match={match} />
      ) : (
        <BetForm match={match} odds={odds} playerId={playerId} />
      )}
    </div>
  );
}

function BetForm({
  match,
  odds,
  playerId,
}: {
  match: Match;
  odds: EspnOdds;
  playerId: string;
}) {
  const { t } = useI18n();
  const balance = useBalance(playerId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [stake, setStake] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const odd =
    selection === "home"
      ? odds.odds_home_decimal
      : selection === "draw"
        ? odds.odds_draw_decimal
        : selection === "away"
          ? odds.odds_away_decimal
          : null;

  const maxStake = Math.max(1, Math.floor(balance * MAX_STAKE_PCT));

  async function submit() {
    if (!selection || !odd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/place-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({ player_id: playerId, match_id: match.id, selection, stake }),
      });
      const text = await res.text();
      let json: { ok?: boolean; error?: string } | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* server returned non-JSON (likely an HTML error page) */
      }
      if (!res.ok || !json?.ok) {
        const snippet = !json ? text.replace(/<[^>]+>/g, " ").trim().slice(0, 120) : "";
        setError(json?.error ?? `Server error ${res.status}${snippet ? ` — ${snippet}` : ""}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <OddsBtn
          label={t("bet_home") ?? "Home"}
          value={odds.odds_home_decimal}
          selected={selection === "home"}
          onClick={() => setSelection("home")}
        />
        <OddsBtn
          label={t("bet_draw") ?? "Draw"}
          value={odds.odds_draw_decimal}
          selected={selection === "draw"}
          onClick={() => setSelection("draw")}
        />
        <OddsBtn
          label={t("bet_away") ?? "Away"}
          value={odds.odds_away_decimal}
          selected={selection === "away"}
          onClick={() => setSelection("away")}
        />
      </div>

      {selection && odd && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-ink-soft">
              {t("stake") ?? "Stake"}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-border bg-bg p-1">
              <button
                type="button"
                onClick={() => setStake((s) => Math.max(1, s - 1))}
                className="grid h-7 w-7 place-items-center rounded-full text-ink-soft active:bg-surface"
                aria-label="Decrease stake"
              >
                <Minus className="h-3 w-3" />
              </button>
              <div className="flex items-center font-bold">
                <span className="text-ink-soft">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={stake}
                  aria-label="Stake"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const v = e.currentTarget.value.replace(/[^\d]/g, "");
                    if (v === "") {
                      setStake(0);
                      return;
                    }
                    const n = Math.min(maxStake, Math.max(0, parseInt(v, 10)));
                    setStake(n);
                  }}
                  onBlur={() => setStake((s) => Math.max(1, Math.min(maxStake, s || 1)))}
                  className="w-14 bg-transparent text-center tabular-nums outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setStake((s) => Math.min(maxStake, s + 1))}
                className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white active:opacity-90"
                aria-label="Increase stake"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {t("payout") ?? "Payout"}{" "}
            <span className="font-semibold text-[color:var(--gold)] tabular-nums">
              ${potentialPayout(stake, odd)}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-ink-soft">
            {t("bet_final_hint") ?? "Bets are final — no edits, no cancels."}
          </p>
          {error && <p className="mt-2 text-xs font-semibold text-accent">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || stake < 1}
            className="mt-3 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : (t("place_bet") ?? "Place bet")}
          </button>
        </div>
      )}
    </>
  );
}

function PlacedSummary({ bet, match }: { bet: Bet; match: Match }) {
  const { t } = useI18n();
  const sideLabel =
    bet.selection === "home"
      ? match.home_team
      : bet.selection === "away"
        ? match.away_team
        : (t("bet_draw") ?? "Draw");
  return (
    <div className="rounded-xl border border-success/40 bg-success/5 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-success">
          <Check className="h-4 w-4" />
          <span className="font-semibold">{t("bet_placed") ?? "Bet placed"}</span>
        </span>
        <span className="text-ink-soft text-xs">@ {formatDecimal(bet.decimal_odds)}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        <span className="font-semibold text-ink">{sideLabel}</span>{" "}
        · ${bet.stake} → {t("payout") ?? "payout"}{" "}
        <span className="font-semibold text-[color:var(--gold)]">
          ${potentialPayout(bet.stake, bet.decimal_odds)}
        </span>
      </p>
    </div>
  );
}

function OddsBtn({
  label,
  value,
  selected,
  onClick,
}: {
  label: string;
  value: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  const disabled = value == null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-2 py-3 transition ${
        disabled
          ? "border-border bg-surface text-ink-soft opacity-50"
          : selected
            ? "border-primary bg-primary/10 text-ink"
            : "border-border bg-bg text-ink-soft hover:text-ink"
      }`}
    >
      <span className="block text-[10px] uppercase tracking-wider">{label}</span>
      <span className="mt-0.5 block font-bold tabular-nums">
        {formatDecimal(value)}
      </span>
    </button>
  );
}

// --- My Bets view --------------------------------------------------------

type BetRow = Bet & {
  match: { home_team: string; away_team: string; home_code: string | null; away_code: string | null; kickoff_at: string } | null;
};

function MyBetsView({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await sb
      .from("bets")
      .select("*, match:matches(home_team, away_team, home_code, away_code, kickoff_at)")
      .eq("player_id", playerId)
      .order("placed_at", { ascending: false });
    setBets((data as BetRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const ch = sb
      .channel(`my_bets_full:${playerId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `player_id=eq.${playerId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  if (loading) {
    return <div className="grid min-h-[30vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }
  if (bets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("no_bets_yet") ?? "No bets placed yet."}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {bets.map((b) => (
        <BetCard key={b.id} bet={b} />
      ))}
    </ul>
  );
}

function BetCard({ bet }: { bet: BetRow }) {
  const { t } = useI18n();
  const m = bet.match;
  const homeCode = m ? resolveTeamCode(m.home_code, m.home_team) : null;
  const awayCode = m ? resolveTeamCode(m.away_code, m.away_team) : null;
  const sideLabel = bet.selection === "home" ? m?.home_team : bet.selection === "away" ? m?.away_team : t("bet_draw") ?? "Draw";
  // No badge for active (pending) bets — the bottom row already shows the
  // projected payout. Only show a result chip once the bet has settled.
  const statusTone =
    bet.status === "won"
      ? "text-success"
      : "text-ink-soft";
  const statusLabel =
    bet.status === "won"
      ? `+$${bet.payout ?? 0}`
      : bet.status === "lost"
        ? `−$${bet.stake}`
        : bet.status === "void"
          ? (t("bet_refunded") ?? "Refunded")
          : "";

  return (
    <li className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
        <span className="truncate">
          {m ? (
            <>
              <span className="mr-1">{flagFromCode(homeCode)}</span>
              {m.home_team} <span className="px-1">vs</span> {m.away_team}{" "}
              <span className="ml-1">{flagFromCode(awayCode)}</span>
            </>
          ) : (
            <span>Match</span>
          )}
        </span>
        <span className={`shrink-0 font-semibold ${statusTone}`}>{statusLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {sideLabel}
          <span className="ml-2 text-ink-soft">@ {formatDecimal(bet.decimal_odds)}</span>
        </span>
        <span className="tabular-nums text-ink-soft">
          ${bet.stake} → ${potentialPayout(bet.stake, bet.decimal_odds)}
        </span>
      </div>
    </li>
  );
}
