import type { MailEvent } from "../types";
import { formatDateTime } from "../utils/format";

export function OutlookMailBar({
  title,
  description,
  mailEvent,
}: {
  title: string;
  description?: string;
  mailEvent?: MailEvent | null;
}) {
  return (
    <div className="rounded-[1.8rem] border border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.92),rgba(255,255,255,0.98))] p-5 shadow-[0_20px_50px_-34px_rgba(2,132,199,0.45)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Messagerie Outlook</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{title}</h3>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {mailEvent ? (
          <span className="rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700">
            {mailEvent.delivery_status} · {formatDateTime(mailEvent.created_at)}
          </span>
        ) : null}
      </div>

      {mailEvent ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2 rounded-[1.4rem] border border-white/80 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">En-tête</p>
            <p className="text-sm font-semibold text-slate-900">{mailEvent.subject}</p>
            <p className="text-sm text-slate-600">Expéditeur : {mailEvent.sender_email ?? "Non configuré"}</p>
            <p className="text-sm text-slate-600">Destinataires : {mailEvent.recipient_emails || "Non configurés"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/80 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Contenu</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{mailEvent.body}</pre>
            {mailEvent.error_message ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{mailEvent.error_message}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-sky-200 bg-white/80 p-4 text-sm text-slate-600">
          Aucun message Outlook n’a encore été journalisé pour ce dossier.
        </div>
      )}
    </div>
  );
}
