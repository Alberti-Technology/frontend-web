import { API_BASE_URL, API_WAKEUP_RETRY_MS } from "../config/apiConfig";

export const BASE_URL = API_BASE_URL;
export const HF_BASE_URL = "https://dlalberti.duckdns.org:7860";
const HF_MASK_ENDPOINT = "https://dlalberti.duckdns.org:7860/segment/45951/rgb/";

type ApiRequestError = Error & {
  status?: number;
  data?: any;
};

interface RecoveryState {
  isRecovering: boolean;
  attempts: number;
}

type RecoveryListener = (state: RecoveryState) => void;

type DeferredRequest = {
  path: string;
  init?: RequestInit;
  resolve: (response: Response) => void;
  reject: (reason?: unknown) => void;
};

type ManualOverlayState = {
  id: number;
  message: string;
  detail?: string;
};

export interface ApiMaterial {
  id: number | string;
  nombre: string;
  code?: string;
  has_model?: boolean;
}

export interface HfMaskLabelInfo {
  name: string;
  color: [number, number, number];
}

export type HfMaskLabels = Record<string, HfMaskLabelInfo>;

export interface HfMaskResult {
  url: string;
  labels?: HfMaskLabels;
}

const overlayId = "api-wakeup-overlay";

export const ACERO_LABELS: HfMaskLabels = {
  "0": { name: "Cementita", color: [255, 0, 0] },
  "1": { name: "Borde de grano", color: [0, 255, 0] },
  "2": { name: "Ferrita", color: [0, 0, 255] },
  "3": { name: "Raya", color: [255, 255, 255] }
};

export function pingSpaces() {
  const spaces = [
    "https://albertitechnology-agent-api.hf.space",
    HF_BASE_URL,
    "https://albertitechnology-report-api.hf.space"
  ];
  spaces.forEach((space) => {
    fetch(space + "/", { method: "GET" }).catch(() => {});
  });
}

let isRecovering = false;
let recoveryAttempts = 0;
const recoveryQueue: DeferredRequest[] = [];
const recoveryListeners = new Set<RecoveryListener>();
let recoveryBarrier: Promise<void> | null = null;
let releaseRecoveryBarrier: (() => void) | null = null;
let manualOverlayState: ManualOverlayState | null = null;
let manualOverlayCounter = 0;

function currentRecoveryState(): RecoveryState {
  return {
    isRecovering,
    attempts: recoveryAttempts,
  };
}

function waitForRecoveryToFinish() {
  return recoveryBarrier || Promise.resolve();
}

function ensureWakeupOverlayRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(overlayId);
  if (!root) {
    root = document.createElement("div");
    root.id = overlayId;
    document.body.appendChild(root);
  }
  return root;
}

function renderWakeupOverlay(state: RecoveryState) {
  if (typeof document === "undefined") return;
  const root = ensureWakeupOverlayRoot();
  if (!root) return;

  if (!state.isRecovering && !manualOverlayState) {
    root.innerHTML = "";
    return;
  }

  const title = manualOverlayState
    ? manualOverlayState.message
    : "Conectando con el servidor...";

  root.innerHTML = `
    <div style="position: fixed; inset: 0; z-index: 13000; background: rgba(16,36,63,0.34); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:14px; width:min(92vw,560px); font-family: var(--font-body, 'Segoe UI', system-ui, sans-serif);">
        <div style="position:relative; width:148px; height:148px;">
          <div style="position:absolute; inset:0; border-radius:50%; border:11px solid rgba(130,201,255,0.38);"></div>
          <div style="position:absolute; inset:0; border-radius:50%; border:11px solid transparent; border-top-color:#339eea; border-right-color:#82c9ff; animation: api-wakeup-spin 1s linear infinite;"></div>
        </div>
        <div style="text-align:center; color:#eef7ff; text-shadow: 0 3px 12px rgba(16,36,63,0.42); font-family: var(--font-display, var(--font-body, 'Segoe UI', system-ui, sans-serif)); font-size:clamp(24px,3.2vw,50px); font-weight:700; letter-spacing:0.01em; line-height:1.14;">
          ${title}
        </div>
      </div>
    </div>
    <style>
      @keyframes api-wakeup-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

export function showGlobalLoader(message: string, detail?: string) {
  const id = ++manualOverlayCounter;
  manualOverlayState = { id, message, detail };
  renderWakeupOverlay(currentRecoveryState());
  return id;
}

export function hideGlobalLoader(id: number) {
  if (!manualOverlayState || manualOverlayState.id !== id) return;
  manualOverlayState = null;
  renderWakeupOverlay(currentRecoveryState());
}

function emitRecoveryState() {
  const snapshot = currentRecoveryState();
  renderWakeupOverlay(snapshot);
  recoveryListeners.forEach((listener) => listener(snapshot));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneRequestInit(init?: RequestInit): RequestInit | undefined {
  if (!init) return undefined;
  return {
    ...init,
    headers: init.headers ? new Headers(init.headers) : undefined,
  };
}

function requestUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE_URL}${cleanPath}`;
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { detail: text } : null;
  } catch {
    return null;
  }
}

