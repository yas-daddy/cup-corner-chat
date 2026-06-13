import { useState } from "react";
import { AVATAR_EMOJIS, Avatar, useTakenAvatars } from "@/components/AvatarPicker";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/identity";
import { useI18n } from "@/lib/i18n";

export function AvatarPromptModal({
  player,
  onSaved,
}: {
  player: Player;
  onSaved: (p: Player) => void;
}) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taken = useTakenAvatars(player.id);

  async function save(emoji: string) {
    if (saving) return;
    setSaving(true);
    setPicked(emoji);
    const { data, error } = await supabase
      .from("players")
      .update({ avatar: emoji })
      .eq("id", player.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setPicked(null);
      alert("That emoji was just taken — please pick another.");
      return;
    }
    if (data) onSaved(data as Player);
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-3">
          <Avatar avatar={picked} name={player.display_name} size={56} className="border border-border text-3xl" />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold">{t("pick_avatar_title")}</h2>
            <p className="text-xs text-ink-soft">{t("pick_avatar_sub")}</p>
          </div>
        </div>
        <div className="grid grid-cols-8 gap-2 rounded-2xl border border-border bg-surface p-3">
          {AVATAR_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={saving}
              onClick={() => save(e)}
              className={`grid aspect-square place-items-center rounded-xl text-2xl transition ${
                picked === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-white active:bg-white"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
