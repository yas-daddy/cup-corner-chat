import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Check, X as XIcon, Clock, History } from "lucide-react";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { useI18n } from "@/lib/i18n";

const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const QUESTION_MS = 12000;

type Question = {
  id: string;
  order_index: number;
  category: string;
  text: string;
  choices: string[];
  explanation?: string | null;
};

type Answered = Record<string, { choice_index: number; points: number }>;

type TodayResponse = {
  ok: boolean;
  server_now: string;
  today: string;
  questions: Question[];
  answered: Answered;
};

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "WC26 — Daily Quiz" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { t } = useI18n();
  const { player, loading, setPlayer } = useCurrentPlayer();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);

  useEffect(() => {
    if (!player) return;
    let active = true;
    (async () => {
      const res = await fetch("/api/public/quiz-today", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({ player_id: player.id }),
      });
      const text = await res.text();
      let json: TodayResponse | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* leave as null */
      }
      if (!active) return;
      setData(json);
      setLoadingToday(false);
    })();
    return () => {
      active = false;
    };
  }, [player?.id]);

  if (loading) return <Screen>{t("loading")}</Screen>;
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;
  if (loadingToday) return <Screen>{t("loading")}</Screen>;
  if (!data || !data.ok) {
    return <Screen>{t("error_generic") ?? "Couldn't load today's questions."}</Screen>;
  }
  if (data.questions.length === 0) {
    return (
      <Wrapper>
        <Header />
        <EmptyState text={t("quiz_no_questions") ?? "No questions today — check back tomorrow."} />
      </Wrapper>
    );
  }

  return <QuizRunner data={data} playerId={player.id} />;
}