function buildApiError(
  response: Response,
  payload: any,
  fallbackMessage: string,
): ApiRequestError {
  const message =
    payload?.error ||
    payload?.detalle ||
    payload?.detail ||
    (Array.isArray(payload?.non_field_errors)
      ? payload.non_field_errors[0]
      : undefined) ||
    fallbackMessage;

  const error = new Error(message) as ApiRequestError;
  error.status = response.status;
  error.data = payload;
  return error;
}

function shouldTreatAsSleepingServer(response: Response) {
  const maybeSleepingStatus =
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504 ||
    response.status >= 500;

  if (!maybeSleepingStatus) return false;
  const contentType = response.headers.get("content-type") || "";
  return !contentType.includes("application/json");
}

async function runRecoveryLoop() {
  if (isRecovering) return;
  isRecovering = true;
  recoveryBarrier = new Promise<void>((resolve) => {
    releaseRecoveryBarrier = resolve;
  });
  recoveryAttempts = 0;
  emitRecoveryState();

  while (recoveryQueue.length > 0) {
    const pending = recoveryQueue[0];
    recoveryAttempts += 1;
    emitRecoveryState();

    try {
      const url = requestUrl(pending.path);
      const response = await fetch(url, pending.init);
      if (shouldTreatAsSleepingServer(response)) {
        await wait(API_WAKEUP_RETRY_MS);
        continue;
      }

      recoveryQueue.shift();
      pending.resolve(response);
      emitRecoveryState();
    } catch {
      await wait(API_WAKEUP_RETRY_MS);
    }
  }

  isRecovering = false;
  recoveryAttempts = 0;
  releaseRecoveryBarrier?.();
  releaseRecoveryBarrier = null;
  recoveryBarrier = null;
  emitRecoveryState();
}

function enqueueDeferredRequest(path: string, init?: RequestInit) {
  return new Promise<Response>((resolve, reject) => {
    recoveryQueue.push({
      path,
      init: cloneRequestInit(init),
      resolve,
      reject,
    });
    emitRecoveryState();
    void runRecoveryLoop();
  });
}

async function apiFetch(path: string, init?: RequestInit) {
  if (isRecovering) await waitForRecoveryToFinish();

  const safeInit = cloneRequestInit(init) || {};

  try {
    const url = requestUrl(path);
    const response = await fetch(url, safeInit);
    if (shouldTreatAsSleepingServer(response)) {
      return enqueueDeferredRequest(path, safeInit);
    }
    return response;
  } catch {
    return enqueueDeferredRequest(path, safeInit);
  }
}

export function subscribeApiRecovery(listener: RecoveryListener) {
  recoveryListeners.add(listener);
  listener(currentRecoveryState());
  return () => {
    recoveryListeners.delete(listener);
  };
}

// ====================== AUTH ======================

function getHeaders(isFormData = false) {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  
  // Header requerido por Ngrok gratuito para no devolver su página HTML de advertencia (que detona fallos de CORS)
  headers["ngrok-skip-browser-warning"] = "true";
  
  return headers;
}

