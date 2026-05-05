import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { AdminAlertFormConfig, AdminStationPayload, Establishment, Station } from "../types";

type ConfigurableFieldKey =
  | "etablissement_dest_id"
  | "date_demande"
  | "type_materiel"
  | "serie"
  | "materiel_concerne"
  | "mode_acheminement"
  | "type_acheminement"
  | "etat_maintenance"
  | "gravite"
  | "vitesse"
  | "probleme"
  | "conditions_acheminement";

const configurableFieldLabels: Record<ConfigurableFieldKey, string> = {
  etablissement_dest_id: "Destinataire",
  date_demande: "Date de la demande",
  type_materiel: "Type de materiel",
  serie: "Serie",
  materiel_concerne: "Materiel concerne",
  mode_acheminement: "Mode d'acheminement",
  type_acheminement: "Type d'acheminement",
  etat_maintenance: "Exploitant (PV/PFL)",
  gravite: "Accompagnement",
  vitesse: "Vitesse (km/h)",
  probleme: "Motif",
  conditions_acheminement: "Autres conditions",
};

const configurableFieldKeys = Object.keys(configurableFieldLabels) as ConfigurableFieldKey[];
const fieldsWithoutOptions: ConfigurableFieldKey[] = [
  "date_demande",
  "probleme",
  "conditions_acheminement",
];

function accompanimentValueToLabel(value: string) {
  return value === "NIVEAU_1" ? "Sans" : "Avec";
}

function accompanimentLabelToValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "niveau_2" ||
    normalized === "avec" ||
    normalized === "accompagnee" ||
    normalized === "accompagne"
  ) {
    return "NIVEAU_2";
  }
  if (normalized === "niveau_1" || normalized === "sans") {
    return "NIVEAU_1";
  }
  return "NIVEAU_1";
}

function parseFieldOptions(fieldKey: ConfigurableFieldKey, rawValue: string) {
  const items = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (fieldKey === "gravite") {
    return items.map((item) => accompanimentLabelToValue(item));
  }

  if (fieldKey === "vitesse") {
    const numeric = items
      .filter((item) => /^\d+$/.test(item))
      .map((item) => String(Math.max(0, Math.min(500, Number(item)))));
    return Array.from(new Set(numeric));
  }

  return items;
}

function formatFieldOptionsForInput(fieldKey: ConfigurableFieldKey, options: string[]) {
  const displayOptions = fieldKey === "gravite" ? options.map(accompanimentValueToLabel) : options;
  return displayOptions.join(", ");
}

function buildOptionDrafts(config: AdminAlertFormConfig): Partial<Record<ConfigurableFieldKey, string>> {
  const drafts: Partial<Record<ConfigurableFieldKey, string>> = {};
  configurableFieldKeys.forEach((fieldKey) => {
    const field = config.fields[fieldKey] ?? { required: false, options: [] };
    drafts[fieldKey] = formatFieldOptionsForInput(fieldKey, field.options);
  });
  return drafts;
}

function StationMapPicker({
  lat,
  lon,
  onPick,
}: {
  lat: string;
  lon: string;
  onPick: (latValue: number, lonValue: number) => void;
}) {
  function ClickHandler() {
    useMapEvents({
      click(event) {
        onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
      },
    });
    return null;
  }

  function CenterOnMarker() {
    const map = useMapEvents({});
    const hasMarker = lat !== "" && lon !== "";
    const markerPosition = hasMarker ? ([Number(lat), Number(lon)] as [number, number]) : null;

    useEffect(() => {
      if (markerPosition) {
        map.setView(markerPosition, 11);
      } else {
        map.setView([31.7917, -7.0926], 5);
      }
    }, [map, markerPosition]);

    return null;
  }

  const hasMarker = lat !== "" && lon !== "";
  const markerPosition = hasMarker ? ([Number(lat), Number(lon)] as [number, number]) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={[31.7917, -7.0926]} zoom={5} className="h-64 w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler />
        <CenterOnMarker />
        {markerPosition ? <Marker position={markerPosition} /> : null}
      </MapContainer>
    </div>
  );
}

