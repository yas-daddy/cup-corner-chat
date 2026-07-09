import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Download, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/AvatarPicker";
import { VAR_STARTING_BANK, type VarReport } from "@/lib/varReport";

// Spotify-Wrapped-style full-screen stories player for the end-of-tournament
// VAR Report. Vivid gradients + white text on purpose — its own bold world,
// independent of the app's light/dark theme. Commentary is English-only.

const SLIDE_MS = 7000;
const money = (n: number) => `$${n.toLocaleString()}`;

type Slide = {
  key: string;
  gradient: string;
  confetti?: boolean;
  ms?: number;
  node: React.ReactNode;
};

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

  // Auto-advance + progress bar via rAF so pause is trivial.
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
        return; // last slide holds
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

      <div
        key={clampedIndex}
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
              style={{ width: i < clampedIndex ? "100%" : i === clampedIndex ? `${progress * 100}%` : "0%" }}
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

function buildSlides(
  r: VarReport,
  actions: { onNext: () => void; onClose: () => void; onReplay: () => void },
): Slide[] {
  const { board, best, quiz, bet } = r;
  const firstName = r.player.name.split(/\s+/)[0] || r.player.name;
  const slides: Slide[] = [];

  // 0 — Cover
  slides.push({
    key: "cover",
    gradient: "linear-gradient(160deg,#7C3AED 0%,#DB2777 55%,#F97316 100%)",
    node: (
      <Layout>
        <div className="text-7xl">🎬</div>
        <Kicker>The final whistle has blown 📺</Kicker>
        <Big>
          Your 2026 <br />
          World&nbsp;Cup, <br />
          wrapped
        </Big>
        <Line>Roll the tape, {firstName}. No overturns — just receipts. 🎥</Line>
      </Layout>
    ),
  });

  // 1 — Predictions volume (outlined number)
  slides.push({
    key: "preds",
    gradient: "linear-gradient(160deg,#4338CA 0%,#2563EB 60%,#06B6D4 100%)",
    node: (
      <Layout>
        <Kicker>You stepped up 🎯</Kicker>
        <NumOutline className="text-[7rem]">
          <CountUp value={board.predictionsMade} />
        </NumOutline>
        <Sub>predictions made</Sub>
        <Line>{predsLine(board.predictionsMade)}</Line>
      </Layout>
    ),
  });

  // 2 — Accuracy (two differently-coloured numbers)
  slides.push({
    key: "accuracy",
    gradient: "linear-gradient(160deg,#0F766E 0%,#059669 55%,#84CC16 100%)",
    node: (
      <Layout>
        <Kicker>Reading the game 🧠</Kicker>
        <div className="flex items-end justify-center gap-8">
          <div className="flex flex-col items-center">
            <NumGradient from="#FFFFFF" to="#BBF7D0" className="text-6xl">
              <CountUp value={board.correctResults} />
            </NumGradient>
            <Sub>right calls ✅</Sub>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-[color:#FDE68A] px-4 py-1 text-5xl font-black tabular-nums text-emerald-900 shadow-lg">
              <CountUp value={board.exactScores} />
            </div>
            <Sub>exact 💯</Sub>
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
        <Kicker>Your masterpiece 🖼️</Kicker>
        {best ? (
          <>
            <div className="rounded-3xl bg-white/12 px-6 py-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/80">
                {best.homeTeam} v {best.awayTeam}
              </p>
              <p className="mt-2 text-5xl font-black tabular-nums">
                {best.predHome}–{best.predAway}
              </p>
              <p className="mt-1 text-xs text-white/70">
                {best.homeScore != null && best.awayScore != null
                  ? `actual ${best.homeScore}–${best.awayScore}`
                  : "your call"}
                {best.isExact ? " · nailed it 🎯" : ""}
              </p>
            </div>
            <div className="rounded-full bg-white/90 px-5 py-1.5 text-2xl font-black text-orange-700">
              +<CountUp value={best.points} /> pts
            </div>
            <Line>{bestLine(best.points, best.isExact)}</Line>
          </>
        ) : (
          <Line>No pick ever troubled the scorers. A moment of silence. 🕯️</Line>
        )}
      </Layout>
    ),
  });

  // 4 — Quiz (chip number)
  slides.push({
    key: "quiz",
    gradient: "linear-gradient(160deg,#A21CAF 0%,#7C3AED 55%,#4F46E5 100%)",
    node: (
      <Layout>
        <Kicker>Trivia time 🧠</Kicker>
        {quiz.answered > 0 ? (
          <>
            <div className="flex items-baseline gap-2">
              <NumGradient from="#FFFFFF" to="#E9D5FF" className="text-8xl">
                <CountUp value={quiz.correct} />
              </NumGradient>
              <span className="text-4xl font-bold text-white/50">/{quiz.answered}</span>
            </div>
            <Sub>quiz answers nailed 🎓</Sub>
            <Line>{quizLine(quiz.correct, quiz.answered)}</Line>
          </>
        ) : (
          <>
            <div className="text-7xl">🦗</div>
            <Sub>zero questions answered</Sub>
            <Line>The Daily Quiz waited by the window. It's not crying. You are. 😢</Line>
          </>
        )}
      </Layout>
    ),
  });

  // 5 — Betting activity (gradient money)
  slides.push({
    key: "staked",
    gradient: "linear-gradient(160deg,#065F46 0%,#0D9488 55%,#22C55E 100%)",
    node: (
      <Layout>
        <Kicker>At the window 🎰</Kicker>
        {bet.staked > 0 ? (
          <>
            <NumGradient from="#FFFFFF" to="#FDE68A" className="text-[6.5rem]">
              <CountUp value={bet.staked} format={money} />
            </NumGradient>
            <Sub>staked all tournament 💸</Sub>
            <Line>{stakedLine(bet.decile)}</Line>
          </>
        ) : (
          <>
            <div className="text-7xl">🧘</div>
            <Sub>$0 staked</Sub>
            <Line>A monk in a casino. Ice in the veins, cash in the pocket. 🧊</Line>
          </>
        )}
      </Layout>
    ),
  });

  // 6 — P&L (dynamic gradient + delta pill)
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
        <Kicker>The bottom line 💰</Kicker>
        <p className="text-sm text-white/70">from {money(VAR_STARTING_BANK)} you ended on</p>
        <NumGradient from="#FFFFFF" to={up ? "#DCFCE7" : flat ? "#E2E8F0" : "#FED7AA"} className="text-[6.5rem]">
          <CountUp value={bet.balance} format={money} />
        </NumGradient>
        <div
          className={`rounded-full px-5 py-1.5 text-xl font-black shadow ${
            flat ? "bg-white/15 text-white" : up ? "bg-white text-green-700" : "bg-black/30 text-white"
          }`}
        >
          {up ? "📈 +" : bet.profit < 0 ? "📉 −" : "⚖️ "}
          {money(Math.abs(bet.profit)).slice(1)}
        </div>
        <Line>{pnlLine(bet.profit, bet.balance)}</Line>
      </Layout>
    ),
  });

  // 7 — Finale: rank reveal + leaderboard slide-up
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

  // 8 — Summary bento + share
  slides.push({
    key: "summary",
    gradient: "linear-gradient(160deg,#1E1B4B 0%,#4C1D95 55%,#831843 100%)",
    node: <SummarySlide report={r} onClose={actions.onClose} onReplay={actions.onReplay} />,
  });

  return slides;
}

