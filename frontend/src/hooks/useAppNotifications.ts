import { useContext } from "react";
import { AppNotificationsContext } from "../contexts/AppNotificationsContext";

export function useAppNotifications() {
  return useContext(AppNotificationsContext);
}
