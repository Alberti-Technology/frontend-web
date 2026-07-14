export interface MicrographyMeasureCompletedEvent {
  type: "micrography_measure.completed";
  status: "completed" | string;
  muestra_id?: number | string;
  region_id?: number | string;
  micrografia_id?: number | string;
  measure_id?: number | string;
  is_valid?: boolean;
  mean_size?: number;
  standard_deviation?: number;
  distribution_quantiles?: number[];
  imagen?: string;
}

export const MICROGRAPHY_MEASURE_COMPLETED_EVENT =
  "micrography_measure_completed";

export interface ReportGenerationStatusEvent {
  type: "report_generation.status_update";
  report_id: number;
  status: "pending" | "processing" | "completed" | "error" | string;
  muestra_id?: number | null;
  error_message?: string | null;
  file_url?: string | null;
  report_name?: string | null;
}

export const REPORT_GENERATION_STATUS_EVENT = "report_generation_status";

import { API_BASE_URL } from "../config/apiConfig";

const wsBaseUrl = API_BASE_URL.replace(/^http/, "ws");
const NOTIFICATIONS_WS_URL = `${wsBaseUrl}ws/metalografia/notifications/`;

let socket: WebSocket | null = null;

function dispatchMeasureCompleted(payload: MicrographyMeasureCompletedEvent) {
  window.dispatchEvent(
    new CustomEvent(MICROGRAPHY_MEASURE_COMPLETED_EVENT, { detail: payload }),
  );
}

function dispatchReportStatus(payload: ReportGenerationStatusEvent) {
  window.dispatchEvent(
    new CustomEvent(REPORT_GENERATION_STATUS_EVENT, { detail: payload }),
  );
}

export function connectNotificationsWebSocket(token: string | null) {
  if (!token || typeof window === "undefined") return null;

  disconnectNotificationsWebSocket();

  const url = new URL(NOTIFICATIONS_WS_URL);
  url.searchParams.set("token", token);

  socket = new WebSocket(url.toString());

  socket.onopen = () => {
    console.log("[notifications websocket] conectado");
  };

  socket.onmessage = (event) => {
    let payload: unknown = event.data;
    try {
      payload = JSON.parse(event.data);
    } catch {
      console.log("[notifications websocket]", event.data);
      return;
    }

    console.log("[notifications websocket]", payload);

    if (payload && typeof payload === "object") {
      const type = (payload as { type?: string }).type;
      
      if (type === "micrography_measure.completed") {
        dispatchMeasureCompleted(payload as MicrographyMeasureCompletedEvent);
      } else if (type === "report_generation.status_update") {
        dispatchReportStatus(payload as ReportGenerationStatusEvent);
      }
    }
  };

  socket.onerror = () => {
    window.dispatchEvent(
      new CustomEvent("show_toast", {
        detail: {
          message: "No se pudo mantener la conexion de notificaciones.",
          type: "warning",
          duration: 7200,
        },
      }),
    );
  };

  socket.onclose = () => {
    socket = null;
  };

  return socket;
}

export function disconnectNotificationsWebSocket() {
  if (!socket) return;
  const current = socket;
  socket = null;
  current.onclose = null;
  current.onerror = null;
  current.onopen = null;
  current.onmessage = null;
  current.close();
}
