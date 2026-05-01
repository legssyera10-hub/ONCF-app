import type { Alert } from "../types";
import { TransportDossierRow } from "./TransportDossierRow";

export function AlertCard({
  alert,
  onSelect,
  selected,
}: {
  alert: Alert;
  onSelect: (id: number) => void;
  selected?: boolean;
}) {
  const latestNote = alert.history
    .slice()
    .reverse()
    .find((item) => item.note?.trim())?.note;

  return <TransportDossierRow alert={alert} latestNote={latestNote} onSelect={onSelect} selected={selected} />;
}
