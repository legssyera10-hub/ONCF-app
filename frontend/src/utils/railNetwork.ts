import type { Station } from "../types";

export type GeoPoint = {
  name: string;
  lat: number;
  lon: number;
};

type Graph = Map<string, Set<string>>;

const VIRTUAL_POINTS: Record<string, GeoPoint> = {
  "Beni Oukil": { name: "Beni Oukil", lat: 34.6289, lon: -2.05257 },
  Guercif: { name: "Guercif", lat: 34.22568, lon: -3.35361 },
  "Oued Amlil": { name: "Oued Amlil", lat: 34.215, lon: -4.28 },
  Matmata: { name: "Matmata", lat: 34.19, lon: -4.14 },
  "Sebaa Aioun": { name: "Sebaa Aioun", lat: 33.918, lon: -5.371 },
  "Ain Taoujdate": { name: "Ain Taoujdate", lat: 33.9333, lon: -5.2167 },
  Meknes: { name: "Meknes", lat: 33.8935, lon: -5.5473 },
  "Meknes Al Amir": { name: "Meknes Al Amir", lat: 33.9015, lon: -5.565 },
  "Sale Tabriquet": { name: "Sale Tabriquet", lat: 34.047, lon: -6.79 },
  "Sale Ville": { name: "Sale Ville", lat: 34.037, lon: -6.799 },
};

const NETWORK_EDGES: Array<[string, string]> = [
  ["Tanger Med", "Ksar Sghir"],
  ["Ksar Sghir", "Tanger Ville"],
  ["Tanger Ville", "Asilah"],
  ["Asilah", "Kenitra"],
  ["Kenitra", "Sidi Yahya El Gharb"],
  ["Sidi Yahya El Gharb", "Sidi Slimane"],
  ["Sidi Slimane", "Sidi Kacem"],
  ["Sidi Kacem", "Meknes Al Amir"],
  ["Meknes Al Amir", "Meknes"],
  ["Meknes", "Sebaa Aioun"],
  ["Sebaa Aioun", "Ain Taoujdate"],
  ["Ain Taoujdate", "Fes"],
  ["Fes", "Oued Amlil"],
  ["Oued Amlil", "Matmata"],
  ["Matmata", "Taza"],
  ["Guercif", "Taourirt"],
  ["Taza", "Guercif"],
  ["Taourirt", "Beni Oukil"],
  ["Beni Oukil", "Oujda"],
  ["Oujda", "Selouane"],
  ["Selouane", "Nador Ville"],
  ["Nador Ville", "Beni Nsar"],
  ["Kenitra", "Sidi Taibi"],
  ["Sidi Taibi", "Rabat Agdal"],
  ["Rabat Agdal", "Rabat Ville"],
  ["Rabat Ville", "Sale Ville"],
  ["Sale Ville", "Sale Tabriquet"],
  ["Sale Tabriquet", "Rabat Agdal"],
  ["Rabat Ville", "Temara"],
  ["Temara", "Skhirat"],
  ["Skhirat", "Bouznika"],
  ["Bouznika", "Mohammedia"],
  ["Mohammedia", "Zenata"],
  ["Zenata", "Ain Sebaa"],
  ["Ain Sebaa", "Casa Voyageurs"],
  ["Casa Voyageurs", "Casa Port"],
  ["Casa Voyageurs", "Mers Sultan"],
  ["Mers Sultan", "L'Oasis"],
  ["L'Oasis", "Facultes"],
  ["Facultes", "Ennassim"],
  ["Ennassim", "Bouskoura"],
  ["Bouskoura", "Aeroport Mohammed V"],
  ["L'Oasis", "Berrechid"],
  ["Berrechid", "Settat"],
  ["Settat", "Benguerir"],
  ["Benguerir", "Marrakech"],
  ["Berrechid", "Khouribga"],
  ["Khouribga", "Oued Zem"],
  ["Oued Zem", "Beni Mellal"],
];

