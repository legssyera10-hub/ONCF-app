import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import App from "./App";
import { AppNotificationsProvider } from "./contexts/AppNotificationsContext";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppNotificationsProvider>
          <App />
        </AppNotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
