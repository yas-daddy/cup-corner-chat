import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Lock, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Match, Prediction } from "@/lib/types";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import { useI18n } from "@/lib/i18n";

type Props = {
  match: Match;
  playerId: string;
  prediction: Prediction | null;
  onSaved?: (p: Prediction) => void;
};

export function MatchCard({ match, playerId, prediction, onSaved }: Props) {
  const { t, tc, n, lang, dir } = useI18n();
  const kickoff = new Date(match.kickoff_at);
  const now = Date.now();
  const locked = kickoff.getTime() <= now || match.status !== "SCHEDULED";
  const finished = match.status === "FINISHED";

  const homeCode = match.home_code || codeForTeam(match.home_team);
  const awayCode = match.away_code || codeForTeam(match.away_team);

  const [h, setH] = useState<number>(prediction?.pred_home ?? 0);
  const [a, setA] = useState<number>(prediction?.pred_away ?? 0);
  const [hasPick, setHasPick] = useState<boolean>(!!prediction);
  const [savedAt, setSavedAt] = useState<number>(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (prediction) {
      setH(prediction.pred_home);
      setA(prediction.pred_away);
      setHasPick(true);
    }
  }, [prediction]);

  function scheduleSave(nh: number, na: number) {
    if (locked) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("predictions")
        .upsert(
          {
            player_id: playerId,
            match_id: match.id,
            pred_home: nh,
            pred_away: na,
          },
          { onConflict: "player_id,match_id" },
        )
        .select()
        .single();
      if (!error && data) {
        setHasPick(true);
        setSavedAt(Date.now());
        onSaved?.(data as Prediction);
      }
    }, 350);
  }

  const showSaved = Date.now() - savedAt < 1800;

  const kickoffLabel = kickoff.toLocaleString(lang === "fa" ? "fa-IR" : undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <Link
        to="/matches/$matchId"
        params={{ matchId: match.id }}
        aria-label="View predictions"
        className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
        <span>
          {match.stage ? match.stage : ""}
          {match.group_name ? ` · ${t("group")} ${match.group_name}` : ""}
        </span>
        <span>{kickoffLabel}</span>
      </div>

      <div className="flex items-center gap-2" dir={dir}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-2xl">{flagFromCode(homeCode)}</span>
          <span className="truncate font-semibold">{tc(match.home_team)}</span>
        </div>
        {finished ? (
          <ScoreBox value={`${n(match.home_score ?? 0)} - ${n(match.away_score ?? 0)}`} />
        ) : match.status === "LIVE" ? (
          match.home_score != null && match.away_score != null ? (
            <ScoreBox value={`${n(match.home_score)} - ${n(match.away_score)}`} />
          ) : (
            <Badge tone="accent">{t("live")}</Badge>
          )
        ) : locked ? (
          prediction ? (
            <ScoreBox value={`${n(prediction.pred_home)} - ${n(prediction.pred_away)}`} />
          ) : (
            <Badge tone="accent" icon={<Lock className="h-3 w-3" />}>{t("locked")}</Badge>
          )
        ) : (
          <Stepper value={h} onChange={(v) => { setH(v); scheduleSave(v, a); }} />
        )}

      </div>

      <div className="mt-2 flex items-center gap-2" dir={dir}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-2xl">{flagFromCode(awayCode)}</span>
          <span className="truncate font-semibold">{tc(match.away_team)}</span>
        </div>
        {finished ? (
          <div className="w-[88px]" />
        ) : locked ? (
          <div className="w-[88px]" />
        ) : (
          <Stepper value={a} onChange={(v) => { setA(v); scheduleSave(h, v); }} />
        )}

      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        {!locked && !finished ? (
          <span className={hasPick ? "text-ink-soft" : "text-accent font-semibold"}>
            {hasPick ? `${t("predicted")}: ${n(h)} - ${n(a)}` : t("not_predicted")}
          </span>
        ) : prediction ? (
          <span className="flex items-center gap-1 text-ink-soft">
            {!finished && <Lock className="h-3 w-3" />}
            {t("predicted")}: {n(prediction.pred_home)} - {n(prediction.pred_away)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-ink-soft">
            {!finished && <Lock className="h-3 w-3" />}
            {t("not_predicted")}
          </span>
        )}

        {showSaved && (
          <span className="anim-pop flex items-center gap-1 font-semibold text-success">
            <Check className="h-3 w-3" /> {t("saved")}
          </span>
        )}
      </div>

    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { n } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-white p-1">
      <button
        type="button"
        aria-label="minus"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-8 w-8 place-items-center rounded-full text-ink-soft active:bg-surface"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-base font-bold tabular-nums">{n(value)}</span>
      <button
        type="button"
        aria-label="plus"
        onClick={() => onChange(Math.min(20, value + 1))}
        className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white active:opacity-90"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function ScoreBox({ value }: { value: string }) {
  return (
    <div className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white tabular-nums">{value}</div>
  );
}

function Badge({ children, tone, icon }: { children: React.ReactNode; tone: "accent" | "success" | "gold"; icon?: React.ReactNode }) {
  const cls =
    tone === "accent"
      ? "bg-accent/15 text-accent"
      : tone === "success"
        ? "bg-success/15 text-success"
        : "bg-gold/15 text-[color:var(--gold)]";
  return (
    <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {icon}
      {children}
    </span>
  );
}