const DESTINATION_CITY_ALIASES: Record<string, string[]> = {
  casablanca: ["Casa Voyageurs", "Casa Port", "Ain Sebaa", "L'Oasis"],
  "atelier casa maintenance": ["Casa Voyageurs"],
  "atelier casa": ["Casa Voyageurs"],
  "atelier casa maintenance casablanca": ["Casa Voyageurs"],
  "responsable etablissement casablanca": ["Casa Voyageurs"],
  rabat: ["Rabat Ville", "Rabat Agdal"],
  fes: ["Fes"],
  oujda: ["Oujda"],
  marrakech: ["Marrakech"],
  kenitra: ["Kenitra"],
  khouribga: ["Khouribga"],
  taza: ["Taza"],
  tanger: ["Tanger Ville"],
  nador: ["Nador Ville"],
  "beni mellal": ["Beni Mellal"],
  mohammedia: ["Mohammedia"],
  settat: ["Settat"],
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distance(a: GeoPoint, b: GeoPoint) {
  const dx = a.lat - b.lat;
  const dy = a.lon - b.lon;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildGraph(): Graph {
  const graph: Graph = new Map();

  for (const [a, b] of NETWORK_EDGES) {
    if (!graph.has(a)) {
      graph.set(a, new Set());
    }
    if (!graph.has(b)) {
      graph.set(b, new Set());
    }
    graph.get(a)?.add(b);
    graph.get(b)?.add(a);
  }

  return graph;
}

function getStationMap(stations: Station[]) {
  const map = new Map<string, GeoPoint>(Object.entries(VIRTUAL_POINTS));

  for (const station of stations) {
    if (station.lat == null || station.lon == null) {
      continue;
    }
    map.set(station.name, {
      name: station.name,
      lat: station.lat,
      lon: station.lon,
    });
  }

  return map;
}

function findShortestPath(start: string, end: string, graph: Graph) {
  const queue: string[] = [start];
  const visited = new Set([start]);
  const previous = new Map<string, string | null>([[start, null]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === end) {
      break;
    }

    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      previous.set(neighbor, current);
      queue.push(neighbor);
    }
  }

  if (!previous.has(end)) {
    return null;
  }

  const path: string[] = [];
  let cursor: string | null = end;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
  }

  return path;
}

export function resolveDestinationStationName(city: string, stations: Station[]) {
  const normalizedCity = normalizeText(city);
  const aliasCandidates = DESTINATION_CITY_ALIASES[normalizedCity] ?? [];

  for (const candidate of aliasCandidates) {
    if (stations.some((station) => station.name === candidate && station.lat != null && station.lon != null)) {
      return candidate;
    }
  }

  const direct = stations.find((station) => normalizeText(station.name).includes(normalizedCity));
  if (direct?.name) {
    return direct.name;
  }

  const virtualDirect = Object.values(VIRTUAL_POINTS).find((point) => normalizeText(point.name).includes(normalizedCity));
  return virtualDirect?.name ?? null;
}

export function resolveRailDestinationName(
  establishment: { name: string; city: string } | null | undefined,
  stations: Station[]
) {
  if (!establishment) {
    return null;
  }

  const byName = resolveDestinationStationName(establishment.name, stations);
  if (byName) {
    return byName;
  }

  return resolveDestinationStationName(establishment.city, stations);
}

export function buildRailRoutePoints(originStationName: string, destinationStationName: string, stations: Station[]) {
  const stationMap = getStationMap(stations);
  const graph = buildGraph();
  const pathNames = findShortestPath(originStationName, destinationStationName, graph);

  if (!pathNames) {
    const origin = stationMap.get(originStationName);
    const destination = stationMap.get(destinationStationName);
    return origin && destination ? [origin, destination] : [];
  }

  return pathNames
    .map((name) => stationMap.get(name))
    .filter((point): point is GeoPoint => Boolean(point));
}

export function getProgressPointOnRailPath(points: GeoPoint[], progress: number) {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return { ...points[0], angle: 0 };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point));
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (totalLength <= 0) {
    return { ...points[0], angle: 0 };
  }

  const targetLength = totalLength * clamped;
  let traversed = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (traversed + segmentLength >= targetLength) {
      const localProgress = segmentLength === 0 ? 0 : (targetLength - traversed) / segmentLength;
      const start = points[index];
      const end = points[index + 1];
      const lat = start.lat + (end.lat - start.lat) * localProgress;
      const lon = start.lon + (end.lon - start.lon) * localProgress;
      const angle = (Math.atan2(end.lat - start.lat, end.lon - start.lon) * 180) / Math.PI;
      return { name: end.name, lat, lon, angle };
    }
    traversed += segmentLength;
  }

  const beforeLast = points[points.length - 2];
  const last = points[points.length - 1];
  return {
    ...last,
    angle: (Math.atan2(last.lat - beforeLast.lat, last.lon - beforeLast.lon) * 180) / Math.PI,
  };
}
