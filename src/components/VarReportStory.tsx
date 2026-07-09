import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Avatar } from "@/components/AvatarPicker";
import { VAR_STARTING_BANK, type VarReport } from "@/lib/varReport";

// Spotify-Wrapped-style full-screen stories player for the end-of-tournament
// VAR Report. Vivid gradients + white text on purpose — this is its own bold
// world, independent of the app's light/dark theme. All commentary is English
// (the jokes don't survive translation); structural chrome uses no i18n here.

const SLIDE_MS = 5600;
const money = (n: number) => `$${n.toLocaleString()}`;

type Slide = { key: string; gradient: string; confetti?: boolean; node: React.ReactNode };

export function VarReportStory({ report, onClose }: { report: VarReport; onClose: () => void }) {
  const slides = useMemo(() => buildSlides(report), [report]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const downAt = useRef(0);

  const advance = useCallback(
    () => setIndex((i) => Math.min(slides.length - 1, i + 1)),
    [slides.length],
  );

  // Auto-advance + progress bar driven by rAF so pause is trivial.
  useEffect(() => {
    setProgress(0);
    if (paused) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / SLIDE_MS);
      setProgress(p);
      if (p >= 1) {
        if (index < slides.length - 1) advance();
        return; // last slide: bar fills then holds
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, slides.length, advance]);

  // Esc to close; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [advance, onClose]);

  function onPointerDown() {
    downAt.current = Date.now();
    setPaused(true);
  }
  function onPointerUp(e: React.PointerEvent) {
    setPaused(false);
    if (Date.now() - downAt.current < 250) {
      const w = window.innerWidth;
      if (e.clientX < w * 0.32) setIndex((i) => Math.max(0, i - 1));
      else advance();
    }
  }

  const current = slides[index];

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: current.gradient, transition: "background 500ms ease" }}
    >
      <style>{VAR_CSS}</style>

      {/* Tap layer (behind chrome, in front of non-interactive content) */}
      <div
        className="absolute inset-0 z-10"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />

      {current.confetti && <Confetti />}

      {/* Slide content — remounts on index change so animations replay */}
      <div
        key={index}
        className="var-in pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        {current.node}
      </div>

      {/* Progress segments */}
      <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
        {slides.map((s, i) => (
          <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-30 mt-[calc(env(safe-area-inset-top,0px)+22px)] flex items-center gap-2 px-4 text-white">
        <Avatar avatar={report.player.avatar} name={report.player.name} size={28} className="text-base" />
        <span className="truncate text-sm font-semibold drop-shadow">{report.player.name}</span>
        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          VAR Report
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white active:bg-white/25"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

// --- Slide construction -----------------------------------------------------

function buildSlides(r: VarReport): Slide[] {
  const { board, best, quiz, bet } = r;
  const firstName = r.player.name.split(/\s+/)[0] || r.player.name;

  const slides: Slide[] = [];

  // 0 — Cover
  slides.push({
    key: "cover",
    gradient: "linear-gradient(160deg,#7C3AED 0%,#DB2777 55%,#F97316 100%)",
    node: (
      <Layout>
        <div className="text-6xl">🎬</div>
        <Kicker>The final whistle has blown</Kicker>
        <Big>Your&nbsp;2026 World&nbsp;Cup VAR&nbsp;Report</Big>
        <Line>
          Alright {firstName}, let's review the footage. No offside checks, no
          overturns — just the receipts. Tap through. →
        </Line>
      </Layout>
    ),
  });

  // 1 — Predictions volume
  slides.push({
    key: "preds",
    gradient: "linear-gradient(160deg,#4338CA 0%,#2563EB 60%,#06B6D4 100%)",
    node: (
      <Layout>
        <Kicker>You stepped up to the spot</Kicker>
        <Stat>
          <CountUp value={board.predictionsMade} />
        </Stat>
        <Sub>predictions made</Sub>
        <Line>{predsLine(board.predictionsMade)}</Line>
      </Layout>
    ),
  });

  // 2 — Accuracy
  slides.push({
    key: "accuracy",
    gradient: "linear-gradient(160deg,#0F766E 0%,#059669 55%,#84CC16 100%)",
    node: (
      <Layout>
        <Kicker>Reading the game</Kicker>
        <div className="flex items-end justify-center gap-8">
          <div className="flex flex-col items-center">
            <Stat small>
              <CountUp value={board.correctResults} />
            </Stat>
            <Sub>right results</Sub>
          </div>
          <div className="flex flex-col items-center">
            <Stat small>
              <CountUp value={board.exactScores} />
            </Stat>
            <Sub>exact scorelines</Sub>
          </div>
        </div>
        <Line>{accuracyLine(board.correctResults, board.exactScores)}</Line>
      </Layout>
    ),
  });

  // 3 — Best prediction
  slides.push({
    key: "best",
    gradient: "linear-gradient(160deg,#B91C1C 0%,#EA580C 55%,#F59E0B 100%)",
    node: (
      <Layout>
        <Kicker>Your moment of genius</Kicker>
        {best ? (
          <>
            <div className="rounded-3xl bg-white/12 px-6 py-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/80">
                {best.homeTeam} v {best.awayTeam}
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums">
                {best.predHome}–{best.predAway}
              </p>
              <p className="mt-1 text-xs text-white/70">
                {best.homeScore != null && best.awayScore != null
                  ? `actual ${best.homeScore}–${best.awayScore}`
                  : "your call"}
              </p>
            </div>
            <div className="text-2xl font-black">
              +<CountUp value={best.points} /> pts
            </div>
            <Line>{bestLine(best.points, best.isExact)}</Line>
          </>
        ) : (
          <Line>
            No prediction ever troubled the scorers. This slide is a moment of
            silence for the picks you never made. 🕯️
          </Line>
        )}
      </Layout>
    ),
  });

  // 4 — Quiz
  slides.push({
    key: "quiz",
    gradient: "linear-gradient(160deg,#A21CAF 0%,#7C3AED 55%,#4F46E5 100%)",
    node: (
      <Layout>
        <Kicker>Trivia corner</Kicker>
        {quiz.answered > 0 ? (
          <>
            <Stat>
              <CountUp value={quiz.correct} />
              <span className="text-white/60">/{quiz.answered}</span>
            </Stat>
            <Sub>quiz questions nailed</Sub>
            <Line>{quizLine(quiz.correct, quiz.answered)}</Line>
          </>
        ) : (
          <>
            <div className="text-6xl">🦗</div>
            <Line>
              You answered <b>zero</b> quiz questions. The Daily Quiz waited by
              the window every day. It's fine. It's not crying. You're crying.
            </Line>
          </>
        )}
      </Layout>
    ),
  });

  // 5 — Betting activity (total staked + decile)
  slides.push({
    key: "staked",
    gradient: "linear-gradient(160deg,#065F46 0%,#0D9488 55%,#22C55E 100%)",
    node: (
      <Layout>
        <Kicker>Action at the window</Kicker>
        {bet.staked > 0 ? (
          <>
            <Stat>
              <CountUp value={bet.staked} format={money} />
            </Stat>
            <Sub>total staked across the tournament</Sub>
            <Line>{stakedLine(bet.decile)}</Line>
          </>
        ) : (
          <>
            <div className="text-6xl">🧘</div>
            <Line>
              You staked <b>$0</b>. A monk in a casino. Ice in your veins, cash
              in your pocket. We salute the discipline — and the boredom.
            </Line>
          </>
        )}
      </Layout>
    ),
  });

  // 6 — P&L (gradient reacts to result)
  const up = bet.profit > 0;
  const flat = bet.profit === 0;
  slides.push({
    key: "pnl",
    gradient: flat
      ? "linear-gradient(160deg,#334155 0%,#475569 60%,#64748B 100%)"
      : up
        ? "linear-gradient(160deg,#065F46 0%,#16A34A 55%,#A3E635 100%)"
        : "linear-gradient(160deg,#7F1D1D 0%,#DC2626 55%,#F59E0B 100%)",
    node: (
      <Layout>
        <Kicker>The bottom line</Kicker>
        <p className="text-sm text-white/70">
          from {money(VAR_STARTING_BANK)} you finished with
        </p>
        <Stat>
          <CountUp value={bet.balance} format={money} />
        </Stat>
        <div
          className={`rounded-full px-4 py-1 text-lg font-black ${
            flat ? "bg-white/15" : up ? "bg-white/20" : "bg-black/25"
          }`}
        >
          {up ? "▲ +" : bet.profit < 0 ? "▼ −" : "±"}
          {money(Math.abs(bet.profit)).slice(1)}
        </div>
        <Line>{pnlLine(bet.profit, bet.balance)}</Line>
      </Layout>
    ),
  });

  // 7 — Finale: board placement (confetti for the champion)
  const champ = board.rank === 1 && board.total > 0;
  const podium = board.rank <= 3 && board.total > 3;
  slides.push({
    key: "finale",
    confetti: champ || podium,
    gradient: champ
      ? "linear-gradient(160deg,#B45309 0%,#F59E0B 45%,#FDE68A 100%)"
      : "linear-gradient(160deg,#312E81 0%,#6D28D9 55%,#DB2777 100%)",
    node: (
      <Layout>
        <Kicker>Where you finished</Kicker>
        <div className="text-5xl">{rankEmoji(board.rank, board.total)}</div>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl font-bold">#</span>
          <Stat>
            <CountUp value={board.rank} />
          </Stat>
          <span className="text-2xl font-semibold text-white/70">of {board.total}</span>
        </div>
        <Sub>{board.points} points on the board</Sub>
        <Line>{finaleLine(board.rank, board.total)}</Line>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="pointer-events-auto mt-2 rounded-full bg-white/90 px-5 py-2 text-sm font-bold text-neutral-900 shadow"
        >
          That's a wrap 🎞️
        </button>
      </Layout>
    ),
  });

  return slides;
}

// --- Tier commentary --------------------------------------------------------

function predsLine(n: number): string {
  if (n === 0) return "Zero. A phantom. You haunted the leaderboard without ever touching it.";
  if (n <= 8) return `Just ${n}. You dipped a toe in, felt the cold, and left. A tourist.`;
  if (n <= 24) return `${n} calls. Dependable. You showed up like it was a part-time job — and it kind of was.`;
  if (n <= 48) return `${n} predictions. A true regular. The fixtures list feared you.`;
  return `${n}?! You predicted matches that hadn't been scheduled yet. Seek help. Or a scouting contract.`;
}

function accuracyLine(correct: number, exact: number): string {
  if (correct === 0) return "Not a single right result. Bold, contrarian, wrong. But mostly wrong.";
  if (exact === 0) return `${correct} right results, but not one exact score. So close, and yet so gloriously vague.`;
  if (exact <= 2) return `${exact} exact scoreline${exact === 1 ? "" : "s"} predicted to the goal. A small, slightly blurry crystal ball.`;
  if (exact <= 5) return `${exact} exact scorelines. Are you sure you're not tampering with the results? Blink twice.`;
  return `${exact} EXACT scores. Interpol has been notified. This is not normal human behaviour.`;
}

function bestLine(points: number, isExact: boolean): string {
  if (isExact) return "Called to the goal. Framed this one and hung it in the hallway. Pure clairvoyance.";
  if (points >= 10) return "Not perfect, but chef's kiss. You saw the shape of the game before it happened.";
  if (points >= 5) return "A tidy little earner. You'll take it, and so will we.";
  return "This was your BEST one. We're being extremely generous calling it a warm-up.";
}

function quizLine(correct: number, answered: number): string {
  const pct = answered > 0 ? correct / answered : 0;
  if (pct >= 0.85) return `${correct}/${answered}. A walking Wikipedia. Utterly insufferable at the pub. Never change.`;
  if (pct >= 0.6) return `${correct}/${answered}. Solid. You know your Maradona from your Messi.`;
  if (pct >= 0.35) return `${correct}/${answered}. Look — participation is its own reward. Allegedly.`;
  return `${correct}/${answered}. The good news: it can only go up from here.`;
}

function stakedLine(decile: number | null): string {
  if (decile === null) return "No action, no exposure. The house never learned your name.";
  if (decile <= 1) return "Top 10% of degenerates. The house has reserved a parking spot with your name on it.";
  if (decile <= 3) return `Top ${decile * 10}% for volume. Big-spender energy. The odds compiler felt that.`;
  if (decile <= 6) return "A measured, mid-table gambler. Boring. Solvent. Alive. Respectable, honestly.";
  return "You bet with the enthusiasm of a man patting his coat for loose change. Cautious to a fault.";
}

function pnlLine(profit: number, balance: number): string {
  if (profit >= 200) return "Up big. Quit your job. Actually — don't, this was almost certainly luck.";
  if (profit > 0) return "Green is green. You beat the house and lived to tell the tale. Take the win and walk.";
  if (profit === 0) return "Dead even. You started at 500 and ended at 500. A majestic round trip to absolutely nowhere.";
  if (profit > -200) return "Down, but with dignity. The house always wins — you just helped it win a little faster.";
  return `From 500 down to ${balance}. Somewhere, a bookmaker just put a deposit on a boat. It's named after you.`;
}

function rankEmoji(rank: number, total: number): string {
  if (total === 0) return "❓";
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === total) return "🥄";
  return "⚽";
}

function finaleLine(rank: number, total: number): string {
  if (total === 0) return "An empty table. You're technically undefeated. And un-victorious.";
  if (rank === 1) return "CHAMPION. Top of the pile. Bow before the oracle. This slide is now your screensaver.";
  if (rank <= 3) return "Podium. So close to glory you could taste the champagne. Next year it's yours.";
  if (rank <= Math.ceil(total / 2)) return "Upper half. Quietly excellent, like a good defensive midfielder nobody talks about.";
  if (rank === total) return "Dead last. The wooden spoon is yours. Wear it proudly, or at least wash it.";
  return "Mid-table obscurity. Every great league needs its comfortable middle. That's you. Cozy.";
}

// --- Presentational bits ----------------------------------------------------

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-4 px-8 text-center text-white">
      {children}
    </div>
  );
}
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{children}</p>;
}
function Big({ children }: { children: React.ReactNode }) {
  return <h2 className="text-4xl font-black leading-tight drop-shadow-sm">{children}</h2>;
}
function Stat({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div className={`${small ? "text-5xl" : "text-7xl"} font-black tabular-nums leading-none drop-shadow`}>
      {children}
    </div>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold text-white/85">{children}</p>;
}
function Line({ children }: { children: React.ReactNode }) {
  return <p className="max-w-xs text-sm leading-relaxed text-white/90">{children}</p>;
}

function CountUp({
  value,
  duration = 1100,
  format,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? format(n) : n}</>;
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.4,
        dur: 2.4 + Math.random() * 2,
        color: ["#FDE68A", "#FF5E5B", "#00C2A8", "#7C5CFC", "#FFFFFF"][i % 5],
        rot: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="var-confetti"
          style={{
            left: `${b.left}%`,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            transform: `rotate(${b.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

const VAR_CSS = `
@keyframes var-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.var-in { animation: var-in 480ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes var-confetti-fall {
  0%   { top: -10%; opacity: 1; }
  100% { top: 110%; opacity: 0.9; }
}
.var-confetti {
  position: absolute;
  top: -10%;
  width: 9px;
  height: 15px;
  border-radius: 2px;
  animation-name: var-confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@media (prefers-reduced-motion: reduce) {
  .var-in { animation: none; }
  .var-confetti { display: none; }
}
`;
