import type {
  AdminAlertFormConfig,
  AdminEstablishmentCreatePayload,
  AdminMailRoutingSettings,
  AdminStationPayload,
  AdminUser,
  AdminUserDetail,
  Alert,
  AuthResponse,
  Establishment,
  Notification,
  Station,
  User,
} from "../types";
import { API_BASE_URL } from "../utils/api";

const API_URL = API_BASE_URL;

type RequestOptions = RequestInit & { token?: string | null };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Impossible de joindre le backend sur ${API_URL}`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("oncf_token");
      localStorage.removeItem("oncf_user");
      throw new Error("Session expirée. Reconnectez-vous.");
    }
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : body.detail && typeof body.detail === "object"
          ? JSON.stringify(body.detail)
          : "Erreur serveur";
    throw new Error(detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Impossible de joindre le backend sur ${API_URL}`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : "Erreur serveur";
    throw new Error(detail);
  }

  return response.blob();
}

export const api = {
  apiUrl: API_URL,
  login: (username: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: (token: string) => request<User>("/me", { token }),
  stations: (token: string) => request<Station[]>("/stations", { token }),
  alertFormConfig: (token: string) => request<AdminAlertFormConfig>("/alert-form-config", { token }),
  establishments: (token: string) => request<Establishment[]>("/establishments", { token }),
  alerts: (token: string, query = "") => request<Alert[]>(`/alerts${query}`, { token }),
  alertById: (token: string, id: number) => request<Alert>(`/alerts/${id}`, { token }),
  createAlert: (token: string, payload: unknown) =>
    request<Alert>("/alerts", { method: "POST", body: payload as FormData, token }),
  updateAlert: (token: string, id: number, payload: unknown) =>
    request<Alert>(`/alerts/${id}`, { method: "PUT", body: JSON.stringify(payload), token }),
  updateStatus: (token: string, id: number, payload: unknown) =>
    request<Alert>(`/alerts/${id}/status`, { method: "POST", body: JSON.stringify(payload), token }),
  createDecision: (token: string, id: number, payload: unknown) =>
    request<Alert>(`/alerts/${id}/decision`, { method: "POST", body: JSON.stringify(payload), token }),
  notifications: (token: string) => request<Notification[]>("/notifications", { token }),
  confirmReception: (token: string, id: number, payload: unknown) =>
    request<Alert>(`/alerts/${id}/confirm`, { method: "POST", body: JSON.stringify(payload), token }),
  adminUsers: (token: string) => request<AdminUser[]>("/admin/users", { token }),
  adminUserDetail: (token: string, id: number) => request<AdminUserDetail>(`/admin/users/${id}`, { token }),
  createAdminUser: (token: string, payload: unknown) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(payload), token }),
  updateAdminUser: (token: string, id: number, payload: unknown) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(payload), token }),
  updateAdminPassword: (token: string, id: number, payload: unknown) =>
    request<void>(`/admin/users/${id}/password`, { method: "PUT", body: JSON.stringify(payload), token }),
  deleteAdminUser: (token: string, id: number) =>
    request<void>(`/admin/users/${id}`, { method: "DELETE", token }),
  deleteAdminAlert: (token: string, id: number) =>
    request<void>(`/admin/alerts/${id}`, { method: "DELETE", token }),
  exportAdminUser: (token: string, id: number, query: string) =>
    requestBlob(`/admin/users/${id}/export${query}`, { token }),
  createAdminEstablishment: (token: string, payload: AdminEstablishmentCreatePayload) =>
    request<{ establishment: Establishment }>("/admin/establishments", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    }),
  updateAdminEstablishment: (token: string, id: number, payload: AdminEstablishmentCreatePayload) =>
    request<{ establishment: Establishment }>(`/admin/establishments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      token,
    }),
  adminMailRouting: (token: string) => request<AdminMailRoutingSettings>("/admin/mail-routing", { token }),
  updateAdminMailRouting: (token: string, payload: AdminMailRoutingSettings) =>
    request<AdminMailRoutingSettings>("/admin/mail-routing", {
      method: "PUT",
      body: JSON.stringify(payload),
      token,
    }),
  testAdminMailRouting: (token: string, payload: AdminMailRoutingSettings) =>
    request<{ message: string }>("/admin/mail-routing/test", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    }),
  adminAlertFormConfig: (token: string) =>
    request<AdminAlertFormConfig>("/admin/alert-form-config", { token }),
  updateAdminAlertFormConfig: (token: string, payload: AdminAlertFormConfig) =>
    request<AdminAlertFormConfig>("/admin/alert-form-config", {
      method: "PUT",
      body: JSON.stringify(payload),
      token,
    }),
  adminStations: (token: string) => request<Station[]>("/admin/stations", { token }),
  createAdminStation: (token: string, payload: AdminStationPayload) =>
    request<{ station: Station }>("/admin/stations", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    }),
  updateAdminStation: (token: string, id: number, payload: AdminStationPayload) =>
    request<{ station: Station }>(`/admin/stations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      token,
    }),
  deleteAdminStation: (token: string, id: number) =>
    request<{ message: string }>(`/admin/stations/${id}`, { method: "DELETE", token }),
};