export async function login(user: string, pass: string): Promise<string> {
  try {
    const res = await apiFetch("member/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });

    if (res.ok) {
      const data = await res.json();
      const token = data.access || data.token;
      if (token) {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", data.refresh || "");
        localStorage.setItem("user_id", data.user_id?.toString() || "");
        localStorage.setItem("username", data.username || user);
        localStorage.setItem("company_enabled", data.company_enabled ? "true" : "false");
        pingSpaces();
        return token;
      }
    }

    // Manejar errores específicos del servidor
    if (res.status === 423) {
      document.body.innerHTML = '<div style="background:#b42318;color:white;font-family:sans-serif;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;"><div><h1 style="font-size:3rem;margin-bottom:1rem">ACCESO BLOQUEADO</h1><p style="font-size:1.2rem">Se ha detectado un intento de inicio de sesión sospechoso o desde otro dispositivo no autorizado.<br/><br/>Por razones de seguridad, esta aplicación ha sido bloqueada. Contactá al administrador.</p></div></div>';
      return "";
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Tu cuenta ha sido desactivada");
    }

    throw new Error("Credenciales inválidas");
  } catch (err) {
    console.error("Error en login:", err);
    throw err;
  }
}

export function logout() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (refreshToken) {
    apiFetch("member/logout/", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ refresh: refreshToken }),
    }).catch(() => {});
  }

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token");        // limpieza legacy
  localStorage.removeItem("user_id");
  localStorage.removeItem("username");
  localStorage.removeItem("metalurgia_user");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth_logout"));
  }
}

/**
 * Wrapper de apiFetch que cierra sesión si recibe un 401.
 */
async function apiFetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(path, init);

  if (res.status === 401) {
    logout();
  }

  return res;
}

