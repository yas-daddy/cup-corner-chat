import { Share, Plus, X, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isIOS } from "@/lib/push";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export function InstallPwaModal({
  open,
  onOpenChange,
  title = "Install the WC26 app",
  description = "Add this site to your home screen for quick access, push notifications, and the full app experience.",
  icon,
}: Props) {
  const ios = typeof navigator !== "undefined" && isIOS();
  const stepIcon = icon ?? <Smartphone className="h-4 w-4" />;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            {icon ?? <Smartphone className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
          {ios ? (
            <>
              <Step n={1} icon={<Share className="h-4 w-4" />} text="Tap the Share button in Safari's toolbar." />
              <Step n={2} icon={<Plus className="h-4 w-4" />} text='Choose "Add to Home Screen".' />
              <Step n={3} icon={stepIcon} text="Open the app from your home screen." />
            </>
          ) : (
            <>
              <Step n={1} icon={<Plus className="h-4 w-4" />} text='Open your browser menu and choose "Install app" or "Add to Home screen".' />
              <Step n={2} icon={stepIcon} text="Launch the installed app from your home screen." />
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
