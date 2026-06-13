import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer, storePlayerId } from "@/lib/identity";
import { useI18n, type Lang } from "@/lib/i18n";
import { AvatarPicker } from "@/components/AvatarPicker";


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

  async function refresh() {
    setSyncing(true);
    try {
      await fetch("/api/public/sync-matches", { method: "POST" });
    } finally {
      setSyncing(false);
    }
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
            onChange={async (next) => {
              const { data } = await supabase
                .from("players")
                .update({ avatar: next })
                .eq("id", player.id)
                .select()
                .single();
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

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      {label && <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</h2>}
      {children}
    </section>
  );
}
