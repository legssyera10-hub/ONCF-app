import type { Alert } from "../types";
import { getApiTimestamp } from "./format";

const ESTIMATED_TRANSPORT_DURATION_MS = 6 * 60 * 60 * 1000;

function getEstimatedArrivalTimestamp(alert: Alert) {
  const start = getApiTimestamp(alert.permanent_decision?.created_at ?? null);
  if (Number.isNaN(start)) {
    return null;
  }
  return start + ESTIMATED_TRANSPORT_DURATION_MS;
}

export function getEstimatedArrivalIso(alert: Alert) {
  const etaTimestamp = getEstimatedArrivalTimestamp(alert);
  if (etaTimestamp === null) {
    return alert.permanent_decision?.created_at ?? alert.created_at;
  }
  return new Date(etaTimestamp).toISOString();
}

export function isTransportInProgress(alert: Alert) {
  return (
    alert.permanent_decision?.decision === "CONFIRMER" &&
    alert.status !== "RECEPTION_COMPLETE" &&
    alert.status !== "ANNULEE" &&
    alert.status !== "MODIFIEE"
  );
}

export function isRealizedTransport(alert: Alert) {
  return (
    alert.permanent_decision?.decision === "CONFIRMER" &&
    alert.status === "RECEPTION_COMPLETE"
  );
}

export function getTransportProgress(alert: Alert, now = Date.now()) {
  if (alert.status === "RECEPTION_COMPLETE") {
    return 100;
  }
  if (alert.status === "ANNULEE" || alert.status === "MODIFIEE") {
    return 0;
  }

  const decision = alert.permanent_decision;
  if (!decision?.created_at) {
    return null;
  }

  const start = getApiTimestamp(decision.created_at);
  const end = getEstimatedArrivalTimestamp(alert);
  if (Number.isNaN(start) || end === null || end <= start) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return Math.min(98, Math.round(ratio * 100));
}

export function isLateOverOneHour(alert: Alert, now = Date.now()) {
  if (alert.status === "RECEPTION_COMPLETE" || alert.status === "ANNULEE" || alert.status === "MODIFIEE") {
    return false;
  }

  const etaTimestamp = getEstimatedArrivalTimestamp(alert);
  if (etaTimestamp === null) {
    return false;
  }

  return now - etaTimestamp > 60 * 60 * 1000;
}

export function getCurrentDelayLabel(alert: Alert, now = Date.now()) {
  if (alert.status === "RECEPTION_COMPLETE" || alert.status === "ANNULEE" || alert.status === "MODIFIEE") {
    return null;
  }

  const etaTimestamp = getEstimatedArrivalTimestamp(alert);
  if (etaTimestamp === null) {
    return null;
  }

  const delayMs = now - etaTimestamp;
  if (delayMs <= 0) {
    return null;
  }

  const totalMinutes = Math.floor(delayMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}j`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}min`);
  }

  return parts.join(" ");
}
