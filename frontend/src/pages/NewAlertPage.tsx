import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SecurityBanner } from "../components/SecurityBanner";
import { useAuth } from "../hooks/useAuth";
import { toLocalInputDateTime } from "../utils/format";
import type {
  AdminAlertFormConfig,
  Decision,
  Establishment,
  MaintenanceState,
  MaterialType,
  Severity,
  Station,
  TransportMode,
  TransportType,
} from "../types";

const serieOptions = [
  "E1100",
  "E1250",
  "E1300",
  "E1350",
  "E1400",
  "E1450",
  "Z2M",
  "ZM",
  "DH350",
  "DH400",
  "WAGON",
  "VOITURE",
  "VOITURE+FG",
  "FG",
  "DI500",
  "DK550",
  "DM600",
  "DF100",
  "AUTRE",
] as const;

type SerieOption = (typeof serieOptions)[number];

type MaterialEntry = {
  id: number;
  type_materiel: MaterialType;
  serie: SerieOption;
  customSerie: string;
  materiel_concerne: string;
};

const transportModeOptions = [
  { value: "FRET" as TransportMode, label: "Mode Fret" },
  { value: "VOYAGEUR" as TransportMode, label: "Mode Voyageur" },
];

const transportTypeOptions = [
  { value: "HLP" as TransportType, label: "HLP" },
  { value: "VHL" as TransportType, label: "VHL" },
];

const accompanimentOptions = [
  { value: "NIVEAU_1" as Severity, label: "Sans" },
  { value: "NIVEAU_2" as Severity, label: "Avec" },
];

const DEFAULT_FRET_SPEED_VALUE = "NORMAL_FRET";
const DEFAULT_FRET_SPEED_LABEL = "Normal fret";
const DEFAULT_VOYAGEUR_SPEED_VALUE = "NORMAL_VOYAGEUR";
const DEFAULT_VOYAGEUR_SPEED_LABEL = "Normal voyageur";
const DEFAULT_MIXED_SPEED_VALUE = "NORMALE";
const DEFAULT_MIXED_SPEED_LABEL = "NORMALE";
const DEFAULT_SPEED_OPTIONS = [
  { value: "140", label: "140" },
  { value: "130", label: "130" },
  { value: "120", label: "120" },
  { value: "110", label: "110" },
  { value: "100", label: "100" },
  { value: "90", label: "90" },
  { value: "80", label: "80" },
  { value: "70", label: "70" },
  { value: "60", label: "60" },
  { value: "50", label: "50" },
  { value: "40", label: "40" },
  { value: "30", label: "30" },
  { value: "20", label: "20" },
  { value: "10", label: "10" },
  { value: "5", label: "5" },
] as const;

function normalizeAccompanimentSeverity(value: Severity): Severity {
  return value === "NIVEAU_1" ? "NIVEAU_1" : "NIVEAU_2";
}

const conditionFieldLabelClassName =
  "block min-h-[2.75rem] text-xs font-semibold uppercase tracking-[0.18em] text-slate-500";

function normalizeModeLabel(value: string) {
  if (value === "VOYAGEUR") return "Mode Voyageur";
  if (value === "FRET") return "Mode Fret";
  return value;
}

function normalizeModeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isMixedNormalMode(value: string) {
  const mode = normalizeModeToken(value);
  return (
    mode.includes("NORMAL") &&
    mode.includes("FRET") &&
    (mode.includes("VOYAGEUR") || mode.includes("VOY") || mode.includes("FRET OU V"))
  );
}

function getDefaultSpeedValueForMode(mode: string) {
  const normalizedMode = normalizeModeToken(mode);
  if (isMixedNormalMode(normalizedMode)) {
    return DEFAULT_MIXED_SPEED_VALUE;
  }
  if (normalizedMode === "VOYAGEUR") {
    return DEFAULT_VOYAGEUR_SPEED_VALUE;
  }
  return DEFAULT_FRET_SPEED_VALUE;
}