// --- Finale (rank + leaderboard slide-up) -----------------------------------

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
      <div className="rounded-full bg-white/15 px-4 py-1 text-sm font-bold">
        {board.points} pts on the board 🎯
      </div>
      <Line>{finaleLine(board.rank, board.total)}</Line>

      {/* Leaderboard slide-up */}
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-black/35 backdrop-blur-md transition-transform duration-500 ease-out"
        style={{ transform: showBoard ? "translateY(0)" : "translateY(100%)", height: "56%" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/40" />
        <p className="px-5 pt-2 pb-1 text-xs font-bold uppercase tracking-widest text-white/70">
          🏆 Final table
        </p>
        <div className="max-h-[calc(100%-88px)] overflow-y-auto px-3 pb-3">
          {standings.map((s) => {
            const mine = s.playerId === report.player.id;
            return (
              <div
                key={s.playerId}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 ${
                  mine ? "bg-white/90 text-neutral-900" : "bg-white/5 text-white"
                }`}
              >
                <span className={`w-6 text-center text-sm font-black tabular-nums ${mine ? "" : "text-white/60"}`}>
                  {medal(s.rank)}
                </span>
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

// --- Summary bento + share --------------------------------------------------

function SummarySlide({
  report,
  onClose,
  onReplay,
}: {
  report: VarReport;
  onClose: () => void;
  onReplay: () => void;
}) {
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

      {/* Hero tile (rank) */}
      <BentoTile tile={hero} big />

      {/* 2-col grid */}
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
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Share2 className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
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
      <button
        type="button"
        onClick={onClose}
        className="text-center text-xs font-medium text-white/60 active:text-white/80"
      >
        Close
      </button>
    </div>
  );
}

function BentoTile({ tile, big }: { tile: Tile; big?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3 ${big ? "flex items-center gap-4" : ""}`}
      style={{ background: tile.bg, borderColor: tile.ring }}
    >
      <div className={big ? "text-4xl" : "text-2xl"}>{tile.emoji}</div>
      <div className={big ? "flex-1" : ""}>
        <div className={`font-black tabular-nums leading-tight ${big ? "text-3xl" : "text-xl"}`}>{tile.value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{tile.label}</div>
      </div>
    </div>
  );
}

type Tile = { emoji: string; label: string; value: string; bg: string; ring: string; hex: string };

const ACCENT = {
  gold: { hex: "#F59E0B" },
  violet: { hex: "#8B5CF6" },
  blue: { hex: "#3B82F6" },
  green: { hex: "#22C55E" },
  fuchsia: { hex: "#D946EF" },
  teal: { hex: "#14B8A6" },
  red: { hex: "#EF4444" },
  orange: { hex: "#F97316" },
} as const;

function tint(hex: string): { bg: string; ring: string; hex: string } {
  return { bg: `${hex}2E`, ring: `${hex}80`, hex };
}

function summaryTiles(r: VarReport): Tile[] {
  const { board, best, quiz, bet } = r;
  const up = bet.profit >= 0;
  return [
    { emoji: rankEmoji(board.rank, board.total), label: "Where you finished", value: `#${board.rank} of ${board.total}`, ...tint(ACCENT.gold.hex) },
    { emoji: "🎯", label: "Points", value: `${board.points}`, ...tint(ACCENT.violet.hex) },
    { emoji: "📝", label: "Predictions", value: `${board.predictionsMade}`, ...tint(ACCENT.blue.hex) },
    { emoji: "💯", label: "Exact scores", value: `${board.exactScores}`, ...tint(ACCENT.green.hex) },
    { emoji: "🧠", label: "Quiz", value: quiz.answered > 0 ? `${quiz.correct}/${quiz.answered}` : "—", ...tint(ACCENT.fuchsia.hex) },
    { emoji: "💸", label: "Staked", value: money(bet.staked), ...tint(ACCENT.teal.hex) },
    { emoji: up ? "📈" : "📉", label: "Profit", value: `${up ? "+" : "−"}${money(Math.abs(bet.profit)).slice(1)}`, ...tint(up ? ACCENT.green.hex : ACCENT.red.hex) },
    { emoji: "⚽", label: "Best pick", value: best ? `+${best.points}` : "—", ...tint(ACCENT.orange.hex) },
  ];
}

// Canvas share card — mirrors the bento. No deps, no image tainting (avatars
// are emoji text). Web Share API with a file, falling back to download.
async function shareVarReport(r: VarReport) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1E1B4B");
  bg.addColorStop(0.55, "#4C1D95");
  bg.addColorStop(1, "#831843");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText("🎬  WORLD CUP VAR REPORT", W / 2, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px system-ui, sans-serif";
  ctx.fillText(r.player.name, W / 2, 165);

  const tiles = summaryTiles(r);
  const pad = 60;
  const gap = 26;
  let y = 220;

  // Hero tile full width
  drawTile(ctx, pad, y, W - pad * 2, 150, tiles[0], true);
  y += 150 + gap;

  // 2-col grid
  const colW = (W - pad * 2 - gap) / 2;
  const rowH = 150;
  const rest = tiles.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (colW + gap);
    drawTile(ctx, x, y + row * (rowH + gap), colW, rowH, rest[i], false);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("cup-corner-chat · World Cup 2026 ⚽", W / 2, H - 46);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "wc26-var-report.png", { type: "image/png" });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "My World Cup VAR Report" } as ShareData);
      return;
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tile: Tile,
  big: boolean,
) {
  roundRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = tile.hex + "33";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = tile.hex + "99";
  ctx.stroke();

  ctx.textAlign = "left";
  if (big) {
    ctx.font = "64px system-ui, sans-serif";
    ctx.fillText(tile.emoji, x + 36, y + h / 2 + 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 60px system-ui, sans-serif";
    ctx.fillText(tile.value, x + 130, y + h / 2 - 2);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText(tile.label.toUpperCase(), x + 130, y + h / 2 + 40);
  } else {
    ctx.font = "44px system-ui, sans-serif";
    ctx.fillText(tile.emoji, x + 28, y + 62);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 46px system-ui, sans-serif";
    ctx.fillText(tile.value, x + 28, y + 116);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText(tile.label.toUpperCase(), x + 28, y + h - 20);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Tier commentary (short + punchy) ---------------------------------------

function predsLine(n: number): string {
  if (n === 0) return "Zero predictions. A ghost in the machine. 👻";
  if (n <= 8) return `${n} picks. You browsed, you left. A tourist. 🧳`;
  if (n <= 24) return `${n} picks. Reliable as a Sunday alarm. ⏰`;
  if (n <= 48) return `${n} predictions. The fixtures feared you. 😤`;
  return `${n}?! Predicting games that don't exist. Touch grass. 🌱`;
}

function accuracyLine(correct: number, exact: number): string {
  if (correct === 0) return "Zero right. Boldly, consistently wrong. 🙃";
  if (exact === 0) return `${correct} right, zero exact. So close, so vague. 🌫️`;
  if (exact <= 2) return `${exact} exact scoreline${exact === 1 ? "" : "s"}. Tidy work. 🔮`;
  if (exact <= 5) return `${exact} exact scores? Suspicious. Blink twice. 👀`;
  return `${exact} exact?! Someone call Interpol. 🚨`;
}

function bestLine(points: number, isExact: boolean): string {
  if (isExact) return "Nailed to the goal. Frame it. 🖼️";
  if (points >= 10) return "Chef's kiss. You saw it coming. 👨‍🍳";
  if (points >= 5) return "A tidy little earner. 💼";
  return "Your BEST one. We're being kind. 🥲";
}

function quizLine(correct: number, answered: number): string {
  const pct = answered > 0 ? correct / answered : 0;
  if (pct >= 0.85) return `${correct}/${answered}. Insufferable at the pub. 🍺`;
  if (pct >= 0.6) return `${correct}/${answered}. You know your football. ⚽`;
  if (pct >= 0.35) return `${correct}/${answered}. Participation counts. Allegedly. 🎗️`;
  return `${correct}/${answered}. Only way is up. 📈`;
}

function stakedLine(decile: number | null): string {
  if (decile === null) return "The house never learned your name. 🕶️";
  if (decile <= 1) return "Top 10% of degenerates. The house loves you. 🎰";
  if (decile <= 3) return `Top ${decile * 10}%. Big-spender energy. 💸`;
  if (decile <= 6) return "Measured. Boring. Solvent. 🧾";
  return "You bet in loose change. 🪙";
}

function pnlLine(profit: number, balance: number): string {
  if (profit >= 200) return "Up big. Quit your— actually, don't. 🍀";
  if (profit > 0) return "Beat the house and walked. Take it. 🟢";
  if (profit === 0) return "Dead even. A round trip to nowhere. 🔁";
  if (profit > -200) return "Down, but dignified. 🎩";
  return `Down to ${money(balance)}. The bookie bought a boat. 🛥️`;
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
  if (total === 0) return "Undefeated and un-victorious. 🤷";
  if (rank === 1) return "CHAMPION. Bow before the oracle. 👑";
  if (rank <= 3) return "Podium. So close to glory. 🍾";
  if (rank <= Math.ceil(total / 2)) return "Upper half. Quietly excellent. 🎩";
  if (rank === total) return "Dead last. The spoon is yours. 🥄";
  return "Mid-table comfort. 🛋️";
}

// --- Presentational primitives ----------------------------------------------

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
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold text-white/85">{children}</p>;
}
function Line({ children }: { children: React.ReactNode }) {
  return <p className="max-w-xs text-sm leading-relaxed text-white/90">{children}</p>;
}
function NumGradient({
  children,
  from,
  to,
  className,
}: {
  children: React.ReactNode;
  from: string;
  to: string;
  className?: string;
}) {
  return (
    <div
      className={`font-black tabular-nums leading-none drop-shadow ${className ?? ""}`}
      style={{
        backgroundImage: `linear-gradient(180deg, ${from}, ${to})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {children}
    </div>
  );
}
function NumOutline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`font-black tabular-nums leading-none ${className ?? ""}`}
      style={{ WebkitTextStroke: "2.5px rgba(255,255,255,0.92)", color: "transparent" }}
    >
      {children}
    </div>
  );
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
