import { useEffect, useRef, useState } from "react";

// Distance the user has to drag past before release triggers a refresh.
const THRESHOLD = 80;
// Cap the visual pull. Past this point the indicator stops growing.
const MAX = 120;

// Touch-driven pull-to-refresh. Active only when window scrollY === 0 and the
// user is dragging DOWN. The wrapper component reads `pull` (current drag in px,
// rubber-banded) and `refreshing` (after release, while onRefresh runs).
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const state = useRef({ active: false, startY: 0, pull: 0, refreshing: false });

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (state.current.refreshing) return;
      if (window.scrollY > 0) return;
      state.current.active = true;
      state.current.startY = e.touches[0].clientY;
      state.current.pull = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!state.current.active) return;
      const dy = e.touches[0].clientY - state.current.startY;
      if (dy <= 0) {
        state.current.active = false;
        state.current.pull = 0;
        setPull(0);
        return;
      }
      // Rubber-band: drag distance scales sub-linearly.
      const dist = Math.min(MAX, dy * 0.5);
      state.current.pull = dist;
      setPull(dist);
      if (e.cancelable) e.preventDefault();
    };
    const onTouchEnd = async () => {
      if (!state.current.active) return;
      state.current.active = false;
      const dist = state.current.pull;
      if (dist >= THRESHOLD) {
        state.current.refreshing = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          state.current.refreshing = false;
          state.current.pull = 0;
          setRefreshing(false);
          setPull(0);
        }
      } else {
        state.current.pull = 0;
        setPull(0);
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return { pull, refreshing, threshold: THRESHOLD };
}
