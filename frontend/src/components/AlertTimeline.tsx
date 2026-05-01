import type { AlertHistoryItem } from "../types";
import { formatDateTime } from "../utils/format";
import { getBusinessStatusLabel } from "../utils/status";

function getHistoryStatusLabel(status: AlertHistoryItem["status"]) {
  return getBusinessStatusLabel(status);
}

export function AlertTimeline({ history }: { history: AlertHistoryItem[] }) {
  return (
    <div className="space-y-5">
      {history.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex w-8 flex-col items-center">
            <div className="mt-1 h-3.5 w-3.5 rounded-full border-4 border-orange-100 bg-brand-500 shadow-[0_0_0_10px_rgba(249,115,22,0.08)]" />
            {index < history.length - 1 ? <div className="mt-2 min-h-16 w-px bg-gradient-to-b from-orange-100 via-slate-200 to-slate-100" /> : null}
          </div>

          <div className="flex-1 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] px-5 py-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Étape</p>
                <p className="mt-2 text-[1.08rem] font-semibold text-slate-900">{getHistoryStatusLabel(item.status)}</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium tracking-[0.18em] text-slate-500">
                {formatDateTime(item.changed_at)}
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">{item.changed_by?.full_name ?? "Système"}</p>
            {item.note ? <p className="mt-4 text-base leading-7 text-slate-700">{item.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
