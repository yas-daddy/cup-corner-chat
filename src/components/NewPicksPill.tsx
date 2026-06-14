import { ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function NewPicksPill({ count, onTap }: { count: number; onTap: () => void }) {
  const { t, n } = useI18n();
  if (count <= 0) return null;
  const key = count === 1 ? "new_picks_pill_one" : "new_picks_pill_other";
  const label = t(key).replace("{n}", n(count));
  return (
    <div className="sticky top-2 z-30 mb-3 flex justify-center pointer-events-none">
      <button
        onClick={onTap}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 animate-in fade-in slide-in-from-top-2"
      >
        <span>{label}</span>
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}
