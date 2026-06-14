import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const PIN = "1878";

export function GodModePinModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (value.length === 4) {
      if (value === PIN) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setValue("");
          setError(false);
        }, 600);
      }
    }
  }, [value, onSuccess]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-3xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-border/50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">God Mode</p>
          <h2 className="mt-1 text-lg font-extrabold">Enter PIN</h2>
        </div>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="sr-only"
        />
        <div
          className={`flex justify-center gap-3 ${error ? "animate-pulse" : ""}`}
          onClick={() => inputRef.current?.focus()}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-12 w-10 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                error
                  ? "border-red-500 text-red-500"
                  : value.length > i
                  ? "border-ink bg-ink text-surface"
                  : "border-border text-ink"
              }`}
            >
              {value[i] ? "•" : ""}
            </div>
          ))}
        </div>
        {error && (
          <p className="mt-3 text-center text-xs text-red-500">Incorrect PIN</p>
        )}
      </div>
    </div>
  );
}
