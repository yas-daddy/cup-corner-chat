import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, LogOut, Bell, BellOff, Sun, Moon, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer, storePlayerId } from "@/lib/identity";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { AvatarPicker } from "@/components/AvatarPicker";
import {
  isPushSupported,
  getPermissionState,
  isIOS,
  isStandalone,
  subscribePush,
  unsubscribePush,
  getCurrentEndpoint,
} from "@/lib/push";


export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "WC26 Predictor — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { player, setPlayer } = useCurrentPlayer();
  const [name, setName] = useState(player?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);


  async function saveName() {
    if (!player || !name.trim()) return;
    setSavingName(true);
    const { data, error } = await supabase
      .from("players")
      .update({ display_name: name.trim() })
      .eq("id", player.id)
      .select()
      .single();
    setSavingName(false);
    if (!error && data) setPlayer(data as typeof player);
  }




  function signOut() {
    storePlayerId(null);
    setPlayer(null);
    navigate({ to: "/" });
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">{t("settings")}</h1>
      </header>

      <Section label={t("language")}>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "fa"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${lang === l ? "border-primary bg-primary text-white" : "border-border bg-surface text-ink"}`}
            >
              {t(`language_${l}`)}
            </button>
          ))}
        </div>
      </Section>

      {player && (
        <Section label={t("avatar")}>
          <AvatarPicker
            value={player.avatar}
            playerId={player.id}
            onChange={async (next) => {
              const { data, error } = await supabase
                .from("players")
                .update({ avatar: next })
                .eq("id", player.id)
                .select()
                .single();
              if (error) {
                alert("That emoji is already taken by another player.");
                return;
              }
              if (data) setPlayer(data as typeof player);
            }}
          />

        </Section>
      )}

      {player && (
        <Section label={t("change_name")}>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary"
            />
            <button
              onClick={saveName}
              disabled={savingName || !name.trim() || name.trim() === player.display_name}
              className="rounded-2xl bg-primary px-5 font-semibold text-white disabled:opacity-50"
            >
              {t("save")}
            </button>
          </div>
        </Section>
      )}

      {player && (
        <Section label={t("push_section")}>
          <PushToggle playerId={player.id} />
        </Section>
      )}

      <Section label={t("scoring_title")}>
        <p className="rounded-2xl border border-border bg-surface px-4 py-4 text-sm leading-relaxed text-ink-soft">
          {t("scoring_body")}
        </p>
      </Section>

      {player && (
        <Section>
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/5 py-3 font-semibold text-accent"
          >
            <LogOut className="h-4 w-4" />
            {player.display_name} →
          </button>
        </Section>
      )}
    </div>
  );
}

function PushToggle({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  async function refresh() {
    const p = getPermissionState();
    setPerm(p);
    if (p === "granted") {
      const ep = await getCurrentEndpoint();
      setSubscribed(Boolean(ep));
    } else {
      setSubscribed(false);
    }
    setIosNeedsInstall(isIOS() && !isStandalone());
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!isPushSupported() || perm === "unsupported") {
    return (
      <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-soft">
        {t("push_unsupported")}
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    const r = await subscribePush(playerId);
    setBusy(false);
    if (!r.ok && r.reason === "denied") setPerm("denied");
    await refresh();
  }

  async function disable() {
    setBusy(true);
    await unsubscribePush();
    setBusy(false);
    await refresh();
  }

  return (
    <div className="space-y-2">
      {iosNeedsInstall && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {t("push_ios_hint")}
        </p>
      )}
      {perm === "denied" ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-soft">
          {t("push_blocked")}
        </p>
      ) : subscribed ? (
        <div className="space-y-2">
          <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-soft">
            {t("push_enabled")}
          </p>
          <button
            onClick={disable}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 font-semibold text-ink disabled:opacity-50"
          >
            <BellOff className="h-4 w-4" />
            {t("push_disable")}
          </button>
        </div>
      ) : (
        <button
          onClick={enable}
          disabled={busy || iosNeedsInstall}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
        >
          <Bell className="h-4 w-4" />
          {t("push_enable")}
        </button>
      )}
    </div>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      {label && <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</h2>}
      {children}
    </section>
  );
}
