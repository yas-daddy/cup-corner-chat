import { useEffect, useMemo, useState } from "react";
import { Bell, Share, Plus, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/AvatarPicker";
import { useI18n } from "@/lib/i18n";
import type { Player } from "@/lib/identity";
import { isPushSupported, getPermissionState, subscribePush, isIOS, isStandalone } from "@/lib/push";

type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: "like" | "comment" | "reply" | "result";
  target_type: "prediction" | "activity" | "match";
  target_id: string;
  match_id: string | null;
  points: number | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell({ playerId }: { playerId: string }) {
  const { t, n, dir } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [actors, setActors] = useState<Record<string, Player>>({});
  const [open, setOpen] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    if (isPushSupported()) setPushPerm(getPermissionState());
    else setPushPerm("unsupported");
  }, []);

  async function enablePush() {
    // If push isn't supported here, or the user is in a regular browser (not installed as a PWA),
    // explain they need to install to the home screen first.
    if (!isPushSupported() || !isStandalone()) {
      setInstallModalOpen(true);
      return;
    }
    setPushBusy(true);
    await subscribePush(playerId);
    setPushBusy(false);
    setPushPerm(getPermissionState());
  }

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", playerId)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data as Notification[] | null) ?? [];
    setItems(rows);
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
    if (actorIds.length) {
      const { data: ps } = await supabase.from("players").select("*").in("id", actorIds);
      const map: Record<string, Player> = {};
      ((ps as Player[] | null) ?? []).forEach((p) => (map[p.id] = p));
      setActors(map);
    }
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`notifications:${playerId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${playerId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const unread = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) {
      const ids = items.filter((i) => !i.read_at).map((i) => i.id);
      // optimistic
      setItems((cur) => cur.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    }
  }

  function openItem(item: Notification) {
    setOpen(false);
    if (item.match_id) {
      void navigate({ to: "/matches/$matchId", params: { matchId: item.match_id } });
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("notifications")}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-ink hover:bg-border/60"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : n(unread)}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>{t("notifications")}</SheetTitle>
        </SheetHeader>
        <div className="max-h-[calc(100dvh-56px)] overflow-y-auto">
          {pushPerm !== "granted" && pushPerm !== "denied" && (
            <div className="flex items-start gap-3 border-b border-border bg-primary/5 px-4 py-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{t("push_soft_prompt")}</p>
              </div>
              <button
                onClick={enablePush}
                disabled={pushBusy}
                className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {t("push_soft_enable")}
              </button>
            </div>
          )}
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">{t("no_notifications")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const actor = item.actor_id ? actors[item.actor_id] : null;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => openItem(item)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-border/60 ${!item.read_at ? "bg-accent/5" : ""}`}
                      dir={dir}
                    >
                      {actor?.avatar ? (
                        <Avatar avatar={actor.avatar} name={actor.display_name} size={36} className="border border-border text-lg" />
                      ) : (
                        <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-base">
                          {item.kind === "result" ? "🏆" : "🔔"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          {renderText(item, actor?.display_name ?? null, t, n)}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">{relTime(item.created_at, n)}</p>
                      </div>
                      {!item.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <InstallPwaModal open={installModalOpen} onOpenChange={setInstallModalOpen} />
    </>
  );
}

function InstallPwaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ios = typeof navigator !== "undefined" && isIOS();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Install the app to get notifications</DialogTitle>
          <DialogDescription className="text-center">
            Browsers can't send push notifications here. Add this site to your home screen first, then open it from the app icon to turn on alerts.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
          {ios ? (
            <>
              <Step n={1} icon={<Share className="h-4 w-4" />} text="Tap the Share button in Safari's toolbar." />
              <Step n={2} icon={<Plus className="h-4 w-4" />} text='Choose "Add to Home Screen".' />
              <Step n={3} icon={<Bell className="h-4 w-4" />} text="Open the app from your home screen and tap Turn on." />
            </>
          ) : (
            <>
              <Step n={1} icon={<Plus className="h-4 w-4" />} text='Open your browser menu and choose "Install app" or "Add to Home screen".' />
              <Step n={2} icon={<Bell className="h-4 w-4" />} text="Launch the installed app and tap Turn on here." />
            </>
          )}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-white"
        >
          Got it
        </button>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-border/60"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{n}</span>
      <div className="flex flex-1 items-start gap-2 text-ink">
        <span className="mt-0.5 shrink-0 text-ink-soft">{icon}</span>
        <span className="leading-snug">{text}</span>
      </div>
    </div>
  );
}


function renderText(
  item: Notification,
  actorName: string | null,
  t: (k: string) => string,
  n: (v: string | number) => string,
) {
  const who = actorName ?? t("someone");
  if (item.kind === "like") return `${who} ${t("notif_liked")}`;
  if (item.kind === "comment") return `${who} ${t("notif_commented")}`;
  if (item.kind === "reply") return `${who} ${t("notif_replied")}`;
  // result
  const pts = item.points ?? 0;
  if (pts === 8) return t("notif_result_exact");
  if (pts === 3) return t("notif_result_correct");
  return t("notif_result_none");
  void n;
}

function relTime(iso: string, n: (v: string | number) => string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${n(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${n(h)}h`;
  return `${n(Math.floor(h / 24))}d`;
}