function QuizRunner({ data, playerId }: { data: TodayResponse; playerId: string }) {
  const { t } = useI18n();

  // Determine the first unanswered question to resume from.
  const initialIndex = useMemo(() => {
    const idx = data.questions.findIndex((q) => !data.answered[q.id]);
    return idx === -1 ? data.questions.length : idx;
  }, [data]);

  const [index, setIndex] = useState(initialIndex);
  const [answered, setAnswered] = useState<Answered>(data.answered);
  const [phase, setPhase] = useState<"running" | "summary">(
    initialIndex >= data.questions.length ? "summary" : "running",
  );

  const totalPoints = useMemo(
    () => Object.values(answered).reduce((a, x) => a + x.points, 0),
    [answered],
  );

  if (phase === "summary") {
    return (
      <Wrapper>
        <Header />
        <Summary
          questions={data.questions}
          answered={answered}
          totalPoints={totalPoints}
        />
      </Wrapper>
    );
  }

  const q = data.questions[index];
  const progressLabel = `${index + 1} / ${data.questions.length}`;

  function handleAnswered(next: { question_id: string; choice_index: number; points: number }) {
    setAnswered((prev) => ({
      ...prev,
      [next.question_id]: { choice_index: next.choice_index, points: next.points },
    }));
    if (index + 1 >= data.questions.length) {
      setPhase("summary");
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <Wrapper>
      <Header progress={progressLabel} score={totalPoints} />
      <QuestionCard
        key={q.id}
        question={q}
        playerId={playerId}
        onAnswered={handleAnswered}
        startMs={Date.parse(data.server_now)}
      />
      {t("bet_final_hint") ? null : null}
    </Wrapper>
  );
}

function QuestionCard({
  question,
  playerId,
  onAnswered,
  startMs,
}: {
  question: Question;
  playerId: string;
  onAnswered: (a: { question_id: string; choice_index: number; points: number }) => void;
  startMs: number;
}) {
  const { t } = useI18n();
  const [startedAt] = useState(() => new Date().toISOString());
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(QUESTION_MS);
  const [revealCorrect, setRevealCorrect] = useState<number | null>(null);

  // Countdown.
  useEffect(() => {
    const startWall = Date.now();
    const tick = () => {
      const left = Math.max(0, QUESTION_MS - (Date.now() - startWall));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        if (picked === null) submit(-1);
      }
    };
    const id = window.setInterval(tick, 100);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(choice: number) {
    if (busy) return;
    setBusy(true);
    setPicked(choice);
    setError(null);
    try {
      const res = await fetch("/api/public/quiz-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({
          player_id: playerId,
          question_id: question.id,
          choice_index: choice,
          started_at: startedAt,
        }),
      });
      const text = await res.text();
      let json:
        | { ok?: boolean; error?: string; correct?: boolean; points?: number; correct_index?: number }
        | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* server returned non-JSON */
      }
      if (!res.ok || !json?.ok) {
        const snippet = !json ? text.replace(/<[^>]+>/g, " ").trim().slice(0, 80) : "";
        setError(json?.error ?? `Server error ${res.status}${snippet ? ` — ${snippet}` : ""}`);
        setBusy(false);
        setPicked(null);
        return;
      }
      setRevealCorrect(json.correct_index ?? null);
      // Brief pause to let the user see what the correct answer was, then advance.
      window.setTimeout(() => {
        onAnswered({
          question_id: question.id,
          choice_index: choice,
          points: json!.points ?? 0,
        });
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setPicked(null);
    }
  }

  const secondsLeft = (remaining / 1000).toFixed(1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="rounded-full bg-primary/15 px-2 py-1 font-semibold uppercase tracking-wider text-primary">
          {question.category}
        </span>
        <span
          className={`inline-flex items-center gap-1 tabular-nums font-bold ${
            remaining < 4000 ? "text-accent" : "text-ink-soft"
          }`}
        >
          <Clock className="h-3 w-3" /> {secondsLeft}s
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full transition-all ${remaining < 4000 ? "bg-accent" : "bg-primary"}`}
          style={{ width: `${(remaining / QUESTION_MS) * 100}%` }}
        />
      </div>

      <p className="mb-4 text-base font-semibold leading-snug">{question.text}</p>

      <ul className="space-y-2">
        {question.choices.map((c, i) => {
          const isPicked = picked === i;
          const reveal = revealCorrect !== null;
          const isCorrect = reveal && revealCorrect === i;
          const isWrongPick = reveal && isPicked && revealCorrect !== i;
          const cls = isCorrect
            ? "border-success bg-success/10 text-ink"
            : isWrongPick
              ? "border-accent bg-accent/10 text-ink"
              : isPicked
                ? "border-primary bg-primary/10 text-ink"
                : "border-border bg-bg text-ink";
          return (
            <li key={i}>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(i)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition active:opacity-80 ${cls} disabled:opacity-60`}
              >
                <span>{c}</span>
                {isCorrect ? (
                  <Check className="h-4 w-4 text-success" />
                ) : isWrongPick ? (
                  <XIcon className="h-4 w-4 text-accent" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-xs font-semibold text-accent">{error}</p>}
      <p className="mt-3 text-[10px] text-ink-soft">
        {t("quiz_rules_hint") ?? "+5 correct · −1 wrong · 0 if you don't answer in 12s"}
      </p>
    </section>
  );
}

function Summary({
  questions,
  answered,
  totalPoints,
}: {
  questions: Question[];
  answered: Answered;
  totalPoints: number;
}) {
  const { t } = useI18n();
  const correct = Object.values(answered).filter((a) => a.points > 0).length;
  const wrong = Object.values(answered).filter((a) => a.choice_index !== -1 && a.points <= 0).length;
  const skipped = Object.values(answered).filter((a) => a.choice_index === -1).length;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-ink-soft">{t("quiz_today_summary") ?? "Today"}</p>
      <p className="text-4xl font-extrabold tabular-nums text-[color:var(--gold)]">
        {totalPoints >= 0 ? "+" : ""}
        {totalPoints}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {correct} {t("quiz_correct") ?? "correct"} · {wrong} {t("quiz_wrong") ?? "wrong"} · {skipped}{" "}
        {t("quiz_no_answer") ?? "no answer"}
      </p>

      <ul className="mt-4 space-y-2">
        {questions.map((q) => {
          const a = answered[q.id];
          if (!a) return null;
          const status =
            a.choice_index === -1
              ? "skipped"
              : a.points > 0
                ? "correct"
                : "wrong";
          const cls =
            status === "correct"
              ? "border-success/40 bg-success/5"
              : status === "wrong"
                ? "border-accent/40 bg-accent/5"
                : "border-border bg-surface";
          return (
            <li key={q.id} className={`rounded-xl border px-3 py-2 text-xs ${cls}`}>
              <p className="line-clamp-2 font-semibold text-ink">{q.text}</p>
              {q.explanation && (
                <p className="mt-1 text-ink-soft">{q.explanation}</p>
              )}
            </li>
          );
        })}
      </ul>

      <Link
        to="/"
        className="mt-4 block rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-white"
      >
        {t("quiz_back_to_picks") ?? "Back to Picks"}
      </Link>
    </section>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-6 pb-24">{children}</div>;
}

function Header({ progress, score }: { progress?: string; score?: number }) {
  const { t } = useI18n();
  return (
    <header className="mb-4 flex items-center gap-3">
      <Link
        to="/"
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-soft"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-ink-soft">
          {t("quiz_title") ?? "Daily Quiz"}
        </p>
        <h1 className="truncate text-lg font-extrabold">
          {progress ?? t("quiz_today_summary") ?? "Today"}
        </h1>
      </div>
      {typeof score === "number" && (
        <span className="rounded-full bg-bg px-3 py-1 text-sm font-bold tabular-nums ring-1 ring-border">
          {score >= 0 ? "+" : ""}
          {score}
        </span>
      )}
      <Link
        to="/quiz-history"
        aria-label={t("quiz_history_title") ?? "History"}
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-soft active:opacity-80"
      >
        <History className="h-4 w-4" />
      </Link>
    </header>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
      {text}
    </div>
  );
}
