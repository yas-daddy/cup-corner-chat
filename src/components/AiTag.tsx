import { useI18n } from "@/lib/i18n";

export function AiTag({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary ${className}`}
      title="AI-generated"
    >
      {t("ai_tag")}
    </span>
  );
}