export function AdminRequestConfigPage() {
  const { token } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [stationForm, setStationForm] = useState({
    name: "",
    lat: "",
    lon: "",
  });
  const [alertFormConfig, setAlertFormConfig] = useState<AdminAlertFormConfig>({ fields: {} });
  const [optionDrafts, setOptionDrafts] = useState<Partial<Record<ConfigurableFieldKey, string>>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadConfig() {
    if (!token) return;
    const [stationList, formConfig, establishmentList] = await Promise.all([
      api.adminStations(token),
      api.adminAlertFormConfig(token),
      api.establishments(token),
    ]);
    setStations(stationList);
    setAlertFormConfig(formConfig);
    setOptionDrafts(buildOptionDrafts(formConfig));
    setEstablishments(establishmentList);
    if (stationList[0]) {
      setSelectedStationId((current) => current ?? stationList[0].id);
    } else {
      setSelectedStationId(null);
    }
  }

  useEffect(() => {
    loadConfig().catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement"));
  }, [token]);

  useEffect(() => {
    if (selectedStationId == null) {
      setStationForm({ name: "", lat: "", lon: "" });
      return;
    }
    const station = stations.find((item) => item.id === selectedStationId);
    if (!station) return;
    setStationForm({
      name: station.name,
      lat: station.lat != null ? String(station.lat) : "",
      lon: station.lon != null ? String(station.lon) : "",
    });
  }, [selectedStationId, stations]);

  async function saveStation(payload: AdminStationPayload) {
    if (!token) return;
    if (selectedStationId == null) {
      const created = await api.createAdminStation(token, payload);
      setSelectedStationId(created.station.id);
    } else {
      await api.updateAdminStation(token, selectedStationId, payload);
    }
    await loadConfig();
  }

  async function removeStation() {
    if (!token || selectedStationId == null) return;
    await api.deleteAdminStation(token, selectedStationId);
    await loadConfig();
  }

  async function saveFormConfig(nextConfig: AdminAlertFormConfig) {
    if (!token) return;
    const saved = await api.updateAdminAlertFormConfig(token, nextConfig);
    setAlertFormConfig(saved);
    setOptionDrafts(buildOptionDrafts(saved));
  }

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-950">Sites - Carte Maroc PPM</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSelectedStationId(null);
                  setStationForm({ name: "", lat: "", lon: "" });
                }}
              >
                Nouveau site
              </button>
              <button
                type="button"
                className="btn bg-rose-600 text-white hover:bg-rose-700"
                disabled={selectedStationId == null}
                onClick={async () => {
                  if (selectedStationId == null) return;
                  try {
                    setError("");
                    setMessage("");
                    await removeStation();
                    setSelectedStationId(null);
                    setMessage("Site supprime");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur suppression site");
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Le champ Site du formulaire de demande utilise directement cette liste.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <select
              className="input"
              value={selectedStationId ?? ""}
              onChange={(event) => setSelectedStationId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Choisir un site</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Nom du site"
              value={stationForm.name}
              onChange={(event) => setStationForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="mt-4">
            <StationMapPicker
              lat={stationForm.lat}
              lon={stationForm.lon}
              onPick={(latValue, lonValue) =>
                setStationForm((prev) => ({ ...prev, lat: String(latValue), lon: String(lonValue) }))
              }
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="input"
              placeholder="Latitude"
              value={stationForm.lat}
              onChange={(event) => setStationForm((prev) => ({ ...prev, lat: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Longitude"
              value={stationForm.lon}
              onChange={(event) => setStationForm((prev) => ({ ...prev, lon: event.target.value }))}
            />
          </div>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={async () => {
              try {
                setError("");
                setMessage("");
                const lat = Number(stationForm.lat);
                const lon = Number(stationForm.lon);
                if (!stationForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lon)) {
                  throw new Error("Renseignez le nom et la localisation du site");
                }
                await saveStation({
                  name: stationForm.name.trim(),
                  code: null,
                  region: "Maroc",
                  lat,
                  lon,
                });
                setMessage(selectedStationId == null ? "Site ajoute" : "Site mis a jour");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur enregistrement site");
              }
            }}
          >
            {selectedStationId == null ? "Ajouter le site" : "Enregistrer le site"}
          </button>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-slate-950">Configuration du formulaire de demande</h3>
          <div className="mt-5 space-y-3">
            {configurableFieldKeys.map((fieldKey) => {
              const field = alertFormConfig.fields[fieldKey] ?? { required: false, options: [] };
              const destinationNames = establishments.map((item) => item.name).join(", ");
              const isNoOptionsField = fieldsWithoutOptions.includes(fieldKey);
              const draftValue = optionDrafts[fieldKey] ?? formatFieldOptionsForInput(fieldKey, field.options);
              return (
                <div key={fieldKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{configurableFieldLabels[fieldKey]}</p>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          setAlertFormConfig((prev) => ({
                            fields: {
                              ...prev.fields,
                              [fieldKey]: { ...field, required: event.target.checked },
                            },
                          }))
                        }
                      />
                      Obligatoire
                    </label>
                  </div>
                  {fieldKey === "etablissement_dest_id" ? (
                    <>
                      <input className="input mt-2 bg-slate-100" value={destinationNames} readOnly />
                      <p className="mt-2 text-xs text-slate-500">
                        {establishments.length} technicentre(s) synchronise(s) automatiquement.
                      </p>
                    </>
                  ) : isNoOptionsField ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {fieldKey === "date_demande"
                        ? "Champ date/heure."
                        : "Champ texte libre."}
                    </p>
                  ) : (
                    <input
                      className="input mt-2"
                      placeholder="Choix separes par une virgule"
                      value={draftValue}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        setOptionDrafts((prev) => ({ ...prev, [fieldKey]: rawValue }));
                        setAlertFormConfig((prev) => ({
                          fields: {
                            ...prev.fields,
                            [fieldKey]: {
                              ...field,
                              options: parseFieldOptions(fieldKey, rawValue),
                            },
                          },
                        }));
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={async () => {
              try {
                setError("");
                setMessage("");
                await saveFormConfig(alertFormConfig);
                setMessage("Configuration du formulaire enregistree");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur configuration formulaire");
              }
            }}
          >
            Enregistrer la configuration
          </button>
        </div>
      </div>
    </div>
  );
}

