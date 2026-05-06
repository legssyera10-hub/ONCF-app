import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Alert, Station } from "../types";

const MOROCCO_CENTER: [number, number] = [31.7917, -7.0926];
const MOROCCO_BOUNDS: [[number, number], [number, number]] = [
  [27.4, -13.5],
  [36.2, -0.8],
];

function playAlertTone() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.onended = () => {
    context.close().catch(() => undefined);
  };
}

export function PermanentMapPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [highlightedStationIds, setHighlightedStationIds] = useState<number[]>([]);
  const pendingNewAlertId = useRef<number | null>(null);

  async function load() {
    if (!token) return;
    const [stationsData, alertsData] = await Promise.all([api.stations(token), api.alerts(token)]);
    setStations(stationsData);
    setAlerts(alertsData);

    if (!selectedStationId && stationsData[0]) {
      setSelectedStationId(stationsData[0].id);
    }

    if (pendingNewAlertId.current) {
      const newAlert = alertsData.find((item) => item.id === pendingNewAlertId.current);
      if (newAlert) {
        setSelectedStationId(newAlert.station.id);
        setHighlightedStationIds((current) =>
          current.includes(newAlert.station.id) ? current : [...current, newAlert.station.id]
        );
        window.setTimeout(() => {
          setHighlightedStationIds((current) => current.filter((id) => id !== newAlert.station.id));
        }, 12000);
      }
      pendingNewAlertId.current = null;
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load, (payload) => {
    if (payload.type === "alert_created" && typeof payload.alert_id === "number") {
      pendingNewAlertId.current = payload.alert_id;
      playAlertTone();
    }
  });

  const stationSummaries = useMemo(() => {
    return stations
      .filter((station) => station.lat != null && station.lon != null)
      .map((station) => {
        const stationAlerts = alerts
          .filter((alert) => alert.station.id === station.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const activeAlerts = stationAlerts.filter((alert) => ["EN_COURS_DE_TRAITEMENT"].includes(alert.status));
        return {
          station,
          stationAlerts,
          activeAlerts,
          isHighlighted: highlightedStationIds.includes(station.id),
        };
      });
  }, [alerts, highlightedStationIds, stations]);

  const selectedSummary =
    stationSummaries.find((summary) => summary.station.id === selectedStationId) ??
    stationSummaries.find((summary) => summary.activeAlerts.length > 0) ??
    stationSummaries[0];

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Répartition des demandes d'acheminements sur la carte nationale</h2>
            <p className="mt-2 text-sm text-slate-500">La gare indiquée en rouge représente l'endroit où la demande d'acheminement a été créée.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>{stationSummaries.length} gare(s) geolocalisee(s)</p>
            <p>{stationSummaries.filter((item) => item.activeAlerts.length > 0).length} gare(s) actives</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200">
          <MapContainer
            center={MOROCCO_CENTER}
            zoom={6}
            minZoom={5}
            maxZoom={11}
            maxBounds={MOROCCO_BOUNDS}
            scrollWheelZoom
            className="h-[70vh] md:h-[80vh] xl:h-[86vh] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {stationSummaries.map((summary) => {
              const position: [number, number] = [summary.station.lat as number, summary.station.lon as number];
              const isSelected = summary.station.id === selectedSummary?.station.id;
              const isActive = summary.activeAlerts.length > 0;
              return (
                <div key={summary.station.id}>
                  {isSelected ? <CircleMarker center={position} radius={16} pathOptions={{ color: "#f97316", weight: 3, fillOpacity: 0 }} /> : null}
                  <CircleMarker
                    center={position}
                    radius={isActive ? 8 : 6}
                    pathOptions={{
                      color: isActive ? "#b91c1c" : "#0f172a",
                      weight: 2,
                      fillColor: isActive ? "#ef4444" : "#0369a1",
                      fillOpacity: 1,
                      className: isActive ? (summary.isHighlighted ? "map-leaflet-alert-strong" : "map-leaflet-alert") : "map-leaflet-station",
                    }}
                    eventHandlers={{
                      click: () => {
                        if (summary.activeAlerts[0]) {
                          navigate(`/permanent/dashboard/${summary.activeAlerts[0].id}`);
                          return;
                        }
                        setSelectedStationId(summary.station.id);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="text-sm">
                        <div className="font-semibold">{summary.station.name}</div>
                        <div>{summary.activeAlerts.length} demande(s) active(s)</div>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="space-y-1 text-sm">
                        <div className="font-semibold">{summary.station.name}</div>
                        <div>{summary.station.region}</div>
                        <div>{summary.activeAlerts.length} demande(s) active(s)</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </div>
              );
            })}
          </MapContainer>
        </div>
      </section>
    </div>
  );
}
