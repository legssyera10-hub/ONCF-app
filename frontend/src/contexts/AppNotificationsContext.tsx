import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Alert, AlertStatus, Notification, OnlineTrial } from "../types";

export type AppNoticeTone = "info" | "warning" | "success";

export type AppNotice = {
  id: number;
  message: string;
  tone: AppNoticeTone;
  to?: string;
  actionLabel?: string;
};

type AppNotificationsContextValue = {
  notices: AppNotice[];
  dismissNotice: (id: number) => void;
};

type EntitySnapshot = {
  status: AlertStatus;
  updatedAt: string;
};

export const AppNotificationsContext = createContext<AppNotificationsContextValue>({
  notices: [],
  dismissNotice: () => undefined,
});

let notificationAudioContext: AudioContext | null = null;

function getAudioContext() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  notificationAudioContext ??= new AudioContextCtor();
  return notificationAudioContext;
}

function unlockNotificationSound() {
  const context = getAudioContext();
  if (!context) return;
  context.resume().catch(() => undefined);
}

function playNotificationTone() {
  const context = getAudioContext();
  if (!context) return;
  context.resume().catch(() => undefined);

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.setValueAtTime(660, now + 0.14);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.36);
}

function getToneForStatus(status: AlertStatus): AppNoticeTone {
  if (status === "ANNULEE" || status === "A_MODIFIER") return "warning";
  if (status === "RECEPTION_COMPLETE" || status === "RECEPTION_PARTIELLE") return "success";
  return "info";
}

function getStatusLabel(status: AlertStatus) {
  const labels: Record<AlertStatus, string> = {
    EN_COURS_DE_TRAITEMENT: "en cours de traitement",
    A_MODIFIER: "a modifier",
    MODIFIEE: "modifiee",
    TRAITEE_PAR_PM: "traitee par le PPM",
    ANNULEE: "annulee",
    RECEPTION_PARTIELLE: "reception partielle",
    RECEPTION_COMPLETE: "reception complete",
  };
  return labels[status] ?? status;
}

function getDossierLabel(item: Pick<Alert | OnlineTrial, "id" | "dossier_label" | "dossier_number">) {
  return item.dossier_label ?? String(item.dossier_number ?? item.id);
}

function getTrackingTarget(role: string | undefined, module: "alerts" | "trials") {
  if (role === "PERMANENT") return module === "alerts" ? "/permanent/dashboard" : "/permanent/essais";
  if (role === "SUIVI") return module === "alerts" ? "/tracking/requests" : "/tracking/essais";
  if (role === "ADMIN") return "/admin/dashboard";
  return undefined;
}

function isTrackingRole(role: string | undefined) {
  return role === "PERMANENT" || role === "ADMIN" || role === "SUIVI";
}

function isRequesterRole(role: string | undefined) {
  return role === "AGENT" || role === "ETABLISSEMENT" || role === "PROJET";
}

function buildSnapshot(status: AlertStatus, updatedAt?: string | null): EntitySnapshot {
  return { status, updatedAt: updatedAt ?? "" };
}

