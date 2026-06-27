import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

// Renders a floating indicator that grows + rotates as the user pulls down,
// then spins while the parent's onRefresh resolves. Does not transform the
// content itself — the indicator just floats above so layout stays stable.
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const { pull, refreshing, threshold } = usePullToRefresh(onRefresh);
  const visible = pull > 6 || refreshing;
  const progress = Math.min(1, pull / threshold);

  return (
    <>
      <div
        aria-hidden={!visible}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          height: `${Math.max(pull, refreshing ? threshold : 0)}px`,
          opacity: visible ? 1 : 0,
          transition: refreshing || pull === 0 ? "height 200ms ease-out, opacity 200ms" : "none",
        }}
      >
        <div className="mt-3 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface shadow">
          <RefreshCw
            className={`h-4 w-4 text-ink-soft ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              opacity: refreshing ? 1 : 0.4 + progress * 0.6,
            }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
