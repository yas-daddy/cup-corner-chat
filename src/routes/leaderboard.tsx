import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { useI18n } from "@/lib/i18n";
import { KARIM_ID } from "@/lib/bot";
import type { LeaderRow } from "@/lib/types";
import { Avatar } from "@/components/AvatarPicker";
import { ScoringHelpModal } from "@/components/ScoringHelpModal";

type BankRow = {
  player_id: string;
  display_name: string;
  avatar: string | null;
  balance: number;
  wins: number;
  losses: number;
  settled_count: number;
  biggest_win: number;
};

const sb = supabase as unknown as { from: (t: string) => any };


export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [{ title: "WC26 Predictor — Leaderboard" }],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { t, n } = useI18n();
  const { player } = useCurrentPlayer();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useState<"list" | "bank">("list");

  useEffect(() => {
    supabase
      .from("leaderboard")
      .select("*")
      .order("total_points", { ascending: false })
      .then(({ data }) => setRows(((data as LeaderRow[] | null) ?? []).filter((r) => r != null && r.player_id !== KARIM_ID)));
    sb
      .from("bank_leaderboard")
      .select("*")
      .order("balance", { ascending: false })
      .then(({ data }: { data: BankRow[] | null }) =>
        setBankRows((data ?? []).filter((r) => r != null && r.player_id !== KARIM_ID)),
      );
  }, []);

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("app_name")}</p>
          <h1 className="text-2xl font-extrabold">{t("leaderboard")}</h1>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label={t("scoring_help_title")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-soft active:opacity-80"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </header>

      {helpOpen && <ScoringHelpModal onClose={() => setHelpOpen(false)} />}

      <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex-1 rounded-xl px-3 py-2 transition ${
            view === "list" ? "bg-bg text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {t("leaderboard")}
        </button>
        <button
          type="button"
          onClick={() => setView("bank")}
          className={`flex-1 rounded-xl px-3 py-2 transition ${
            view === "bank" ? "bg-bg text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {t("bank") ?? "Bank"}
        </button>
      </div>

      {view === "bank" ? (
        <BankList rows={bankRows} currentPlayerId={player?.id ?? null} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("empty_leaderboard")}
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const isMe = player?.id === r.player_id;
            const rank = i + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            return (
              <li key={r.player_id}>
                <Link
                  to="/players/$playerId"
                  params={{ playerId: r.player_id }}
                  className={`flex items-center gap-3 rounded-2xl border bg-surface px-3 py-3 transition active:opacity-80 ${isMe ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                >
                  <div className="grid w-6 shrink-0 place-items-center text-sm font-bold text-ink-soft tabular-nums">
                    {medal ?? n(rank)}
                  </div>
                  <Avatar avatar={r.avatar} name={r.display_name} size={40} className="border border-border text-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.display_name}</p>
                    <p className="text-xs text-ink-soft">
                      {n(r.predictions_made)} {t("predictions")} · {n(r.correct_results)} {t("correct_results")} · {n(r.exact_scores)} {t("exact_scores")}
                    </p>
                  </div>

                  <div className="text-end">
                    <p className="text-xl font-extrabold text-[color:var(--gold)] tabular-nums">{n(r.total_points)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft">{t("pts")}</p>
                  </div>
                </Link>
              </li>

            );
          })}
        </ol>
      )}
    </div>
  );
}

function BankList({
  rows,
  currentPlayerId,
}: {
  rows: BankRow[];
  currentPlayerId: string | null;
}) {
  const { t, n } = useI18n();
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
        {t("empty_leaderboard")}
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const isMe = currentPlayerId === r.player_id;
        const rank = i + 1;
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
        return (
          <li key={r.player_id}>
            <Link
              to="/players/$playerId"
              params={{ playerId: r.player_id }}
              className={`flex items-center gap-3 rounded-2xl border bg-surface px-3 py-3 transition active:opacity-80 ${
                isMe ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <div className="grid w-6 shrink-0 place-items-center text-sm font-bold text-ink-soft tabular-nums">
                {medal ?? n(rank)}
              </div>
              <Avatar avatar={r.avatar} name={r.display_name} size={40} className="border border-border text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.display_name}</p>
                <p className="text-xs text-ink-soft">
                  {n(r.wins)}W · {n(r.losses)}L
                  {r.biggest_win > 0 && (
                    <> · {t("biggest_win") ?? "biggest"} ${n(r.biggest_win)}</>
                  )}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xl font-extrabold text-[color:var(--gold)] tabular-nums">
                  ${n(r.balance)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-ink-soft">
                  {t("balance") ?? "balance"}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
