import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isPushSupported, isStandalone, getPermissionState, subscribePush } from "@/lib/push";

const STORAGE_KEY = "wc26.push.autoprompt.shown";

export function PushAutoPrompt({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPushSupported() || !isStandalone()) return;
    if (getPermissionState() !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
  }

  async function enable() {
    setBusy(true);
    await subscribePush(playerId);
    setBusy(false);
    dismiss();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Turn on notifications?</DialogTitle>
          <DialogDescription className="text-center">
            Get pinged when someone likes your pick, comments on it, or when your match results are in.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-2">
          <button
            onClick={enable}
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Turn on notifications"}
          </button>
          <button
            onClick={dismiss}
            className="w-full rounded-2xl py-2 text-sm text-ink-soft hover:bg-border/60"
          >
            Not now
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-border/60"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