// -------------------------------------------------------------
// GET GET GET
// -------------------------------------------------------------
export async function getMuestras() {
  const res = await apiFetchWithAuth("metalografia/muestras/", {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error fetching muestras");
  return res.json();
}

export async function getRegiones() {
  const res = await apiFetchWithAuth("metalografia/regiones/", {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error fetching regiones");
  return res.json();
}

export async function getMicrografias() {
  const res = await apiFetchWithAuth("metalografia/micrografias/", {
    headers: getHeaders(),
  });
  // if (!res.ok) throw new Error("Error fetching micrografias");
  // return res.json();
  if (res.ok) {
    return res.json();
  }
  return [];
}

export async function getMateriales(): Promise<ApiMaterial[]> {
  const res = await apiFetchWithAuth("metalografia/material/", {
    headers: getHeaders(),
  });

  if (!res.ok) throw new Error("Error fetching materiales");

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.materials)) return data.materials;
  return [];
}

// -------------------------------------------------------------
// POST / PATCH / DELETE
// -------------------------------------------------------------

// MUESTRAS
export async function createMaterial(formData: FormData) {
  const res = await apiFetchWithAuth("metalografia/material/", {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) throw new Error("Error creando material");
  return res.json();
}

export async function createMuestra(formData: FormData) {
  const res = await apiFetchWithAuth("metalografia/muestras/", {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) throw new Error("Error creando muestra");
  return res.json();
}

export async function updateMuestra(id: string | number, formData: FormData) {
  const res = await apiFetchWithAuth(`metalografia/muestras/${id}/`, {
    method: "PATCH",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) throw new Error("Error actualizando muestra");
  return res.json();
}

export async function deleteMuestra(id: string | number) {
  const res = await apiFetchWithAuth(`metalografia/muestras/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error eliminando muestra");
}

// REGIONES
export async function createRegion(formData: FormData) {
  const res = await apiFetchWithAuth("metalografia/regiones/", {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) throw new Error("Error creando región");
  return res.json();
}

export async function updateRegion(id: string | number, formData: FormData) {
  const res = await apiFetchWithAuth(`metalografia/regiones/${id}/`, {
    method: "PATCH",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) throw new Error("Error actualizando región");
  return res.json();
}

export async function deleteRegion(id: string | number) {
  const res = await apiFetchWithAuth(`metalografia/regiones/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error eliminando región");
}

// MICROGRAFIAS
export async function createMicrografia(formData: FormData) {
  const res = await apiFetchWithAuth("metalografia/micrografias/", {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw buildApiError(res, payload, "Error creando micrografía");
  }
  return res.json();
}

export async function updateMicrografia(
  id: string | number,
  formData: FormData,
) {
  const res = await apiFetchWithAuth(`metalografia/micrografias/${id}/`, {
    method: "PATCH",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw buildApiError(res, payload, "Error actualizando micrografía");
  }
  return res.json();
}

export async function deleteMicrografia(id: string | number) {
  const res = await apiFetchWithAuth(`metalografia/micrografias/${id}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error eliminando micrografía");
}

export async function getMask(micrografiaId: string | number): Promise<{ mask_type: string; mask_url: string; labels?: HfMaskLabels } | null> {
  const res = await apiFetchWithAuth(`metalografia/mask/${micrografiaId}/`, {
    headers: getHeaders(),
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw buildApiError(res, payload, "Error obteniendo máscara");
  }

  const data = await res.json();
  return data?.mask_url ? data : null;
}

export async function saveMask(micrografiaId: string | number, maskDataUrl: string, labels?: HfMaskLabels) {
  // Convertir data URL a Blob para enviar como multipart/form-data
  const blobResponse = await fetch(maskDataUrl);
  const blob = await blobResponse.blob();

  const formData = new FormData();
  formData.append("image", blob, "mask.png");
  if (labels) {
    formData.append("labels", JSON.stringify(labels));
  }

  const res = await apiFetchWithAuth(`metalografia/predict/${micrografiaId}/`, {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });

  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw buildApiError(res, payload, "Error guardando máscara");
  }

  const data = await res.json();
  return data?.image_url || null;
}

function normalizeRgbTuple(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const rgb = value.slice(0, 3).map((channel) => Number(channel));
  if (!rgb.every((channel) => Number.isFinite(channel))) return null;
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0]))),
    Math.max(0, Math.min(255, Math.round(rgb[1]))),
    Math.max(0, Math.min(255, Math.round(rgb[2]))),
  ];
}

function parseHfMaskLabels(payload: any): HfMaskLabels | undefined {
  const labels = payload?.labels;
  if (!labels || typeof labels !== "object") return undefined;

  const parsed: HfMaskLabels = {};
  Object.entries(labels).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const maybeName = (value as any).name;
    const name =
      typeof maybeName === "string" && maybeName.trim()
        ? maybeName.trim()
        : `Clase ${key}`;
    const color = normalizeRgbTuple((value as any).color) || [127, 127, 127];
    parsed[key] = { name, color };
  });

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

/**
 * Letterbox (pad) an image to a square canvas of the given size while
 * preserving the original aspect ratio. Returns the padded blob AND the
 * region inside the square that contains the actual image content so we
 * can later crop the model's output mask back to the original proportions.
 */
interface LetterboxResult {
  blob: Blob;
  /** The region of the original image content within the square canvas */
  contentRect: { x: number; y: number; w: number; h: number };
}

async function letterboxImageBlob(
  blob: Blob,
  targetSize: number,
): Promise<LetterboxResult> {
  const bitmap = await createImageBitmap(blob);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d")!;

  // Fill with black (models typically expect black padding)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Scale to fit inside targetSize × targetSize keeping aspect ratio
  const scale = Math.min(targetSize / srcW, targetSize / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const offsetX = Math.round((targetSize - drawW) / 2);
  const offsetY = Math.round((targetSize - drawH) / 2);

  ctx.drawImage(bitmap, offsetX, offsetY, drawW, drawH);
  bitmap.close();

  const paddedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Failed to letterbox image")),
      "image/png",
    );
  });

  return {
    blob: paddedBlob,
    contentRect: { x: offsetX, y: offsetY, w: drawW, h: drawH },
  };
}

/**
 * Crop a mask data URL to only the content region (remove letterbox padding)
 * and return a new data URL that maps exactly to the original image proportions.
 */
export async function cropMaskToContentRegion(
  maskDataUrl: string,
  contentRect: { x: number; y: number; w: number; h: number },
  maskSquareSize: number,
): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      // The mask from the model should be maskSquareSize × maskSquareSize.
      // The contentRect tells us where the actual image content was placed
      // inside that square. We need to scale contentRect to match the
      // actual mask dimensions (which might differ from maskSquareSize if
      // the model outputs a different resolution).
      const maskW = img.naturalWidth || maskSquareSize;
      const maskH = img.naturalHeight || maskSquareSize;
      const scaleX = maskW / maskSquareSize;
      const scaleY = maskH / maskSquareSize;

      const cropX = Math.round(contentRect.x * scaleX);
      const cropY = Math.round(contentRect.y * scaleY);
      const cropW = Math.round(contentRect.w * scaleX);
      const cropH = Math.round(contentRect.h * scaleY);

      // Safeguard: if crop dimensions are invalid, return the original mask
      if (cropW <= 0 || cropH <= 0) {
        resolve(maskDataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(maskDataUrl);
        return;
      }

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(maskDataUrl);
    img.src = maskDataUrl;
  });
}

export async function generateMaskWithHf(
  imageUrl: string,
  customEndpoint?: string,
  /** If set, letterbox the image to this square size before sending to the model */
  modelInputSize?: number
): Promise<HfMaskResult> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      "No se pudo leer la imagen original para generar la máscara",
    );
  }

  let imageBlob = await imageResponse.blob();
  const type = imageBlob.type || "image/jpeg";
  const extension = type.includes("png") ? "png" : "jpg";

  // Letterbox the image to the model's expected square input size.
  // This preserves aspect ratio by padding with black instead of
  // squishing the image, which would cause mask misalignment.
  let contentRect: { x: number; y: number; w: number; h: number } | null =
    null;
  if (modelInputSize) {
    const result = await letterboxImageBlob(imageBlob, modelInputSize);
    imageBlob = result.blob;
    contentRect = result.contentRect;
  }

  const file = new File([imageBlob], `micrografia.${extension}`, { type });

  const formData = new FormData();
  formData.append("file", file);

  const endpoint = customEndpoint || HF_MASK_ENDPOINT;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error generando máscara en el modelo");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const maskBlob = await response.blob();
    let dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("No se pudo convertir la máscara a data URL"));
      };
      reader.onerror = () => reject(new Error("Error leyendo máscara"));
      reader.readAsDataURL(maskBlob);
    });

    // Crop out the letterbox padding so the mask maps to the original image
    if (contentRect && modelInputSize) {
      dataUrl = await cropMaskToContentRegion(
        dataUrl,
        contentRect,
        modelInputSize,
      );
    }

    return { url: dataUrl };
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const maskValue =
    payload?.mask_url || payload?.url || payload?.image || payload?.output;
  if (typeof maskValue === "string" && maskValue) {
    const labels = parseHfMaskLabels(payload);

    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(maskValue, endpoint).toString();
    } catch {
      resolvedUrl = maskValue;
    }

    // If the response is a URL (not inline data) and we letterboxed, we
    // need to fetch the mask image and crop it.
    if (contentRect && modelInputSize) {
      // Fetch the mask image, convert to data URL, then crop
      try {
        const maskFetch = await fetch(resolvedUrl);
        if (maskFetch.ok) {
          const maskBlob = await maskFetch.blob();
          const maskDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") resolve(reader.result);
              else reject(new Error("mask blob read failed"));
            };
            reader.onerror = () => reject(new Error("mask blob read error"));
            reader.readAsDataURL(maskBlob);
          });
          resolvedUrl = await cropMaskToContentRegion(
            maskDataUrl,
            contentRect,
            modelInputSize,
          );
        }
      } catch {
        // If cropping fails, use the uncropped mask URL as-is
      }
    }

    return { url: resolvedUrl, labels };
  }

  throw new Error("La respuesta del modelo no contiene una máscara utilizable");
}

// -------------------------------------------------------------
// PDF REPORTS
// -------------------------------------------------------------
export async function generatePdf(muestraId: number | string) {
  const res = await apiFetchWithAuth("reports/pdf/", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ muestra_id: Number(muestraId) }),
  });

  if (!res.ok) {
    const payload = await readErrorPayload(res);
    throw buildApiError(res, payload, "Error generando PDF");
  }

  return res.json();
}

export async function getReportList(): Promise<any[]> {
  const res = await apiFetchWithAuth("reports/", {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error fetching report list");
  return res.json();
}

export async function getReportInfo(reportId: string | number) {
  const res = await apiFetchWithAuth(`reports/${reportId}/`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Error fetching report");
  return res.json();
}

export async function getCompanyStatus(): Promise<boolean> {
  try {
    const res = await apiFetchWithAuth("member/company/status/", {
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.is_enabled;
    }
  } catch (e) {
    console.error(e);
  }
  return true;
}

export interface InclusionPolygon {
  points: { x: number; y: number }[];
  confidence: number;
  class_id: number;
  class_name: string;
}

export async function detectInclusiones(imageUrl: string): Promise<InclusionPolygon[]> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("No se pudo leer la imagen original para detección");
  }

  const imageBlob = await imageResponse.blob();
  const type = imageBlob.type || "image/jpeg";
  const extension = type.includes("png") ? "png" : "jpg";
  const file = new File([imageBlob], `micrografia.${extension}`, { type });

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://dlalberti.duckdns.org:7860/detecciones/", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error obteniendo detecciones del modelo");
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  return data.polygons || data.boxes || [];
}
