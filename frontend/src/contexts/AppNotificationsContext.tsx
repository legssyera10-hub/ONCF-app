import { createContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";

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

export const AppNotificationsContext = createContext<AppNotificationsContextValue>({
  notices: [],
  dismissNotice: () => undefined,
});

function shouldNotifyRole(role: string | undefined, eventType: string) {
  if (!role) {
    return false;
  }

  if (eventType === "alert_created") {
    return role === "PERMANENT" || role === "ADMIN" || role === "SUIVI";
  }

  if (eventType === "decision_created") {
    return role === "AGENT" || role === "ETABLISSEMENT" || role === "ADMIN" || role === "SUIVI";
  }

  if (eventType === "reception_confirmed") {
    return false;
  }

  return false;
}

function getNoticeTarget(role: string | undefined, eventType: string, alertId: number) {
  const isTechnicentreRole = role === "AGENT" || role === "ETABLISSEMENT";

  if (eventType === "reception_confirmed") {
    if (isTechnicentreRole) {
      return `/technicentre/reception/history/${alertId}`;
    }
    if (role === "PERMANENT") {
      return "/permanent/dashboard";
    }
    if (role === "ADMIN") {
      return "/admin/dashboard";
    }
    if (role === "SUIVI") {
      return "/tracking/requests";
    }
  }

  if (eventType === "decision_created") {
    if (isTechnicentreRole) {
      return `/technicentre/demande/history/${alertId}`;
    }
    if (role === "ADMIN") {
      return "/admin/dashboard";
    }
    if (role === "SUIVI") {
      return "/tracking/requests";
    }
  }

  if (eventType === "alert_created") {
    if (role === "PERMANENT") {
      return "/permanent/dashboard";
    }
    if (role === "ADMIN") {
      return "/admin/dashboard";
    }
    if (role === "SUIVI") {
      return "/tracking/requests";
    }
  }

  return undefined;
}

function toNotice(
  role: string | undefined,
  eventType: string,
  alertId: number | null,
  note: string
): Omit<AppNotice, "id"> | null {
  if (!alertId) {
    return null;
  }

  const to = getNoticeTarget(role, eventType, alertId);

  if (eventType === "alert_created") {
    return {
      message: `Nouvelle demande reçue : dossier #${alertId}.`,
      tone: "info",
      to,
      actionLabel: to ? "Ouvrir" : undefined,
    };
  }

  if (eventType === "decision_created") {
    return {
      message: `Le dossier #${alertId} a reçu une décision permanent.`,
      tone: "info",
      to,
      actionLabel: to ? "Voir le dossier" : undefined,
    };
  }

  if (eventType === "reception_confirmed") {
    return {
      message: `La réception du dossier #${alertId} a été confirmée.`,
      tone: "success",
      to,
      actionLabel: to ? "Consulter" : undefined,
    };
  }

  return null;
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, token, ready } = useAuth();
  const [notices, setNotices] = useState<AppNotice[]>([]);

  function dismissNotice(id: number) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  useLiveAlerts(Boolean(ready && token && user), () => undefined, (payload) => {
    const eventType = typeof payload.type === "string" ? payload.type : "";
    const alertId = typeof payload.alert_id === "number" ? payload.alert_id : null;
    const note = typeof payload.note === "string" ? payload.note : "";

    if (!shouldNotifyRole(user?.role, eventType)) {
      return;
    }

    const notice = toNotice(user?.role, eventType, alertId, note);
    if (!notice) {
      return;
    }

    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current.slice(-3), { id, ...notice }]);
  });

  const value = useMemo(
    () => ({
      notices,
      dismissNotice,
    }),
    [notices]
  );

  return <AppNotificationsContext.Provider value={value}>{children}</AppNotificationsContext.Provider>;
}