function hasChanged(previous: EntitySnapshot | undefined, next: EntitySnapshot) {
  return previous?.status !== next.status || previous?.updatedAt !== next.updatedAt;
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, token, ready } = useAuth();
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const snapshotsRef = useRef<Map<string, EntitySnapshot>>(new Map());
  const initializedRef = useRef(false);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const pushNotice = useCallback((notice: Omit<AppNotice, "id">, eventKey: string) => {
    if (notifiedKeysRef.current.has(eventKey)) return;
    notifiedKeysRef.current.add(eventKey);
    if (notifiedKeysRef.current.size > 500) {
      notifiedKeysRef.current = new Set(Array.from(notifiedKeysRef.current).slice(-250));
    }

    playNotificationTone();
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current.slice(-3), { id, ...notice }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id));
    }, 12000);
  }, []);

  const syncNotificationState = useCallback(async () => {
    if (!ready || !token || !user || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    try {
      const role = user.role;
      const trackingRole = isTrackingRole(role);
      const requesterRole = isRequesterRole(role);
      const isTechnicentre = role === "AGENT" || role === "ETABLISSEMENT";
      const canReadAlerts = role !== "PROJET";
      const alertQuery = isTechnicentre ? "?mine=true" : "";
      const trialQuery = trackingRole ? "" : "?mine=true";

      const [alerts, notifications, trials] = await Promise.all([
        canReadAlerts ? api.alerts(token, alertQuery) : Promise.resolve([] as Alert[]),
        role === "ETABLISSEMENT" || role === "ADMIN" ? api.notifications(token) : Promise.resolve([] as Notification[]),
        api.onlineTrials(token, trialQuery),
      ]);

      const previousSnapshots = snapshotsRef.current;
      const nextSnapshots = new Map<string, EntitySnapshot>();
      const initialized = initializedRef.current;

      for (const alert of alerts) {
        const snapshotKey = `alert:${alert.id}`;
        const nextSnapshot = buildSnapshot(alert.status, alert.updated_at ?? alert.created_at);
        const previous = previousSnapshots.get(snapshotKey);
        nextSnapshots.set(snapshotKey, nextSnapshot);

        if (!initialized) continue;

        const dossierLabel = getDossierLabel(alert);
        if (trackingRole && alert.status === "EN_COURS_DE_TRAITEMENT" && (!previous || hasChanged(previous, nextSnapshot))) {
          const target = getTrackingTarget(role, "alerts");
          pushNotice(
            {
              message: `Nouvelle demande d'acheminement recue : dossier #${dossierLabel}.`,
              tone: "info",
              to: target,
              actionLabel: target ? "Ouvrir" : undefined,
            },
            `alert:new:${alert.id}:${nextSnapshot.updatedAt}`,
          );
        } else if (previous && previous.status !== alert.status && (requesterRole || role === "ADMIN" || role === "SUIVI")) {
          const target =
            isTechnicentre && alert.created_by.id === user.id
              ? `/technicentre/demande/history/${alert.id}`
              : getTrackingTarget(role, "alerts");
          pushNotice(
            {
              message: `Mise a jour acheminement : dossier #${dossierLabel} ${getStatusLabel(alert.status)}.`,
              tone: getToneForStatus(alert.status),
              to: target,
              actionLabel: target ? "Consulter" : undefined,
            },
            `alert:status:${alert.id}:${alert.status}:${nextSnapshot.updatedAt}`,
          );
        }
      }

      for (const notification of notifications) {
        const snapshotKey = `reception:${notification.id}`;
        const nextSnapshot = buildSnapshot(notification.alert.status, notification.alert.updated_at ?? notification.sent_at);
        const previous = previousSnapshots.get(snapshotKey);
        nextSnapshots.set(snapshotKey, nextSnapshot);

        if (!initialized || previous) continue;

        const dossierLabel = getDossierLabel(notification.alert);
        const target = role === "ETABLISSEMENT" ? `/technicentre/reception/${notification.alert.id}` : "/admin/dashboard";
        pushNotice(
          {
            message: `Demande a receptionner : dossier #${dossierLabel}.`,
            tone: "info",
            to: target,
            actionLabel: "Ouvrir",
          },
          `reception:new:${notification.id}`,
        );
      }

      for (const trial of trials) {
        const snapshotKey = `trial:${trial.id}`;
        const nextSnapshot = buildSnapshot(trial.status, trial.updated_at ?? trial.created_at);
        const previous = previousSnapshots.get(snapshotKey);
        nextSnapshots.set(snapshotKey, nextSnapshot);

        if (!initialized) continue;

        const dossierLabel = getDossierLabel(trial);
        if (trackingRole && trial.status === "EN_COURS_DE_TRAITEMENT" && (!previous || hasChanged(previous, nextSnapshot))) {
          const target = getTrackingTarget(role, "trials");
          pushNotice(
            {
              message: `Nouvelle demande d'essai recue : dossier #${dossierLabel}.`,
              tone: "info",
              to: target,
              actionLabel: target ? "Ouvrir" : undefined,
            },
            `trial:new:${trial.id}:${nextSnapshot.updatedAt}`,
          );
        } else if (previous && previous.status !== trial.status && (requesterRole || role === "ADMIN" || role === "SUIVI")) {
          const target =
            role === "PROJET"
              ? `/projet/essais/${trial.id}`
              : isTechnicentre
                ? `/essais/${trial.id}`
                : getTrackingTarget(role, "trials");
          pushNotice(
            {
              message: `Mise a jour essai : dossier #${dossierLabel} ${getStatusLabel(trial.status)}.`,
              tone: getToneForStatus(trial.status),
              to: target,
              actionLabel: target ? "Consulter" : undefined,
            },
            `trial:status:${trial.id}:${trial.status}:${nextSnapshot.updatedAt}`,
          );
        }
      }

      snapshotsRef.current = nextSnapshots;
      initializedRef.current = true;
    } catch {
      // Keep the previous snapshot on transient API errors to avoid false notifications.
    } finally {
      syncInFlightRef.current = false;
    }
  }, [pushNotice, ready, token, user]);

  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    snapshotsRef.current = new Map();
    initializedRef.current = false;
    notifiedKeysRef.current.clear();
  }, [token, user?.id, user?.role]);

  useEffect(() => {
    void syncNotificationState();
  }, [syncNotificationState]);

  useLiveAlerts(Boolean(ready && token && user), syncNotificationState);

  const value = useMemo(
    () => ({
      notices,
      dismissNotice,
    }),
    [dismissNotice, notices],
  );

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`pointer-events-auto rounded-2xl border bg-white p-4 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.55)] ${
              notice.tone === "warning"
                ? "border-amber-200"
                : notice.tone === "success"
                  ? "border-emerald-200"
                  : "border-sky-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{notice.message}</p>
              <button
                type="button"
                className="rounded-full px-2 text-lg leading-none text-slate-400 hover:text-slate-700"
                onClick={() => dismissNotice(notice.id)}
                aria-label="Fermer la notification"
              >
                x
              </button>
            </div>
            {notice.to ? (
              <Link
                to={notice.to}
                onClick={() => dismissNotice(notice.id)}
                className="mt-3 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                {notice.actionLabel ?? "Ouvrir"}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </AppNotificationsContext.Provider>
  );
}
