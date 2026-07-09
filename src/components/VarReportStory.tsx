import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Download, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/AvatarPicker";
import { flagFromCode, flagEmoji } from "@/lib/flags";
import { VAR_STARTING_BANK, type VarReport, type VarGenius } from "@/lib/varReport";

// Spotify-Wrapped-style full-screen stories player for the end-of-tournament
// VAR Report. Vivid gradients + white text, its own bold world independent of
// the app theme. One decorative emoji per slide (flags/medals are data, not
// decoration). Layouts and number treatments vary slide to slide.

const SLIDE_MS = 7000;
const money = (n: number) => `$${n.toLocaleString()}`;

type Slide = { key: string; gradient: string; confetti?: boolean; ms?: number; node: React.ReactNode };

export function VarReportStory({ report, onClose }: { report: VarReport; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const downAt = useRef(0);

  const advance = useCallback(() => setIndex((i) => i + 1), []);
  const restart = useCallback(() => setIndex(0), []);

  const slides = useMemo(
    () => buildSlides(report, { onNext: advance, onClose, onReplay: restart }),
    [report, advance, onClose, restart],
  );
  const clampedIndex = Math.min(index, slides.length - 1);
  const current = slides[clampedIndex];

  useEffect(() => {
    setProgress(0);
    if (paused) return;
    const dur = current.ms ?? SLIDE_MS;
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setProgress(p);
      if (p >= 1) {
        if (clampedIndex < slides.length - 1) advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clampedIndex, paused, slides.length, advance, current.ms]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(slides.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, slides.length]);

  function onPointerDown() {
    downAt.current = Date.now();
    setPaused(true);
  }
  function onPointerUp(e: React.PointerEvent) {
    setPaused(false);
    if (Date.now() - downAt.current < 250) {
      const w = window.innerWidth;
      if (e.clientX < w * 0.32) setIndex((i) => Math.max(0, i - 1));
      else setIndex((i) => Math.min(slides.length - 1, i + 1));
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: current.gradient, transition: "background 500ms ease" }}
    >
      <style>{VAR_CSS}</style>
      <div className="absolute inset-0 z-10" onPointerDown={onPointerDown} onPointerUp={onPointerUp} />
      {current.confetti && <Confetti />}

      <div key={clampedIndex} className="var-in pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        {current.node}
      </div>

      <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
        {slides.map((s, i) => (
          <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: i < clampedIndex ? "100%" : i === clampedIndex ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 z-30 mt-[calc(env(safe-area-inset-top,0px)+22px)] flex items-center gap-2 px-4 text-white">
        <Avatar avatar={report.player.avatar} name={report.player.name} size={28} className="text-base" />
        <span className="truncate text-sm font-semibold drop-shadow">{report.player.name}</span>
        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">VAR Report</span>
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

// --- Slides -----------------------------------------------------------------

function buildSlides(
  r: VarReport,
  actions: { onNext: () => void; onClose: () => void; onReplay: () => void },
): Slide[] {
  const { board, quiz, bet, genius, soulmate, topTeam, field, predNeighbors } = r;
  const firstName = r.player.name.split(/\s+/)[0] || r.player.name;
  const slides: Slide[] = [];

  // 0 — Cover (centered)
  slides.push({
    key: "cover",
    gradient: "linear-gradient(160deg,#7C3AED 0%,#DB2777 55%,#F97316 100%)",
    node: (
      <Center>
        <div className="text-7xl">🎬</div>
        <Kicker>The final whistle has blown</Kicker>
        <Big>
          Your 2026 <br /> World&nbsp;Cup, <br /> wrapped
        </Big>
        <Line>Roll the tape, {firstName}. No overturns — just receipts.</Line>
      </Center>
    ),
  });

  // 1 — Predictions volume (bottom-left, outlined number + you-vs-field bars)
  slides.push({
    key: "preds",
    gradient: "linear-gradient(160deg,#4338CA 0%,#2563EB 60%,#06B6D4 100%)",
    node: (
      <MidLeft>
        <Kicker>You stepped up ✍️</Kicker>
        <NumOutline className="text-[7rem] leading-[0.85]">
          <CountUp value={board.predictionsMade} />
        </NumOutline>
        <Sub>predictions made</Sub>
        <div className="mt-3 w-full">
          <SocialLadder
            you={board.predictionsMade}
            youAvatar={r.player.avatar}
            above={predNeighbors.above ? { name: predNeighbors.above.name, avatar: predNeighbors.above.avatar, val: predNeighbors.above.predictions } : null}
            below={predNeighbors.below ? { name: predNeighbors.below.name, avatar: predNeighbors.below.avatar, val: predNeighbors.below.predictions } : null}
            avg={field.avgPredictions}
          />
        </div>
        <Line>{predsLine(board.predictionsMade)}</Line>
      </MidLeft>
    ),
  });

  // 2 — Accuracy (centered, two numbers + hit-rate bar)
  const hitRate = board.predictionsMade ? Math.round((board.correctResults / board.predictionsMade) * 100) : 0;
  slides.push({
    key: "accuracy",
    gradient: "linear-gradient(160deg,#0F766E 0%,#059669 55%,#84CC16 100%)",
    node: (
      <Center>
        <Kicker>Reading the game 🎯</Kicker>
        <div className="flex items-end justify-center gap-8">
          <div className="flex flex-col items-center">
            <NumGradient from="#FFFFFF" to="#BBF7D0" className="text-6xl">
              <CountUp value={board.correctResults} />
            </NumGradient>
            <Sub>right calls</Sub>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-[#FDE68A] px-4 py-1 text-5xl font-black tabular-nums text-emerald-900 shadow-lg">
              <CountUp value={board.exactScores} />
            </div>
            <Sub>exact</Sub>
          </div>
        </div>
        <div className="mt-2 w-full max-w-xs">
          <BarWithLabel pct={hitRate} label="Hit rate" valueText={`${hitRate}%`} fill="#FDE68A" />
        </div>
        <Line>{accuracyLine(board.correctResults, board.exactScores)}</Line>
      </Center>
    ),
  });

  // 3 — Moment of genius (centered card with flags)
  slides.push({
    key: "genius",
    gradient: "linear-gradient(160deg,#B91C1C 0%,#EA580C 55%,#F59E0B 100%)",
    node: <GeniusSlide genius={genius} />,
  });

  // 4 — Team that gave you the most points (flag hero)
  slides.push({
    key: "topteam",
    gradient: "linear-gradient(160deg,#0C4A6E 0%,#0369A1 55%,#38BDF8 100%)",
    node: (
      <Center>
        <Kicker>Your lucky charm ⭐</Kicker>
        {topTeam ? (
          <>
            <div className="text-[7rem] leading-none drop-shadow-lg">{flagFromCode(topTeam.code)}</div>
            <h2 className="text-3xl font-black">{topTeam.name}</h2>
            <div className="rounded-full bg-white/90 px-5 py-1.5 text-2xl font-black text-sky-800">
              <CountUp value={topTeam.points} /> pts
            </div>
            <Line>The team that paid your bills. You rode them all tournament.</Line>
          </>
        ) : (
          <Line>No team ever paid out. A tournament of heartbreak.</Line>
        )}
      </Center>
    ),
  });

  // 5 — Prediction soulmate (centered, avatar + agreement ring)
  slides.push({
    key: "soulmate",
    gradient: "linear-gradient(160deg,#9D174D 0%,#BE185D 50%,#F472B6 100%)",
    node: (
      <Center>
        <Kicker>Your prediction soulmate 🤝</Kicker>
        {soulmate ? (
          <>
            <Ring pct={Math.round((soulmate.agree / Math.max(1, soulmate.shared)) * 100)}>
              <Avatar avatar={soulmate.avatar} name={soulmate.name} size={56} className="text-2xl" />
            </Ring>
            <h2 className="text-3xl font-black">{soulmate.name}</h2>
            <Sub>
              agreed on <CountUp value={soulmate.agree} /> of {soulmate.shared} shared picks
            </Sub>
            <Line>{soulmateLine(soulmate.agree, soulmate.shared)}</Line>
          </>
        ) : (
          <Line>A lone wolf. Nobody predicted quite like you did.</Line>
        )}
      </Center>
    ),
  });

  // 6 — Quiz (number-first, accuracy bar)
  slides.push({
    key: "quiz",
    gradient: "linear-gradient(160deg,#A21CAF 0%,#7C3AED 55%,#4F46E5 100%)",
    node: (
      <TopStack>
        <Kicker>Trivia time 🧠</Kicker>
        {quiz.answered > 0 ? (
          <>
            <div className="flex items-baseline gap-2">
              <NumGradient from="#FFFFFF" to="#E9D5FF" className="text-8xl">
                <CountUp value={quiz.correct} />
              </NumGradient>
              <span className="text-4xl font-bold text-white/50">/{quiz.answered}</span>
            </div>
            <Sub>quiz answers nailed</Sub>
            <div className="mt-2 w-full max-w-xs">
              <SocialLadder
                you={quiz.accuracy}
                youAvatar={r.player.avatar}
                above={quiz.neighbors.above ? { name: quiz.neighbors.above.name, avatar: quiz.neighbors.above.avatar, val: quiz.neighbors.above.accuracy } : null}
                below={quiz.neighbors.below ? { name: quiz.neighbors.below.name, avatar: quiz.neighbors.below.avatar, val: quiz.neighbors.below.accuracy } : null}
                avg={quiz.fieldAccuracy}
                max={100}
                fmt={(n) => `${n}%`}
              />
            </div>
            <Line>{quizLine(quiz.correct, quiz.answered)}</Line>
          </>
        ) : (
          <>
            <div className="text-7xl">🦗</div>
            <Sub>zero questions answered</Sub>
            <Line>The Daily Quiz waited by the window every single day.</Line>
          </>
        )}
      </TopStack>
    ),
  });

  // 7 — Betting activity (bottom-left, money + decile equalizer)
  slides.push({
    key: "staked",
    gradient: "linear-gradient(160deg,#065F46 0%,#0D9488 55%,#22C55E 100%)",
    node: (
      <MidLeft>
        <Kicker>At the window 🎰</Kicker>
        {bet.staked > 0 ? (
          <>
            <NumGradient from="#FFFFFF" to="#FDE68A" className="text-[6rem] leading-[0.85]">
              <CountUp value={bet.staked} format={money} />
            </NumGradient>
            <Sub>staked all tournament</Sub>
            {bet.decile != null && (
              <div className="mt-3 flex items-end gap-4">
                <Equalizer decile={bet.decile} />
                <span className="pb-1 text-sm font-black">TOP {bet.decile * 10}%</span>
              </div>
            )}
            <Line>{stakedLine(bet.decile)}</Line>
          </>
        ) : (
          <>
            <div className="text-6xl">🧘</div>
            <Sub>$0 staked</Sub>
            <Line>A monk in a casino. Ice in the veins, cash in the pocket.</Line>
          </>
        )}
      </MidLeft>
    ),
  });

  // 8 — P&L (centered, balance + up/down pill)
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
      <Center>
        <Kicker>The bottom line 💰</Kicker>
        <p className="text-sm text-white/70">from {money(VAR_STARTING_BANK)} you ended on</p>
        <NumGradient from="#FFFFFF" to={up ? "#DCFCE7" : flat ? "#E2E8F0" : "#FED7AA"} className="text-[6.5rem]">
          <CountUp value={bet.balance} format={money} />
        </NumGradient>
        <div
          className={`flex items-center gap-1 rounded-full px-5 py-1.5 text-xl font-black shadow ${
            flat ? "bg-white/15 text-white" : up ? "bg-white text-green-700" : "bg-black/30 text-white"
          }`}
        >
          <span className="text-2xl leading-none">{up ? "▲" : bet.profit < 0 ? "▼" : "="}</span>
          {money(Math.abs(bet.profit)).slice(1)}
        </div>
        <Line>{pnlLine(bet.profit, bet.balance)}</Line>
      </Center>
    ),
  });

  // 9 — Finale (rank + leaderboard slide-up)
  const champ = board.rank === 1 && board.total > 0;
  const podium = board.rank <= 3 && board.total > 3;
  slides.push({
    key: "finale",
    confetti: champ || podium,
    ms: 11000,
    gradient: champ
      ? "linear-gradient(160deg,#B45309 0%,#F59E0B 45%,#FDE68A 100%)"
      : "linear-gradient(160deg,#312E81 0%,#6D28D9 55%,#DB2777 100%)",
    node: <FinaleSlide report={r} onNext={actions.onNext} />,
  });

  // 10 — Summary bento + share
  slides.push({
    key: "summary",
    gradient: "linear-gradient(160deg,#1E1B4B 0%,#4C1D95 55%,#831843 100%)",
    node: <SummarySlide report={r} onClose={actions.onClose} onReplay={actions.onReplay} />,
  });

  return slides;
}

function GeniusSlide({ genius }: { genius: VarGenius | null }) {
  if (!genius) {
    return (
      <Center>
        <Kicker>Your moment of genius 🔮</Kicker>
        <Line>No pick ever troubled the scorers. A moment of silence.</Line>
      </Center>
    );
  }
  const badge =
    genius.kind === "contrarian"
      ? genius.othersAgreed === 0
        ? "NOBODY ELSE CALLED IT"
        : `ONLY ${genius.othersAgreed} OTHER${genius.othersAgreed === 1 ? "" : "S"} CALLED IT`
      : genius.kind === "highscore"
        ? `${genius.totalGoals}-GOAL THRILLER`
        : "SHARPEST READ";
  return (
    <Center>
      <Kicker>Your moment of genius 🔮</Kicker>
      <div className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-black uppercase tracking-wider">{badge}</div>
      <div className="w-full max-w-xs rounded-3xl bg-white/12 px-5 py-5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <TeamCol flag={genius.homeCode} name={genius.homeTeam} />
          <div className="text-center">
            <div className="text-4xl font-black tabular-nums leading-none">
              {genius.predHome}–{genius.predAway}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-white/60">your call</div>
          </div>
          <TeamCol flag={genius.awayCode} name={genius.awayTeam} />
        </div>
        {genius.homeScore != null && genius.awayScore != null && (
          <div className="mt-3 border-t border-white/15 pt-2 text-xs text-white/70">
            actual {genius.homeScore}–{genius.awayScore}
            {genius.isExact ? " · to the goal" : ""}
          </div>
        )}
      </div>
      <div className="rounded-full bg-white/90 px-5 py-1.5 text-xl font-black text-orange-700">+{genius.points} pts</div>
      <Line>{geniusLine(genius)}</Line>
    </Center>
  );
}

function TeamCol({ flag, name }: { flag: string | null; name: string }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span className="text-3xl leading-none">{flagFromCode(flag)}</span>
      <span className="truncate text-[11px] font-semibold text-white/85">{name}</span>
    </div>
  );
}

function FinaleSlide({ report, onNext }: { report: VarReport; onNext: () => void }) {
  const { board } = report;
  const standings = report.standings ?? [];
  const [showBoard, setShowBoard] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowBoard(true), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-start gap-3 px-8 pt-28 text-center text-white">
      <Kicker>Where you finished 🏁</Kicker>
      <div className="text-6xl">{rankEmoji(board.rank, board.total)}</div>
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-3xl font-bold text-white/70">#</span>
        <NumGradient from="#FFFFFF" to="#FDE68A" className="text-[6.5rem]">
          <CountUp value={board.rank} />
        </NumGradient>
        <span className="text-2xl font-semibold text-white/70">of {board.total}</span>
      </div>
      <div className="rounded-full bg-white/15 px-4 py-1 text-sm font-bold">{board.points} pts on the board</div>
      <Line>{finaleLine(board.rank, board.total)}</Line>

      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-black/35 backdrop-blur-md transition-transform duration-500 ease-out"
        style={{ transform: showBoard ? "translateY(0)" : "translateY(100%)", height: "56%" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/40" />
        <p className="px-5 pt-2 pb-1 text-xs font-bold uppercase tracking-widest text-white/70">Final table</p>
        <div className="max-h-[calc(100%-88px)] overflow-y-auto px-3 pb-3">
          {standings.map((s) => {
            const mine = s.playerId === report.player.id;
            return (
              <div
                key={s.playerId}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 ${mine ? "bg-white/90 text-neutral-900" : "bg-white/5 text-white"}`}
              >
                <span className={`w-6 text-center text-sm font-black tabular-nums ${mine ? "" : "text-white/60"}`}>{medal(s.rank)}</span>
                <Avatar avatar={s.avatar} name={s.name} size={26} className="text-sm" />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{s.name}</span>
                <span className="text-sm font-black tabular-nums">{s.points}</span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onNext}
          className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/30 py-3 text-sm font-bold text-white active:bg-black/40"
        >
          See your summary →
        </button>
      </div>
    </div>
  );
}

function SummarySlide({ report, onClose, onReplay }: { report: VarReport; onClose: () => void; onReplay: () => void }) {
  const [sharing, setSharing] = useState(false);
  const tiles = summaryTiles(report);
  const hero = tiles[0];
  const rest = tiles.slice(1);

  async function onShare() {
    setSharing(true);
    try {
      await shareVarReport(report);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="pointer-events-auto flex h-full w-full max-w-md flex-col justify-center gap-3 px-5 pt-24 pb-6 text-white">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">🎁 Your tournament, wrapped</p>
        <h2 className="mt-1 text-2xl font-black">{report.player.name}'s VAR Report</h2>
      </div>
      <BentoTile tile={hero} big />
      <div className="grid grid-cols-2 gap-2.5">
        {rest.map((t) => (
          <BentoTile key={t.label} tile={t} />
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-black text-neutral-900 active:opacity-90 disabled:opacity-60"
        >
          {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {sharing ? "Preparing…" : "Share my Wrapped"}
        </button>
        <button
          type="button"
          onClick={onReplay}
          aria-label="Replay"
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-white/15 text-white active:bg-white/25"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onClose} className="text-center text-xs font-medium text-white/60 active:text-white/80">
        Close
      </button>
    </div>
  );
}

function BentoTile({ tile, big }: { tile: Tile; big?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${big ? "flex items-center gap-4" : ""}`} style={{ background: tile.bg, borderColor: tile.ring }}>
      <div className={big ? "text-4xl" : "text-2xl"}>{tile.emoji}</div>
      <div className={big ? "flex-1" : ""}>
        <div className={`font-black tabular-nums leading-tight ${big ? "text-3xl" : "text-xl"}`}>{tile.value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{tile.label}</div>
      </div>
    </div>
  );
}

type Tile = { emoji: string; label: string; value: string; bg: string; ring: string; hex: string };
const HEX = {
  gold: "#F59E0B",
  violet: "#8B5CF6",
  blue: "#3B82F6",
  green: "#22C55E",
  fuchsia: "#D946EF",
  teal: "#14B8A6",
  red: "#EF4444",
  sky: "#38BDF8",
};
function tint(hex: string) {
  return { bg: `${hex}2E`, ring: `${hex}80`, hex };
}
function summaryTiles(r: VarReport): Tile[] {
  const { board, quiz, bet, topTeam } = r;
  const up = bet.profit >= 0;
  return [
    { emoji: rankEmoji(board.rank, board.total), label: "Where you finished", value: `#${board.rank} of ${board.total}`, ...tint(HEX.gold) },
    { emoji: "🎯", label: "Points", value: `${board.points}`, ...tint(HEX.violet) },
    { emoji: "✍️", label: "Predictions", value: `${board.predictionsMade}`, ...tint(HEX.blue) },
    { emoji: "💯", label: "Exact scores", value: `${board.exactScores}`, ...tint(HEX.green) },
    { emoji: "🧠", label: "Quiz", value: quiz.answered > 0 ? `${quiz.correct}/${quiz.answered}` : "—", ...tint(HEX.fuchsia) },
    { emoji: "💸", label: "Staked", value: money(bet.staked), ...tint(HEX.teal) },
    { emoji: up ? "📈" : "📉", label: "Profit", value: `${up ? "+" : "−"}${money(Math.abs(bet.profit)).slice(1)}`, ...tint(up ? HEX.green : HEX.red) },
    topTeam
      ? { emoji: flagEmoji(topTeam.code), label: "Lucky charm", value: `${topTeam.points} pts`, ...tint(HEX.sky) }
      : { emoji: "⚽", label: "Lucky charm", value: "—", ...tint(HEX.sky) },
  ];
}

// --- Share card (canvas) ----------------------------------------------------

async function shareVarReport(r: VarReport) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background gradient + soft top glow.
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#1E1B4B");
  bg.addColorStop(0.55, "#4C1D95");
  bg.addColorStop(1, "#831843");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 720);
  glow.addColorStop(0, "rgba(255,255,255,0.16)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);

  const MARGIN = 72;
  ctx.textAlign = "center";

  // Header
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("W O R L D   C U P   2 0 2 6", W / 2, 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 88px system-ui, -apple-system, sans-serif";
  ctx.fillText("VAR REPORT", W / 2, 250);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText(r.player.name, W / 2, 320);

  // Hero rank card
  let y = 380;
  const heroH = 210;
  roundRect(ctx, MARGIN, y, W - MARGIN * 2, heroH, 40);
  ctx.fillStyle = "rgba(245,158,11,0.20)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(245,158,11,0.6)";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "96px system-ui, sans-serif";
  ctx.fillText(rankEmoji(r.board.rank, r.board.total), MARGIN + 44, y + heroH / 2 + 34);
  ctx.fillStyle = "#ffffff";
  const rankText = `#${r.board.rank}`;
  ctx.font = "900 104px system-ui, sans-serif";
  ctx.fillText(rankText, MARGIN + 200, y + heroH / 2 + 2);
  const rankW = ctx.measureText(rankText).width; // measured at the 104px font
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText(`of ${r.board.total}`, MARGIN + 200 + rankW + 22, y + heroH / 2 - 6);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText(`${r.board.points} POINTS  ·  WHERE YOU FINISHED`, MARGIN + 200, y + heroH / 2 + 56);

  // Stat grid (2 cols)
  y += heroH + 32;
  const tiles = summaryTiles(r).slice(1, 7); // points, preds, exact, quiz, staked, profit
  const gap = 28;
  const colW = (W - MARGIN * 2 - gap) / 2;
  const tileH = 190;
  tiles.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (colW + gap);
    const ty = y + row * (tileH + gap);
    roundRect(ctx, x, ty, colW, tileH, 32);
    ctx.fillStyle = t.hex + "26";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.hex + "66";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "52px system-ui, sans-serif";
    ctx.fillText(t.emoji, x + 34, ty + 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 60px system-ui, sans-serif";
    ctx.fillText(t.value, x + 34, ty + 142);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText(t.label.toUpperCase(), x + 34, ty + 176 - 4);
  });

  // Highlight strip: lucky charm + best pick
  y += 3 * (tileH + gap) + 6;
  const stripH = 150;
  roundRect(ctx, MARGIN, y, W - MARGIN * 2, stripH, 32);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.textAlign = "left";
  if (r.topTeam) {
    ctx.font = "60px system-ui, sans-serif";
    ctx.fillText(flagEmoji(r.topTeam.code), MARGIN + 34, y + stripH / 2 + 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.fillText(r.topTeam.name, MARGIN + 120, y + stripH / 2 - 6);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText(`LUCKY CHARM · ${r.topTeam.points} PTS`, MARGIN + 120, y + stripH / 2 + 34);
  }
  if (r.best) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#FDE68A";
    ctx.font = "900 52px system-ui, sans-serif";
    ctx.fillText(`+${r.best.points}`, W - MARGIN - 34, y + stripH / 2 - 4);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText("BEST PICK", W - MARGIN - 34, y + stripH / 2 + 34);
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("⚽  Cup Corner · World Cup 2026", W / 2, H - 80);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "wc26-var-report.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "My World Cup VAR Report" } as ShareData);
      return;
    } catch {
      /* cancelled — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  const rr = (ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect;
  if (typeof rr === "function") {
    rr.call(ctx, x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Tier commentary (punchy, emoji-free — one emoji lives in the kicker) ----

function predsLine(n: number): string {
  if (n === 0) return "A ghost in the machine.";
  if (n <= 8) return "You browsed, you left. A tourist.";
  if (n <= 24) return "Reliable as a Sunday alarm.";
  if (n <= 48) return "The fixtures feared you.";
  return "Predicting games that don't exist yet.";
}
function accuracyLine(correct: number, exact: number): string {
  if (correct === 0) return "Boldly, consistently wrong.";
  if (exact === 0) return "Right results, never the exact score.";
  if (exact <= 2) return "Tidy work.";
  if (exact <= 5) return "Suspicious. Blink twice.";
  return "Someone call Interpol.";
}
function geniusLine(g: VarGenius): string {
  if (g.kind === "contrarian")
    return g.othersAgreed === 0 ? "Alone against the room — and you were right." : "You backed it when almost nobody would.";
  if (g.kind === "highscore") return "A goal-fest, called on the nose. The hardest kind.";
  return "Your sharpest read of the whole tournament.";
}
function soulmateLine(agree: number, shared: number): string {
  const pct = shared ? agree / shared : 0;
  if (pct >= 0.8) return "Separated at birth. Suspiciously in sync.";
  if (pct >= 0.55) return "Kindred spirits at the coupon.";
  return "You mostly saw the games the same way.";
}
function quizLine(correct: number, answered: number): string {
  const pct = answered ? correct / answered : 0;
  if (pct >= 0.85) return "Insufferable at the pub quiz.";
  if (pct >= 0.6) return "You know your football.";
  if (pct >= 0.35) return "Participation counts. Allegedly.";
  return "The only way is up.";
}
function stakedLine(decile: number | null): string {
  if (decile === null) return "The house never learned your name.";
  if (decile <= 1) return "Top-tier degenerate. The house loves you.";
  if (decile <= 3) return "Big-spender energy.";
  if (decile <= 6) return "Measured. Boring. Solvent.";
  return "You bet in loose change.";
}
function pnlLine(profit: number, balance: number): string {
  if (profit >= 200) return "Up big. Quit your— actually, don't.";
  if (profit > 0) return "You beat the house and walked.";
  if (profit === 0) return "Dead even. A round trip to nowhere.";
  if (profit > -200) return "Down, but dignified.";
  return `Down to ${money(balance)}. The bookie bought a boat.`;
}
function rankEmoji(rank: number, total: number): string {
  if (total === 0) return "❓";
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank === total) return "🥄";
  return "⚽";
}
function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}
function finaleLine(rank: number, total: number): string {
  if (total === 0) return "Undefeated and un-victorious.";
  if (rank === 1) return "CHAMPION. Bow before the oracle.";
  if (rank <= 3) return "Podium. So close to glory.";
  if (rank <= Math.ceil(total / 2)) return "Upper half. Quietly excellent.";
  if (rank === total) return "Dead last. The spoon is yours.";
  return "Mid-table comfort.";
}

// --- Layouts + primitives ---------------------------------------------------

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-4 px-8 text-center text-white">{children}</div>;
}
function MidLeft({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full max-w-md flex-col items-start justify-center gap-3 px-8 text-left text-white">{children}</div>;
}
function TopStack({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full max-w-md flex-col items-center justify-start gap-3 px-8 pt-44 text-center text-white">{children}</div>;
}
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{children}</p>;
}
function Big({ children }: { children: React.ReactNode }) {
  return <h2 className="text-4xl font-black leading-tight drop-shadow-sm">{children}</h2>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold text-white/85">{children}</p>;
}
function Line({ children }: { children: React.ReactNode }) {
  return <p className="max-w-xs text-sm leading-relaxed text-white/90">{children}</p>;
}
function NumGradient({ children, from, to, className }: { children: React.ReactNode; from: string; to: string; className?: string }) {
  return (
    <div
      className={`font-black tabular-nums leading-none drop-shadow ${className ?? ""}`}
      style={{ backgroundImage: `linear-gradient(180deg, ${from}, ${to})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
    >
      {children}
    </div>
  );
}
function NumOutline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-black tabular-nums leading-none ${className ?? ""}`} style={{ WebkitTextStroke: "2.5px rgba(255,255,255,0.92)", color: "transparent" }}>
      {children}
    </div>
  );
}

// --- Visualisations ---------------------------------------------------------

function useGrow(target: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setV(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function BarWithLabel({ pct, label, valueText, fill }: { pct: number; label: string; valueText: string; fill: string }) {
  const w = useGrow(Math.max(0, Math.min(100, pct)));
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-white/70">
        <span>{label}</span>
        <span>{valueText}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: fill, transition: "width 1s cubic-bezier(.22,1,.36,1)" }} />
      </div>
    </div>
  );
}

// A little social ladder: the player just above you, you, the player just
// below, and the league average — as scaled bars. Used for prediction volume
// and quiz accuracy (fmt="%").
type LadderVal = { name: string; avatar: string | null; val: number };
type LadderEntry = LadderVal & { key: string; me?: boolean; muted?: boolean };
function SocialLadder({
  you,
  youAvatar,
  above,
  below,
  avg,
  max,
  fmt,
}: {
  you: number;
  youAvatar: string | null;
  above: LadderVal | null;
  below: LadderVal | null;
  avg: number;
  max?: number;
  fmt?: (n: number) => string;
}) {
  const rows: LadderEntry[] = [];
  if (above) rows.push({ key: "above", name: above.name, avatar: above.avatar, val: above.val });
  rows.push({ key: "you", name: "You", avatar: youAvatar, val: you, me: true });
  if (below) rows.push({ key: "below", name: below.name, avatar: below.avatar, val: below.val });
  rows.push({ key: "avg", name: "League avg", avatar: null, val: avg, muted: true });
  const m = max ?? Math.max(...rows.map((r) => r.val), 1);
  return (
    <div className="w-full space-y-1.5">
      {rows.map((row) => (
        <LadderRow key={row.key} row={row} max={m} fmt={fmt} />
      ))}
    </div>
  );
}
function LadderRow({ row, max, fmt }: { row: LadderEntry; max: number; fmt?: (n: number) => string }) {
  const w = useGrow((row.val / max) * 100);
  return (
    <div className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${row.me ? "bg-white/15" : ""}`}>
      {row.muted ? (
        <span className="grid h-5 w-5 shrink-0 place-items-center text-xs text-white/50">🌍</span>
      ) : (
        <Avatar avatar={row.avatar} name={row.name} size={20} className="text-[10px]" />
      )}
      <span className={`w-20 shrink-0 truncate text-[11px] ${row.me ? "font-black" : "font-semibold"} ${row.muted ? "text-white/60" : ""}`}>
        {row.name}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full"
          style={{
            width: `${w}%`,
            background: row.me ? "#FDE68A" : row.muted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)",
            transition: "width 1s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums">{fmt ? fmt(row.val) : row.val}</span>
    </div>
  );
}

function Equalizer({ decile }: { decile: number }) {
  const filled = 11 - Math.max(1, Math.min(10, decile)); // decile 1 (top) -> 10 bars
  return (
    <div className="flex h-16 items-end gap-1.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="w-3.5 rounded-t"
          style={{
            height: `${34 + i * 7}%`,
            background: i < filled ? "#FDE68A" : "rgba(255,255,255,0.18)",
            transition: `background 300ms ease ${i * 40}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const R = 66;
  const C = 2 * Math.PI * R;
  const off = C * (1 - useGrow(Math.max(0, Math.min(100, pct))) / 100);
  return (
    <div className="relative grid place-items-center">
      <svg width="168" height="168" className="-rotate-90">
        <circle cx="84" cy="84" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="11" />
        <circle
          cx="84"
          cy="84"
          r={R}
          fill="none"
          stroke="#ffffff"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute grid place-items-center">
        {children}
        <span className="mt-1.5 text-base font-black">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

function CountUp({ value, duration = 1100, format }: { value: number; duration?: number; format?: (n: number) => string }) {
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
          style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }}
        />
      ))}
    </div>
  );
}

const VAR_CSS = `
@keyframes var-in { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.var-in { animation: var-in 480ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes var-confetti-fall { 0% { top: -10%; opacity: 1; } 100% { top: 110%; opacity: 0.9; } }
.var-confetti { position: absolute; top: -10%; width: 9px; height: 15px; border-radius: 2px; animation-name: var-confetti-fall; animation-timing-function: linear; animation-iteration-count: infinite; }
@media (prefers-reduced-motion: reduce) { .var-in { animation: none; } .var-confetti { display: none; } }
`;
