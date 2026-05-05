import type { OnlineTrial } from "../types";

export function resolveOnlineTrialDirections(trial: Pick<OnlineTrial, "parcours_aller" | "parcours_retour">) {
  const aller = trial.parcours_aller !== false;
  const retour = trial.parcours_retour !== false;
  if (!aller && !retour) {
    return { aller: true, retour: true };
  }
  return { aller, retour };
}

export function getOnlineTrialDirectionText(trial: Pick<OnlineTrial, "parcours_aller" | "parcours_retour">) {
  const { aller, retour } = resolveOnlineTrialDirections(trial);
  if (aller && retour) return "aller/retour";
  if (aller) return "aller";
  return "retour";
}

export function getOnlineTrialDirectionTitleSuffix(trial: Pick<OnlineTrial, "parcours_aller" | "parcours_retour">) {
  return `(${getOnlineTrialDirectionText(trial)})`;
}

export function getOnlineTrialParcoursLabel(trial: Pick<OnlineTrial, "parcours_aller" | "parcours_retour">) {
  return `Parcours (${getOnlineTrialDirectionText(trial)})`;
}
