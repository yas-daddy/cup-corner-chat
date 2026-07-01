import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Check, X as XIcon, Minus } from "lucide-react";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { useI18n } from "@/lib/i18n";

const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

type HistoryQuestion = {
  id: string;
  order_index: number;
  category: string;
  text: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  choice_index: number;
  points: number;
};

type HistoryDay = {
  date: string;
  total: number;
  correct: number;
  wrong: number;
  no_answer: number;
  questions: HistoryQuestion[];
};

type HistoryResponse = { ok: boolean; days: HistoryDay[]; error?: string };

export const Route = createFileRoute("/quiz-history")({
  head: () => ({
    meta: [
      { title: "WC26 — Quiz history" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuizHistoryPage,
});

function QuizHistoryPage() {
  const { t } = useI18n();
  const { player, loading, setPlayer } = useCurrentPlayer();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!player) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/quiz-history", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
          body: JSON.stringify({ player_id: player.id }),
        });
        const text = await res.text();
        let json: HistoryResponse | null = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* keep null */
        }
        if (!active) return;
        setData(json);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [player?.id]);

  if (loading) return <Screen>{t("loading")}</Screen>;
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;

  const grandTotal = (data?.days ?? []).reduce((a, d) => a + d.total, 0);

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/quiz"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {t("quiz_title") ?? "Daily Quiz"}
          </p>
          <h1 className="truncate text-lg font-extrabold">
            {t("quiz_history_title") ?? "History"}
          </h1>
        </div>
        {(data?.days?.length ?? 0) > 0 && (
          <span className="rounded-full bg-bg px-3 py-1 text-sm font-bold tabular-nums ring-1 ring-border">
            {grandTotal >= 0 ? "+" : ""}
            {grandTotal}
          </span>
        )}
      </header>

      {loadingHistory ? (
        <div className="grid min-h-[40vh] place-items-center text-ink-soft">{t("loading")}</div>
      ) : !data?.ok ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("error_generic") ?? "Couldn't load history."}
        </div>
      ) : (data.days?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("quiz_history_empty") ?? "You haven't answered any quiz questions yet."}
        </div>
      ) : (
        <ul className="space-y-5">
          {data.days.map((d) => (
            <DayCard key={d.date} day={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DayCard({ day }: { day: HistoryDay }) {
  const { t } = useI18n();
  const dateLabel = new Date(day.date + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <li>
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft">{dateLabel}</p>
          <p className="text-[11px] text-ink-soft">
            {day.correct} {t("quiz_correct") ?? "correct"} · {day.wrong}{" "}
            {t("quiz_wrong") ?? "wrong"} · {day.no_answer} {t("quiz_no_answer") ?? "no answer"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
            day.total > 0
              ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
              : day.total < 0
                ? "bg-accent/15 text-accent"
                : "bg-bg text-ink-soft ring-1 ring-border"
          }`}
        >
          {day.total >= 0 ? "+" : ""}
          {day.total}
        </span>
      </div>
      <ul className="space-y-2">
        {day.questions.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
      </ul>
    </li>
  );
}

function QuestionRow({ q }: { q: HistoryQuestion }) {
  const noAnswer = q.choice_index === -1;
  const correct = !noAnswer && q.points > 0;
  const wrong = !noAnswer && q.points <= 0;
  const cardCls = correct
    ? "border-success/40 bg-success/5"
    : wrong
      ? "border-accent/40 bg-accent/5"
      : "border-border bg-surface";
  return (
    <li className={`rounded-2xl border p-3 text-sm ${cardCls}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-ink-soft">
        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
          {q.category}
        </span>
        <ResultBadge points={q.points} noAnswer={noAnswer} correct={correct} />
      </div>
      <p className="font-semibold text-ink">{q.text}</p>
      <ul className="mt-2 space-y-1">
        {q.choices.map((c, i) => {
          const isCorrect = i === q.correct_index;
          const isPick = i === q.choice_index;
          const rowCls = isCorrect
            ? "border-success/50 bg-success/10 text-ink"
            : isPick
              ? "border-accent/50 bg-accent/10 text-ink"
              : "border-border bg-bg text-ink-soft";
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${rowCls}`}
            >
              <span className="truncate">{c}</span>
              {isCorrect ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : isPick ? (
                <XIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
              ) : null}
            </li>
          );
        })}
      </ul>
      {q.explanation && (
        <p className="mt-2 text-[11px] text-ink-soft">{q.explanation}</p>
      )}
    </li>
  );
}

function ResultBadge({
  points,
  noAnswer,
  correct,
}: {
  points: number;
  noAnswer: boolean;
  correct: boolean;
}) {
  if (noAnswer) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[10px] font-bold text-ink-soft ring-1 ring-border">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  if (correct) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
        <Check className="h-3 w-3" /> +{points}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
      <XIcon className="h-3 w-3" /> {points}
    </span>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{children}</div>;
}