const DEFAULT_FORM_CONFIG: AdminAlertFormConfig = {
  fields: {
    etablissement_dest_id: { required: true, options: [] },
    date_demande: { required: false, options: [] },
    type_materiel: { required: true, options: ["MM", "MR"] },
    serie: { required: true, options: [...serieOptions] },
    materiel_concerne: { required: false, options: [] },
    mode_acheminement: { required: true, options: ["FRET", "VOYAGEUR"] },
    type_acheminement: { required: true, options: ["HLP", "VHL"] },
    etat_maintenance: { required: true, options: ["PFL", "PV"] },
    gravite: { required: true, options: ["NIVEAU_1", "NIVEAU_2"] },
    vitesse: { required: false, options: DEFAULT_SPEED_OPTIONS.map((item) => item.value) },
    probleme: { required: true, options: [] },
    conditions_acheminement: { required: true, options: [] },
  },
};

export function NewAlertPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [stations, setStations] = useState<Station[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [formConfig, setFormConfig] = useState<AdminAlertFormConfig>(DEFAULT_FORM_CONFIG);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isRameMode, setIsRameMode] = useState(false);
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([
    { id: 1, type_materiel: "MM", serie: "E1100", customSerie: "", materiel_concerne: "" },
  ]);
  const [form, setForm] = useState({
    station_id: 0,
    etablissement_dest_id: 0,
    mode_acheminement: "FRET" as TransportMode,
    type_acheminement: "HLP" as TransportType,
    date_demande: toLocalInputDateTime(new Date().toISOString()),
    vitesse: DEFAULT_FRET_SPEED_VALUE,
    motif: "",
    exp: "PFL" as MaintenanceState,
    gravite: "NIVEAU_1" as Severity,
    conditions_acheminement: "",
    decision_agent: "CONFIRMER" as Decision,
  });

  useEffect(() => {
    if (!token) {
      setError("Session expirée. Reconnectez-vous.");
      return;
    }

    Promise.all([
      api.stations(token),
      api.establishments(token),
      api.alertFormConfig(token),
      isEditMode && id ? api.alertById(token, Number(id)) : Promise.resolve(null),
    ])
      .then(([stationsResult, establishmentsResult, formConfigResult, alertResult]) => {
        setStations(stationsResult);
        setEstablishments(establishmentsResult);
        setFormConfig(formConfigResult);

        if (!alertResult) {
          setForm((prev) => ({
            ...prev,
            station_id: stationsResult[0]?.id ?? 0,
            etablissement_dest_id: establishmentsResult[0]?.id ?? 0,
          }));
          return;
        }

        const series = alertResult.material_ref.split(" + ").map((item) => item.trim()).filter(Boolean);
        const materialTypes = (alertResult.material_type ?? "").split(" + ").map((item) => item.trim()).filter(Boolean);
        const concernedMaterials = (alertResult.material_concerned ?? "").split(" + ").map((item) => item.trim());
        setMaterialEntries(
          (series.length > 0 ? series : ["E1100"]).map((serie, index) => {
            const isKnownSerie = serieOptions.includes(serie as SerieOption);
            return {
              id: index + 1,
              type_materiel: materialTypes[index] || materialTypes[0] || "MM",
              serie: isKnownSerie ? (serie as SerieOption) : "AUTRE",
              customSerie: isKnownSerie ? "" : serie,
              materiel_concerne: concernedMaterials[index] || "",
            };
          })
        );
        setIsRameMode(series.length > 1);
        setForm({
          station_id: alertResult.station.id,
          etablissement_dest_id: alertResult.requested_destination_establishment?.id ?? establishmentsResult[0]?.id ?? 0,
          mode_acheminement: alertResult.transport_mode,
          type_acheminement: alertResult.transport_type,
          date_demande: alertResult.request_date
            ? toLocalInputDateTime(alertResult.request_date)
            : toLocalInputDateTime(new Date().toISOString()),
          vitesse:
            alertResult.speed_kmh != null
              ? String(alertResult.speed_kmh)
              : getDefaultSpeedValueForMode(alertResult.transport_mode),
          motif: alertResult.problem_description,
          exp: alertResult.maintenance_state,
          gravite: normalizeAccompanimentSeverity(alertResult.severity),
          conditions_acheminement: alertResult.transport_conditions_initial,
          decision_agent: alertResult.agent_decision,
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Impossible de charger les sites et les destinataires")
      );
  }, [token, isEditMode, id]);

  const configFields = formConfig.fields ?? {};
  const required = (fieldKey: string) => Boolean(configFields[fieldKey]?.required);

  const modeOptions = (configFields.mode_acheminement?.options?.length
    ? configFields.mode_acheminement.options
    : transportModeOptions.map((item) => item.value)
  ).map((value) => ({ value: value as TransportMode, label: normalizeModeLabel(value) }));

  const typeOptions = (configFields.type_acheminement?.options?.length
    ? configFields.type_acheminement.options
    : transportTypeOptions.map((item) => item.value)
  ).map((value) => ({ value: value as TransportType, label: value }));

  const exploitantOptions = (configFields.etat_maintenance?.options?.length
    ? configFields.etat_maintenance.options
    : ["PFL", "PV"]
  ).map((value) => value as MaintenanceState);

  const accompanimentConfigOptions = (configFields.gravite?.options?.length
    ? configFields.gravite.options
    : accompanimentOptions.map((item) => item.value)
  ).map((value) => ({ value: value as Severity, label: value === "NIVEAU_1" ? "Sans" : "Avec" }));

  const materielConcerneOptions = configFields.materiel_concerne?.options?.length
    ? configFields.materiel_concerne.options
    : [];

  const serieConfigOptions = (configFields.serie?.options?.length
    ? configFields.serie.options
    : [...serieOptions]
  ) as SerieOption[];

  const materialTypeOptions = (configFields.type_materiel?.options?.length
    ? configFields.type_materiel.options
    : ["MM", "MR"]) as MaterialType[];

  const vitesseConfigValues = (configFields.vitesse?.options?.length
    ? configFields.vitesse.options
    : DEFAULT_SPEED_OPTIONS.map((item) => item.value)
  )
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item));
  const freightSpeedOptions = [
    { value: DEFAULT_FRET_SPEED_VALUE, label: DEFAULT_FRET_SPEED_LABEL },
    ...vitesseConfigValues.map((item) => ({ value: item, label: item })),
  ].filter((item, index, array) => array.findIndex((other) => other.value === item.value) === index);
  const voyageurSpeedOptions = [
    { value: DEFAULT_VOYAGEUR_SPEED_VALUE, label: DEFAULT_VOYAGEUR_SPEED_LABEL },
    ...vitesseConfigValues.map((item) => ({ value: item, label: item })),
  ].filter((item, index, array) => array.findIndex((other) => other.value === item.value) === index);
  const mixedNormalSpeedOptions = [
    { value: DEFAULT_MIXED_SPEED_VALUE, label: DEFAULT_MIXED_SPEED_LABEL },
    ...DEFAULT_SPEED_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
  ].filter((item, index, array) => array.findIndex((other) => other.value === item.value) === index);

  const currentModeSpeedOptions = isMixedNormalMode(form.mode_acheminement)
    ? mixedNormalSpeedOptions
    : form.mode_acheminement === "VOYAGEUR"
      ? voyageurSpeedOptions
      : freightSpeedOptions;

  useEffect(() => {
    if (modeOptions.length > 0 && !modeOptions.some((item) => item.value === form.mode_acheminement)) {
      setForm((prev) => ({
        ...prev,
        mode_acheminement: modeOptions[0].value,
        vitesse: getDefaultSpeedValueForMode(modeOptions[0].value),
      }));
    }
    if (typeOptions.length > 0 && !typeOptions.some((item) => item.value === form.type_acheminement)) {
      setForm((prev) => ({ ...prev, type_acheminement: typeOptions[0].value }));
    }
    if (exploitantOptions.length > 0 && !exploitantOptions.includes(form.exp)) {
      setForm((prev) => ({ ...prev, exp: exploitantOptions[0] }));
    }
    if (accompanimentConfigOptions.length > 0 && !accompanimentConfigOptions.some((item) => item.value === form.gravite)) {
      setForm((prev) => ({ ...prev, gravite: accompanimentConfigOptions[0].value }));
    }
  }, [modeOptions, typeOptions, exploitantOptions, accompanimentConfigOptions, form.mode_acheminement, form.type_acheminement, form.exp, form.gravite]);

  useEffect(() => {
    const availableSpeeds = currentModeSpeedOptions.map((item) => item.value);
    if (availableSpeeds.length === 0) {
      return;
    }
    if (!availableSpeeds.includes(form.vitesse)) {
      setForm((prev) => ({
        ...prev,
        vitesse: getDefaultSpeedValueForMode(prev.mode_acheminement),
      }));
    }
  }, [form.mode_acheminement, form.vitesse, currentModeSpeedOptions]);

  function updateMaterialEntry(id: number, changes: Partial<MaterialEntry>) {
    setMaterialEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  }

  function addMaterialEntry() {
    const defaultSerie = serieConfigOptions[0] ?? "AUTRE";
    const defaultType = materialTypeOptions[0] ?? "MM";
    setMaterialEntries((prev) => [
      ...prev,
      { id: (prev[prev.length - 1]?.id ?? 0) + 1, type_materiel: defaultType, serie: defaultSerie, customSerie: "", materiel_concerne: "" },
    ]);
  }

  function removeMaterialEntry(id: number) {
    setMaterialEntries((prev) => (prev.length > 1 ? prev.filter((entry) => entry.id !== id) : prev));
  }

  return (
    <div className="panel mx-auto max-w-5xl p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          {isEditMode ? "Modifier la demande d'acheminement" : "Creer une demande d'acheminement"}
        </h2>
        {isEditMode ? (
          <p className="mt-2 text-sm text-slate-500">Mettez a jour la demande. La version precedente restera archivee.</p>
        ) : null}
      </div>
      <SecurityBanner />

      <form
        className="mt-8 space-y-8"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!token) {
            setError("Session expirée. Reconnectez-vous.");
            return;
          }

          const finalSeries = materialEntries.map((entry) => (entry.serie === "AUTRE" ? entry.customSerie.trim() : entry.serie));
          const finalMaterialTypes = materialEntries.map((entry) => entry.type_materiel.trim()).filter(Boolean);
          const finalConcernedMaterials = materialEntries.map((entry) => entry.materiel_concerne.trim());
          if (required("serie") && finalSeries.some((value) => !value)) {
            setError("Veuillez renseigner chaque serie.");
            return;
          }
          if (required("type_materiel") && finalMaterialTypes.length !== finalSeries.length) {
            setError("Veuillez renseigner le type de chaque materiel.");
            return;
          }
          const finalSerie = finalSeries.join(" + ");
          const finalMaterialType = finalMaterialTypes.join(" + ");
          if (finalSerie.length > 120) {
            setError("La reference de rame est trop longue. Reduisez le nombre de materiels ou utilisez des references plus courtes.");
            return;
          }
          if (required("etablissement_dest_id") && !form.etablissement_dest_id) {
            setError("Veuillez choisir un destinataire.");
            return;
          }
          if (required("date_demande") && !form.date_demande) {
            setError("Veuillez renseigner la date de la demande.");
            return;
          }
          if (required("probleme") && !form.motif.trim()) {
            setError("Veuillez renseigner le motif.");
            return;
          }
          if (required("conditions_acheminement") && !form.conditions_acheminement.trim()) {
            setError("Veuillez renseigner les autres conditions.");
            return;
          }
          if (required("materiel_concerne") && finalConcernedMaterials.some((value) => !value)) {
            setError("Veuillez renseigner le materiel concerne.");
            return;
          }
          if (required("vitesse") && !form.vitesse) {
            setError("Veuillez renseigner la vitesse.");
            return;
          }

          try {
            setSaving(true);
            setError("");
            const payloadData = {
              station_id: form.station_id,
              etablissement_dest_id: form.etablissement_dest_id,
              type_materiel: finalMaterialType,
              identifiant_materiel: finalSerie,
              materiel_concerne: finalConcernedMaterials.join(" + "),
              date_demande: form.date_demande ? new Date(form.date_demande).toISOString() : null,
              vitesse:
                form.vitesse === getDefaultSpeedValueForMode(form.mode_acheminement)
                    ? null
                    : form.vitesse
                      ? Number(form.vitesse)
                      : null,
              mode_acheminement: form.mode_acheminement,
              type_acheminement: form.type_acheminement,
              probleme: form.motif,
              etat_maintenance: form.exp,
              gravite: normalizeAccompanimentSeverity(form.gravite),
              conditions_acheminement: form.conditions_acheminement,
              decision_agent: form.decision_agent,
            };
            let alert;
            if (isEditMode && id) {
              alert = await api.updateAlert(token, Number(id), payloadData);
            } else {
              const payload = new FormData();
              payload.append("station_id", String(payloadData.station_id));
              payload.append("etablissement_dest_id", String(payloadData.etablissement_dest_id));
              payload.append("type_materiel", payloadData.type_materiel);
              payload.append("identifiant_materiel", payloadData.identifiant_materiel);
              payload.append("materiel_concerne", payloadData.materiel_concerne);
              if (payloadData.date_demande) payload.append("date_demande", payloadData.date_demande);
              if (payloadData.vitesse != null) payload.append("vitesse", String(payloadData.vitesse));
              payload.append("mode_acheminement", payloadData.mode_acheminement);
              payload.append("type_acheminement", payloadData.type_acheminement);
              payload.append("probleme", payloadData.probleme);
              payload.append("etat_maintenance", payloadData.etat_maintenance);
              payload.append("gravite", payloadData.gravite);
              payload.append("conditions_acheminement", payloadData.conditions_acheminement);
              payload.append("decision_agent", payloadData.decision_agent);
              files.forEach((file) => payload.append("files", file));
              alert = await api.createAlert(token, payload);
            }
            navigate(`/technicentre/alerts?alert=${alert.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
          } finally {
            setSaving(false);
          }
        }}
      >
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-3">
            <label className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Site</span>
              <select
                className="input bg-white"
                value={form.station_id}
                onChange={(e) => setForm((prev) => ({ ...prev, station_id: Number(e.target.value) }))}
              >
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destinataire</span>
              <select
                className="input bg-white"
                value={form.etablissement_dest_id}
                onChange={(e) => setForm((prev) => ({ ...prev, etablissement_dest_id: Number(e.target.value) }))}
                required={required("etablissement_dest_id")}
              >
                {establishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date de la demande</span>
              <input
                className="input bg-white"
                type="datetime-local"
                value={form.date_demande}
                onChange={(e) => setForm((prev) => ({ ...prev, date_demande: e.target.value }))}
                required={required("date_demande")}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Materiel</span>
              <button
                type="button"
                aria-pressed={isRameMode}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isRameMode
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"
                }`}
                onClick={() => {
                  setIsRameMode((prev) => {
                    const next = !prev;
                    if (!next) {
                      setMaterialEntries((current) => current.slice(0, 1));
                    }
                    return next;
                  });
                }}
              >
                {isRameMode ? "Rame active" : "Activer rame"}
              </button>
            </div>

            <div className="space-y-3">
              {materialEntries.map((entry, index) => (
                <div key={entry.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_auto]">
                    <label className="space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Type de materiel</span>
                      <select
                        className="input bg-white"
                        value={entry.type_materiel}
                        onChange={(e) => updateMaterialEntry(entry.id, { type_materiel: e.target.value as MaterialType })}
                        required={required("type_materiel")}
                      >
                        {materialTypeOptions.map((option) => (
                          <option key={`${entry.id}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Serie</span>
                      <select
                        className="input bg-white"
                        value={entry.serie}
                        onChange={(e) => updateMaterialEntry(entry.id, { serie: e.target.value as SerieOption, customSerie: "" })}
                        required={required("serie")}
                      >
                        {serieConfigOptions.map((serie) => (
                          <option key={serie} value={serie}>
                            {serie === "AUTRE" ? "autre" : serie}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Materiel concerne</span>
                      {materielConcerneOptions.length > 0 ? (
                        <select
                          className="input bg-white"
                          value={entry.materiel_concerne}
                          onChange={(e) => updateMaterialEntry(entry.id, { materiel_concerne: e.target.value })}
                          required={required("materiel_concerne")}
                        >
                          <option value="">Choisir le materiel concerne</option>
                          {materielConcerneOptions.map((option) => (
                            <option key={`${entry.id}-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                          {entry.materiel_concerne && !materielConcerneOptions.includes(entry.materiel_concerne) ? (
                            <option value={entry.materiel_concerne}>{entry.materiel_concerne}</option>
                          ) : null}
                        </select>
                      ) : (
                        <input
                          className="input bg-white"
                          type="text"
                          placeholder={`Saisir le materiel concerne ${index + 1}`}
                          value={entry.materiel_concerne}
                          onChange={(e) => updateMaterialEntry(entry.id, { materiel_concerne: e.target.value })}
                          required={required("materiel_concerne")}
                        />
                      )}
                    </label>

                    {isRameMode && materialEntries.length > 1 ? (
                      <button
                        type="button"
                        className="btn-secondary self-end px-3 py-3 text-sm"
                        onClick={() => removeMaterialEntry(entry.id)}
                        aria-label={`Retirer le materiel ${index + 1}`}
                      >
                        -
                      </button>
                    ) : null}
                  </div>

                  {entry.serie === "AUTRE" ? (
                    <input
                      className="input bg-white"
                      placeholder={`Saisir la serie du materiel ${index + 1}`}
                      value={entry.customSerie}
                      onChange={(e) => updateMaterialEntry(entry.id, { customSerie: e.target.value })}
                      required={required("serie")}
                    />
                  ) : null}
                </div>
              ))}

              {isRameMode ? (
                <button type="button" className="btn-secondary w-full" onClick={addMaterialEntry}>
                  + Ajouter un materiel
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="space-y-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conditions</span>
            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2.5">
                <span className={conditionFieldLabelClassName}>Mode d'acheminement</span>
                <select
                  className="input bg-white"
                  value={form.mode_acheminement}
                  onChange={(e) => {
                    const nextMode = e.target.value as TransportMode;
                    setForm((prev) => ({
                      ...prev,
                      mode_acheminement: nextMode,
                      vitesse: getDefaultSpeedValueForMode(nextMode),
                    }));
                  }}
                  required={required("mode_acheminement")}
                >
                  {modeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className={conditionFieldLabelClassName}>Type d'acheminement</span>
                <select
                  className="input bg-white"
                  value={form.type_acheminement}
                  onChange={(e) => setForm((prev) => ({ ...prev, type_acheminement: e.target.value as TransportType }))}
                  required={required("type_acheminement")}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className={conditionFieldLabelClassName}>Exploitant (PV/PFL)</span>
                <select
                  className="input bg-white"
                  value={form.exp}
                  onChange={(e) => setForm((prev) => ({ ...prev, exp: e.target.value as MaintenanceState }))}
                  required={required("etat_maintenance")}
                >
                  {exploitantOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className={conditionFieldLabelClassName}>Accompagnement</span>
                <select
                  className="input bg-white"
                  value={form.gravite}
                  onChange={(e) => setForm((prev) => ({ ...prev, gravite: e.target.value as Severity }))}
                  required={required("gravite")}
                >
                  {accompanimentConfigOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className={conditionFieldLabelClassName}>Vitesse (km/h)</span>
                <select
                  className="input bg-white"
                  value={form.vitesse}
                  onChange={(e) => setForm((prev) => ({ ...prev, vitesse: e.target.value }))}
                  required={required("vitesse")}
                >
                  {currentModeSpeedOptions.map((speedOption) => (
                    <option key={speedOption.value} value={speedOption.value}>
                      {speedOption.label}
                    </option>
                  ))}
                </select>
              </label>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
          <label className="block space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Motif</span>
            <textarea
              className="input min-h-32 resize-y bg-slate-50/60"
              placeholder="Decrire clairement le motif de la demande d'acheminement"
              value={form.motif}
              onChange={(e) => setForm((prev) => ({ ...prev, motif: e.target.value }))}
              required={required("probleme")}
            />
          </label>

          <label className="block space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Autres conditions</span>
            <textarea
              className="input min-h-32 resize-y bg-slate-50/60"
              placeholder="Preciser le mode fret ou voyageur, l'accompagnement, la vitesse et les restrictions utiles"
              value={form.conditions_acheminement}
              onChange={(e) => setForm((prev) => ({ ...prev, conditions_acheminement: e.target.value }))}
              required={required("conditions_acheminement")}
            />
          </label>
        </section>

        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6">
          <p className="text-sm font-medium text-slate-700">Pieces jointes optionnelles</p>
          <p className="mt-1 text-xs text-slate-500">Photos ou documents associes a la demande d'acheminement.</p>
          <input
            className="input mt-4 bg-white"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 ? (
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {files.map((file) => (
                <p key={`${file.name}-${file.lastModified}`}>{file.name}</p>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate("/technicentre/alerts")}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Enregistrement..." : isEditMode ? "Mettre a jour" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}


