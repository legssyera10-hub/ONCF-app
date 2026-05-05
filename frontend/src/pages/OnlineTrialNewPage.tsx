import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SecurityBanner } from "../components/SecurityBanner";
import { useAuth } from "../hooks/useAuth";
import { toLocalInputDateTime } from "../utils/format";
import type {
  AdminAlertFormConfig,
  MaintenanceState,
  MaterialType,
  OnlineTrial,
  Severity,
  Station,
  TransportMode,
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

const DEFAULT_SPEED_VALUE = "";
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

const DEFAULT_FORM_CONFIG: AdminAlertFormConfig = {
  fields: {
    station_id: { required: true, options: [] },
    date_demande: { required: false, options: [] },
    type_materiel: { required: true, options: ["MM", "MR"] },
    serie: { required: true, options: [...serieOptions] },
    materiel_concerne: { required: false, options: [] },
    mode_acheminement: { required: false, options: ["US", "UM"] },
    etat_maintenance: { required: true, options: ["PFL", "PV"] },
    gravite: { required: true, options: ["NIVEAU_1", "NIVEAU_2"] },
    vitesse: { required: false, options: DEFAULT_SPEED_OPTIONS.map((item) => item.value) },
    probleme: { required: true, options: [] },
    conditions_acheminement: { required: true, options: [] },
  },
};

function getScope(pathname: string) {
  if (pathname.startsWith("/projet/")) {
    return { base: "/projet/essais", label: "Projet" };
  }
  return { base: "/essais", label: "Technicentre" };
}

function mapTrialToEntries(trial: OnlineTrial): MaterialEntry[] {
  const series = trial.material_ref.split(" + ").map((item) => item.trim()).filter(Boolean);
  const materialTypes = (trial.material_type ?? "").split(" + ").map((item) => item.trim()).filter(Boolean);
  const concernedMaterials = (trial.material_concerned ?? "").split(" + ").map((item) => item.trim());

  return (series.length > 0 ? series : ["E1100"]).map((serie, index) => {
    const isKnownSerie = serieOptions.includes(serie as SerieOption);
    return {
      id: index + 1,
      type_materiel: materialTypes[index] || materialTypes[0] || "MM",
      serie: isKnownSerie ? (serie as SerieOption) : "AUTRE",
      customSerie: isKnownSerie ? "" : serie,
      materiel_concerne: concernedMaterials[index] || "",
    };
  });
}

export function OnlineTrialNewPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scope = getScope(location.pathname);
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [stations, setStations] = useState<Station[]>([]);
  const [formConfig, setFormConfig] = useState<AdminAlertFormConfig>(DEFAULT_FORM_CONFIG);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [canEditCurrentTrial, setCanEditCurrentTrial] = useState(true);
  const [isRameMode, setIsRameMode] = useState(false);
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([
    { id: 1, type_materiel: "MM", serie: "E1100", customSerie: "", materiel_concerne: "" },
  ]);
  const [form, setForm] = useState({
    departure_station_id: 0,
    arrival_station_id: 0,
    parcours_aller: true,
    parcours_retour: true,
    mode_acheminement: "" as TransportMode,
    date_depart: toLocalInputDateTime(new Date().toISOString()),
    vitesse: DEFAULT_SPEED_VALUE,
    motif: "",
    exp: "PFL" as MaintenanceState,
    gravite: "NIVEAU_1" as Severity,
    conditions_acheminement: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Session expiree. Reconnectez-vous.");
      return;
    }

    Promise.all([
      api.stations(token),
      api.onlineTrialFormConfig(token),
      isEditMode && id ? api.onlineTrialById(token, Number(id)) : Promise.resolve(null),
    ])
      .then(([stationsResult, formConfigResult, trialResult]) => {
        setStations(stationsResult);
        setFormConfig(formConfigResult);

        if (!trialResult) {
          setCanEditCurrentTrial(true);
          const departureDefault = stationsResult[0]?.id ?? 0;
          const arrivalDefault = stationsResult[1]?.id ?? departureDefault;
          setForm((prev) => ({
            ...prev,
            departure_station_id: departureDefault,
            arrival_station_id: arrivalDefault,
          }));
          return;
        }

        const entries = mapTrialToEntries(trialResult);
        setMaterialEntries(entries);
        setIsRameMode(entries.length > 1);
        const isEditableTrial = trialResult.status === "A_MODIFIER";
        setCanEditCurrentTrial(isEditableTrial);
        if (isEditMode && !isEditableTrial) {
          setError("Cette demande d'essai ne peut pas etre modifiee.");
        }
        setForm({
          departure_station_id: trialResult.departure_station?.id ?? trialResult.station.id,
          arrival_station_id: trialResult.arrival_station?.id ?? trialResult.station.id,
          parcours_aller: trialResult.parcours_aller !== false,
          parcours_retour: trialResult.parcours_retour !== false,
          mode_acheminement: trialResult.transport_mode || "",
          date_depart: trialResult.departure_date
            ? toLocalInputDateTime(trialResult.departure_date)
            : trialResult.request_date
              ? toLocalInputDateTime(trialResult.request_date)
              : toLocalInputDateTime(new Date().toISOString()),
          vitesse:
            trialResult.speed_kmh != null
              ? String(trialResult.speed_kmh)
              : DEFAULT_SPEED_VALUE,
          motif: trialResult.problem_description,
          exp: trialResult.maintenance_state,
          gravite: normalizeAccompanimentSeverity(trialResult.severity),
          conditions_acheminement: trialResult.transport_conditions_initial,
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Impossible de charger les donnees du formulaire")
      );
  }, [token, isEditMode, id]);

  const configFields = formConfig.fields ?? {};
  const required = (fieldKey: string) => Boolean(configFields[fieldKey]?.required);

  const modeOptions = [
    { value: "" as TransportMode, label: "Choisir" },
    { value: "US" as TransportMode, label: "US" },
    { value: "UM" as TransportMode, label: "UM" },
  ];

  const exploitantOptions = (configFields.etat_maintenance?.options?.length
    ? configFields.etat_maintenance.options
    : ["PFL", "PV"]
  ).map((value) => value as MaintenanceState);

  const accompanimentConfigOptions = (configFields.gravite?.options?.length
    ? configFields.gravite.options
    : ["NIVEAU_1", "NIVEAU_2"]
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

  const currentModeSpeedOptions = [
    { value: DEFAULT_SPEED_VALUE, label: "Normal" },
    ...vitesseConfigValues.map((item) => ({ value: item, label: item })),
  ].filter((item, index, array) => array.findIndex((other) => other.value === item.value) === index);

  useEffect(() => {
    if (!modeOptions.some((item) => item.value === form.mode_acheminement)) {
      setForm((prev) => ({ ...prev, mode_acheminement: "" }));
    }
  }, [form.mode_acheminement]);

  useEffect(() => {
    const availableSpeeds = currentModeSpeedOptions.map((item) => item.value);
    if (availableSpeeds.length > 0 && !availableSpeeds.includes(form.vitesse)) {
      setForm((prev) => ({ ...prev, vitesse: DEFAULT_SPEED_VALUE }));
    }
  }, [form.vitesse, currentModeSpeedOptions]);

  function updateMaterialEntry(idValue: number, changes: Partial<MaterialEntry>) {
    setMaterialEntries((prev) => prev.map((entry) => (entry.id === idValue ? { ...entry, ...changes } : entry)));
  }

  function addMaterialEntry() {
    const defaultSerie = serieConfigOptions[0] ?? "AUTRE";
    const defaultType = materialTypeOptions[0] ?? "MM";
    setMaterialEntries((prev) => [
      ...prev,
      { id: (prev[prev.length - 1]?.id ?? 0) + 1, type_materiel: defaultType, serie: defaultSerie, customSerie: "", materiel_concerne: "" },
    ]);
  }

  function removeMaterialEntry(idValue: number) {
    setMaterialEntries((prev) => (prev.length > 1 ? prev.filter((entry) => entry.id !== idValue) : prev));
  }

  return (
    <div className="panel mx-auto max-w-5xl p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          {isEditMode ? "Modifier la demande d'essai en ligne" : "Creer une demande d'essai en ligne"}
        </h2>
        {isEditMode ? (
          <p className="mt-2 text-sm text-slate-500">Vous pouvez ajuster la demande selon les retours du permanent.</p>
        ) : null}
      </div>
      <SecurityBanner />

      <form
        className="mt-8 space-y-8"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!token) {
            setError("Session expiree. Reconnectez-vous.");
            return;
          }
          if (isEditMode && !canEditCurrentTrial) {
            setError("Cette demande d'essai ne peut pas etre modifiee.");
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
          if (required("date_demande") && !form.date_depart) {
            setError("Veuillez renseigner la date de depart.");
            return;
          }
          if (!form.departure_station_id || !form.arrival_station_id) {
            setError("Veuillez renseigner le parcours (De / Vers).");
            return;
          }
          if (!form.parcours_aller && !form.parcours_retour) {
            setError("Veuillez cocher au moins un sens de parcours: aller ou retour.");
            return;
          }
          if (required("probleme") && !form.motif.trim()) {
            setError("Veuillez renseigner le motif de l'essai.");
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

          try {
            setSaving(true);
            setError("");
            const payloadData = {
              departure_station_id: form.departure_station_id,
              arrival_station_id: form.arrival_station_id,
              parcours_aller: form.parcours_aller,
              parcours_retour: form.parcours_retour,
              type_materiel: finalMaterialTypes.join(" + "),
              identifiant_materiel: finalSeries.join(" + "),
              materiel_concerne: finalConcernedMaterials.join(" + "),
              date_depart: form.date_depart ? new Date(form.date_depart).toISOString() : null,
              vitesse:
                form.vitesse
                  ? Number(form.vitesse)
                  : null,
              mode_acheminement: form.mode_acheminement,
              probleme: form.motif,
              etat_maintenance: form.exp,
              gravite: normalizeAccompanimentSeverity(form.gravite),
              conditions_acheminement: form.conditions_acheminement,
            };

            let trial: OnlineTrial;
            if (isEditMode && id) {
              trial = await api.updateOnlineTrial(token, Number(id), payloadData);
            } else {
              const payload = new FormData();
              payload.append("departure_station_id", String(payloadData.departure_station_id));
              payload.append("arrival_station_id", String(payloadData.arrival_station_id));
              payload.append("parcours_aller", String(payloadData.parcours_aller));
              payload.append("parcours_retour", String(payloadData.parcours_retour));
              payload.append("type_materiel", payloadData.type_materiel);
              payload.append("identifiant_materiel", payloadData.identifiant_materiel);
              payload.append("materiel_concerne", payloadData.materiel_concerne);
              if (payloadData.date_depart) payload.append("date_depart", payloadData.date_depart);
              if (payloadData.vitesse != null) payload.append("vitesse", String(payloadData.vitesse));
              payload.append("mode_acheminement", payloadData.mode_acheminement);
              payload.append("probleme", payloadData.probleme);
              payload.append("etat_maintenance", payloadData.etat_maintenance);
              payload.append("gravite", payloadData.gravite);
              payload.append("conditions_acheminement", payloadData.conditions_acheminement);
              trial = await api.createOnlineTrial(token, payload);
            }

            navigate(`${scope.base}/${trial.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
          } finally {
            setSaving(false);
          }
        }}
      >
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="space-y-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parcours</span>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.parcours_aller}
                  onChange={(e) =>
                    setForm((prev) => {
                      const nextAller = e.target.checked;
                      if (!nextAller && !prev.parcours_retour) {
                        return prev;
                      }
                      return { ...prev, parcours_aller: nextAller };
                    })
                  }
                />
                Aller
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.parcours_retour}
                  onChange={(e) =>
                    setForm((prev) => {
                      const nextRetour = e.target.checked;
                      if (!nextRetour && !prev.parcours_aller) {
                        return prev;
                      }
                      return { ...prev, parcours_retour: nextRetour };
                    })
                  }
                />
                Retour
              </label>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">De</span>
                <select
                  className="input bg-white"
                  value={form.departure_station_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, departure_station_id: Number(e.target.value) }))}
                >
                  {stations.map((station) => (
                    <option key={`departure-${station.id}`} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vers</span>
                <select
                  className="input bg-white"
                  value={form.arrival_station_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, arrival_station_id: Number(e.target.value) }))}
                >
                  {stations.map((station) => (
                    <option key={`arrival-${station.id}`} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date de depart prevu</span>
                <input
                  className="input bg-white"
                  type="datetime-local"
                  value={form.date_depart}
                  onChange={(e) => setForm((prev) => ({ ...prev, date_depart: e.target.value }))}
                  required={required("date_demande")}
                />
              </label>
            </div>
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
                          <option value="">Choisir</option>
                          {materielConcerneOptions.map((option) => (
                            <option key={`${entry.id}-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input bg-white"
                          type="text"
                          placeholder={`Materiel concerne ${index + 1}`}
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
              <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2.5">
                  <span className={conditionFieldLabelClassName}>Mode d'essai</span>
                  <select
                    className="input bg-white"
                    value={form.mode_acheminement}
                    onChange={(e) => {
                      const nextMode = e.target.value as TransportMode;
                      setForm((prev) => ({ ...prev, mode_acheminement: nextMode }));
                    }}
                  >
                    {modeOptions.map((option) => (
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
              placeholder="Decrire clairement l'objectif et le contexte de la demande d'essai"
              value={form.motif}
              onChange={(e) => setForm((prev) => ({ ...prev, motif: e.target.value }))}
              required={required("probleme")}
            />
          </label>

          <label className="block space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Autres conditions</span>
            <textarea
              className="input min-h-32 resize-y bg-slate-50/60"
              placeholder="Preciser les contraintes d'essai, securite, parcours et qualite attendue"
              value={form.conditions_acheminement}
              onChange={(e) => setForm((prev) => ({ ...prev, conditions_acheminement: e.target.value }))}
              required={required("conditions_acheminement")}
            />
          </label>
        </section>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate(`${scope.base}/history`)}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving || (isEditMode && !canEditCurrentTrial)}>
            {saving ? "Enregistrement..." : isEditMode ? "Mettre a jour" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

