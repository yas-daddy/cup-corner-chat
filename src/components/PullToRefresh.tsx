import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

// Twitter-style pull-to-refresh: the content itself translates down as the
// user drags, revealing a spinner in the space above. Past the trigger
// threshold the spinner tints primary. On release above threshold the sheet
// snaps to a fixed "refreshing" position while the callback runs, then
// eases back with a soft spring. Below threshold it just springs back.
//
// The spinner is absolutely positioned inside the wrapper (not fixed), so
// it moves in sync with any transform / scroll and doesn't clash with the
// bottom nav or route transitions.
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const { pull, refreshing, threshold } = usePullToRefresh(onRefresh);
  const idle = pull === 0 && !refreshing;
  const settling = idle || refreshing;
  const progress = Math.min(1, pull / threshold);
  const contentOffset = refreshing ? threshold : pull;
  const readyToTrigger = pull >= threshold && !refreshing;
  const indicatorScale = 0.6 + progress * 0.4;

  return (
    <div className="relative">
      <div
        aria-hidden={idle}
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center overflow-hidden"
        style={{
          height: `${contentOffset}px`,
          transition: settling ? `height 320ms ${SPRING}` : "none",
        }}
      >
        <div
          className={`mt-3 grid h-10 w-10 place-items-center rounded-full border shadow-lg ${
            readyToTrigger || refreshing
              ? "border-primary/50 bg-primary/10"
              : "border-border bg-surface"
          }`}
          style={{
            transform: `scale(${refreshing ? 1 : indicatorScale})`,
            opacity: refreshing ? 1 : Math.min(1, progress * 1.4),
            transition: settling ? `transform 320ms ${SPRING}, opacity 200ms` : "none",
          }}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin text-primary"
                : readyToTrigger
                  ? "text-primary"
                  : "text-ink-soft"
            }`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              transition: refreshing || settling ? "transform 200ms ease-out" : "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          transform: `translate3d(0, ${contentOffset}px, 0)`,
          transition: settling ? `transform 320ms ${SPRING}` : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
