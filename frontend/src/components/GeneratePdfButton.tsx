import type { Alert } from "../types";
import { downloadAlertPdf } from "../utils/alertPdf";

export function GeneratePdfButton({ alert }: { alert: Alert }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100"
      onClick={() => downloadAlertPdf(alert)}
    >
      Générer PDF
    </button>
  );
}
