export function RealtimeNotice({
  message,
  tone = "info",
  actionLabel,
  onAction,
  onClose,
}: {
  message: string;
  tone?: "info" | "warning" | "success";
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className={`panel flex items-start justify-between gap-4 border p-4 text-sm ${toneClass}`}>
      <p className="flex-1">{message}</p>
      <div className="flex items-center gap-3">
        {actionLabel && onAction ? (
          <button
            type="button"
            className="rounded-full border border-current/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-white/50"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
        <button type="button" className="text-xs font-semibold uppercase tracking-[0.18em]" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
