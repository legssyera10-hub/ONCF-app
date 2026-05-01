export type Role = "AGENT" | "PERMANENT" | "ETABLISSEMENT" | "ADMIN" | "SUIVI";
export type MaterialType = string;
export type TransportMode = string;
export type TransportType = string;
export type MaintenanceState = "OK" | "A_SURVEILLER" | "PFL" | "PV" | "A_REPARER" | "CRITIQUE";
export type Severity = "NIVEAU_1" | "NIVEAU_2" | "NIVEAU_3" | "NIVEAU_4" | "NIVEAU_5";
export type Decision = "CONFIRMER" | "ANNULER";
export type PermanentDecisionAction = "CONFIRMER" | "ANNULER" | "MODIFIER";
export type AlertStatus =
  | "EN_COURS_DE_TRAITEMENT"
  | "A_MODIFIER"
  | "MODIFIEE"
  | "TRAITEE_PAR_PM"
  | "ANNULEE"
  | "RECEPTION_PARTIELLE"
  | "RECEPTION_COMPLETE";

export interface User {
  id: number;
  username: string;
  role: Role;
  full_name: string;
  outlook_email?: string | null;
  establishment_id?: number | null;
  created_at: string;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  region: string;
  lat?: number | null;
  lon?: number | null;
}

export interface Establishment {
  id: number;
  code: string;
  name: string;
  city: string;
  outlook_email?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface MailEvent {
  id: number;
  event_type: string;
  subject: string;
  body: string;
  sender_email?: string | null;
  recipient_emails: string;
  delivery_status: string;
  error_message?: string | null;
  created_at: string;
  triggered_by?: User | null;
}

export interface AlertHistoryItem {
  id: number;
  status: AlertStatus;
  changed_at: string;
  note?: string | null;
  changed_by?: User | null;
}

export interface PermanentDecisionRecord {
  id: number;
  decision: Decision;
  comment?: string | null;
  material_decisions?: string | null;
  destination_establishment: Establishment;
  permanent_user: User;
  created_at: string;
}

export interface EstablishmentConfirmation {
  id: number;
  confirmed_at: string;
  reception_date: string;
  confirmed_material_indexes?: string | null;
  material_confirmations?: string | null;
  delay_minutes?: number | null;
  remarks?: string | null;
  establishment_user: User;
}

export interface AlertAttachment {
  id: number;
  filename: string;
  stored_path: string;
  content_type: string;
  uploaded_at: string;
}

export interface AlertRevision {
  id: number;
  revision_number: number;
  archived_at: string;
  station: Station;
  requested_destination_establishment?: Establishment | null;
  material_type: MaterialType;
  material_ref: string;
  material_concerned?: string | null;
  request_date?: string | null;
  speed_kmh?: number | null;
  transport_mode: TransportMode;
  transport_type: TransportType;
  problem_description: string;
  maintenance_state: MaintenanceState;
  severity: Severity;
  transport_conditions_initial: string;
  agent_decision: Decision;
  archived_by?: User | null;
}

export interface Alert {
  id: number;
  dossier_number?: number;
  dossier_parent_id?: number | null;
  dossier_iteration?: number;
  dossier_label?: string;
  created_at: string;
  updated_at?: string | null;
  material_type: MaterialType;
  material_ref: string;
  material_concerned?: string | null;
  request_date?: string | null;
  speed_kmh?: number | null;
  transport_mode: TransportMode;
  transport_type: TransportType;
  problem_description: string;
  maintenance_state: MaintenanceState;
  severity: Severity;
  transport_conditions_initial: string;
  agent_decision: Decision;
  status: AlertStatus;
  created_by: User;
  station: Station;
  requested_destination_establishment?: Establishment | null;
  history: AlertHistoryItem[];
  attachments: AlertAttachment[];
  mail_events: MailEvent[];
  revisions: AlertRevision[];
  permanent_decision?: PermanentDecisionRecord | null;
  establishment_confirmation?: EstablishmentConfirmation | null;
}

export interface Notification {
  id: number;
  sent_at: string;
  read_at?: string | null;
  establishment: Establishment;
  alert: Alert;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AdminUser extends User {}

export interface AdminUserActivity {
  timestamp: string;
  action: string;
  details: string;
  alert_id?: number | null;
}

export interface AdminUserDetail {
  user: AdminUser;
  history: AdminUserActivity[];
}

export interface AdminEstablishmentCreatePayload {
  name: string;
  city: string;
  code?: string | null;
  outlook_email?: string | null;
  lat: number;
  lon: number;
}

export interface AdminMailRoutingSettings {
  permanent_pv_email?: string | null;
  permanent_pfl_email?: string | null;
}

export interface AdminAlertFormFieldConfig {
  required: boolean;
  options: string[];
}

export interface AdminAlertFormConfig {
  fields: Record<string, AdminAlertFormFieldConfig>;
}

export interface AdminStationPayload {
  name: string;
  code?: string | null;
  region: string;
  lat: number;
  lon: number;
}
