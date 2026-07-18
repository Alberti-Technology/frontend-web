import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import * as api from "../services/api";
import { CLOUDINARY_BASE_URL } from "../config/apiConfig";
import {
  MICROGRAPHY_MEASURE_COMPLETED_EVENT,
  type MicrographyMeasureCompletedEvent,
  connectNotificationsWebSocket,
  disconnectNotificationsWebSocket,
} from "../services/notifications";
import ChatPanel from "./ChatPanel";

const MASK_STORAGE_KEY = "mask_cache_v2_by_micro_id";
const MASK_LABELS_STORAGE_KEY = "mask_labels_by_micro_id";
const DRAWINGS_STORAGE_KEY = "draw_cache_v1_by_image_url";
const VERTICES_STORAGE_KEY = "vertices_cache_v1_by_url";

function readVerticesCacheStore(): Record<string, { vertices: number[][]; sourceWidth: number; sourceHeight: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VERTICES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeVerticesCacheStore(store: Record<string, { vertices: number[][]; sourceWidth: number; sourceHeight: number }>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(VERTICES_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn("[vertices cache] localStorage quota exceeded, skipping cache write.", e);
    return false;
  }
}

const ENABLE_AUTOCALIBRATION = false;

const autoCalibrateQueue: Array<{ fd: FormData; imageUrl: string; sourceWidth: number; sourceHeight: number }> = [];
let isProcessingCalibrationQueue = false;

const addMicrografiaToAutoCalibrationQueue = (file: Blob, normalizedImageUrl: string) => {
  if (!ENABLE_AUTOCALIBRATION) return;
  if (!file || !normalizedImageUrl) return;
  if (typeof window !== "undefined" && localStorage.getItem("company_enabled") !== "true") return;
  const autoCalFd = new FormData();
  autoCalFd.append("file", file, "image.jpg");
  // Read original image dimensions before sending to API
  const objectUrl = URL.createObjectURL(file);
  const tempImg = new Image();
  tempImg.onload = () => {
    const w = tempImg.naturalWidth || tempImg.width;
    const h = tempImg.naturalHeight || tempImg.height;
    URL.revokeObjectURL(objectUrl);
    autoCalibrateQueue.push({
      fd: autoCalFd,
      imageUrl: normalizedImageUrl,
      sourceWidth: w,
      sourceHeight: h,
    });
    window.dispatchEvent(new CustomEvent("calibration_started", { detail: { url: normalizedImageUrl } }));
    processAutoCalibrateQueue();
  };
  tempImg.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    autoCalibrateQueue.push({
      fd: autoCalFd,
      imageUrl: normalizedImageUrl,
      sourceWidth: 0,
      sourceHeight: 0,
    });
    window.dispatchEvent(new CustomEvent("calibration_started", { detail: { url: normalizedImageUrl } }));
    processAutoCalibrateQueue();
  };
  tempImg.src = objectUrl;
};

async function processAutoCalibrateQueue() {
  if (isProcessingCalibrationQueue) return;
  isProcessingCalibrationQueue = true;

  while (autoCalibrateQueue.length > 0) {
    const item = autoCalibrateQueue.shift();
    if (!item) continue;
    try {
      const res = await fetch(`${api.HF_BASE_URL}/escala/`, {
        method: "POST",
        body: item.fd,
      });

      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (data && data.um_per_pixel && data.scale_detection?.vertices?.length >= 2) {
          const micrometers = parseFloat(data.ocr?.numero_detectado || "0");
          const pxLen = micrometers > 0 ? micrometers / data.um_per_pixel : 1;
          const calData = {
            pixelLength: pxLen,
            micrometers: micrometers || 1,
            umByPx: data.um_per_pixel,
            isAi: true,
            vertices: data.scale_detection.vertices,
            sourceWidth: item.sourceWidth,
            sourceHeight: item.sourceHeight,
          };
          window.dispatchEvent(new CustomEvent("calibration_updated", { detail: { url: item.imageUrl, data: calData } }));
        } else {
          window.dispatchEvent(new CustomEvent("calibration_failed", { detail: { url: item.imageUrl } }));
        }
      } else {
         window.dispatchEvent(new CustomEvent("calibration_failed", { detail: { url: item.imageUrl } }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent("calibration_failed", { detail: { url: item.imageUrl } }));
      console.error("Auto calibration error for", item.imageUrl, err);
    }
  }
  isProcessingCalibrationQueue = false;
}

type ApiLikeError = {
  status?: number;
  message?: string;
  data?: any;
};

function normalizeId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}


function readDrawCacheStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeDrawCacheStore(store: Record<string, string>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn("[draw cache] localStorage quota exceeded, skipping cache write.", e);
    return false;
  }
}

function getColorNameFromRgb(rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  const exactMap: Record<string, string> = {
    "255,0,0": "Rojo",
    "0,255,0": "Verde",
    "0,0,255": "Azul",
    "255,255,0": "Amarillo",
    "255,165,0": "Naranja",
    "255,255,255": "Blanco",
    "0,0,0": "Negro",
    "128,128,128": "Gris",
  };

  const exact = exactMap[`${r},${g},${b}`];
  if (exact) return exact;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 15) {
    return max > 200 ? "Blanco" : max < 55 ? "Negro" : "Gris";
  }
  if (r === max) return "Rojo";
  if (g === max) return "Verde";
  return "Azul";
}

function isMicrografiaDuplicateError(error: ApiLikeError | null | undefined) {
  const data = error?.data;
  const text = [
    error?.message || "",
    typeof data === "string" ? data : JSON.stringify(data || {}),
  ]
    .join(" ")
    .toLowerCase();

  return (
    text.includes("unique_micrografia_por_region") ||
    text.includes("must make a unique set") ||
    text.includes("already exists") ||
    text.includes("ya existe") ||
    text.includes("duplicate")
  );
}

// ==========================================
// TYPES — Material(img) > Muestra(img) > Región(img) > Micrografías[]
// ==========================================
interface Micrografia {
  id: string;
  rawId: string;
  name: string;
  url: string;
  umByPx: number | null;
}

interface Region {
  id: string;
  name: string;
  image: string; // representative image of this region
  micrografias: Micrografia[];
}

interface Muestra {
  id: string;
  name: string;
  image: string; // representative image of this muestra
  regiones: Region[];
}

interface Material {
  id: string;
  name: string;
  image: string; // representative image of this material
  muestras: Muestra[];
}

// What the gallery is currently showing
type GalleryView =
  | { kind: "none" }
  | { kind: "all-materials"; images: { name: string; url: string }[] }
  | { kind: "single-material"; material: Material }
  | { kind: "all-muestras"; images: { name: string; url: string }[] }
  | { kind: "single-muestra"; muestra: Muestra }
  | { kind: "all-regiones"; images: { name: string; url: string }[] }
  | { kind: "single-region"; region: Region }
  | { kind: "micrografias"; images: Micrografia[] };

// ==========================================
// API DOMAIN TYPES
// ==========================================
export interface ApiMuestra {
  id: number | string;
  nombre: string;
  imagen: string;
  informacion?: string;
  material: number | string;
}
export interface ApiRegion {
  id: number | string;
  nombre: string;
  imagen: string;
  muestra: number;
}
export interface ApiMicrografia {
  id: number | string;
  nombre: string;
  imagen: string;
  region: number;
  um_by_px?: number;
  is_ai?: boolean;
  pixel_length?: number;
  micrometers?: number;
  measure_imagen?: string;
  measure_is_valid?: boolean | null;
}

// ==========================================
// ICONS
// ==========================================
const ChevronDown = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
const ChevronRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);
const FolderIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#339eea"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);
const ImageFileIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#4d6684"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);
const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
  </svg>
);
const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
const AlertIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);
const InfoIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);
const XCircleIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

// ==========================================
// COLLAPSIBLE ANIMATION WRAPPER
// ==========================================
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 250ms ease",
      }}
    >
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ==========================================
// MODALS
// ==========================================
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor = "#e53e3e",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-[28px] shadow-xl border border-[#10243f14] max-w-md w-[90%] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-[#10243f14]">
          <h3 className="text-lg font-bold m-0" style={{ color: "#339eea" }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-[#4d6684] hover:text-[#10243f] transition p-1 rounded-full hover:bg-[#dff1ff]"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-7 py-5">
          <p className="text-[#4d6684] text-sm m-0 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex gap-3 justify-end px-7 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-semibold text-xs border border-[#10243f14] text-[#4d6684] bg-[#f8fbff] hover:bg-[#eef8ff] transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl font-semibold text-xs text-white transition hover:opacity-90"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({
  currentName,
  onConfirm,
  errorMessage,
  onInputChange,
  onCancel,
}: {
  currentName: string;
  onConfirm: (n: string) => void | Promise<void>;
  errorMessage?: string | null;
  onInputChange?: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-[28px] shadow-xl border border-[#10243f14] max-w-md w-[90%] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-[#10243f14]">
          <h3 className="text-lg font-bold m-0" style={{ color: "#339eea" }}>
            Renombrar
          </h3>
          <button
            onClick={onCancel}
            className="text-[#4d6684] hover:text-[#10243f] transition p-1 rounded-full hover:bg-[#dff1ff]"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-7 py-5">
          <label className="block text-xs font-semibold text-[#10243f] mb-2">
            Nuevo nombre
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onInputChange?.();
            }}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-[#10243f14] text-[#10243f] text-sm focus:outline-none focus:border-[#339eea] focus:ring-2 focus:ring-[#339eea33] transition"
          />
          {errorMessage && (
            <p className="mt-2 text-[12px] font-semibold text-[#b42318]">
              {errorMessage}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-end px-7 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-semibold text-xs border border-[#10243f14] text-[#4d6684] bg-[#f8fbff] hover:bg-[#eef8ff] transition"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!value.trim() || isSaving) return;
              setIsSaving(true);
              try {
                await onConfirm(value.trim());
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving || !value.trim()}
            className="px-4 py-2 rounded-xl font-semibold text-xs text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #339eea, #0d5a91)" }}
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({
  parentId,
  type,
  onConfirm,
  onCancel,
}: {
  parentId: string | number;
  type: "material" | "muestra" | "region" | "micrografia";
  onConfirm: (fds: FormData[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [info, setInfo] = useState(""); // solo para muestra
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]); // for bulk micrografía
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isBulk = type === "micrografia";

  // Helper title
  const titles = {
    material: "Añadir nuevo Material",
    muestra: "Añadir nueva Muestra",
    region: "Añadir nueva Región",
    micrografia: "Añadir Micrografías",
  };

  const handleSubmit = async () => {
    if (isBulk) {
      if (files.length === 0) {
        setValidationError("Seleccioná al menos una imagen.");
        return;
      }
      setLoading(true);
      setValidationError(null);
      try {
        const fds = files.map((f) => {
          const fd = new FormData();
          fd.append("nombre", f.name.replace(/\.[^.]+$/, "")); // filename without extension
          fd.append("imagen", f);
          fd.append("region", String(parentId));
          fd.append("um_by_px", "1");
          return fd;
        });
        await onConfirm(fds);
      } finally {
        setLoading(false);
      }
    } else {
      if (!name.trim() || (type !== "material" && !file)) {
        setValidationError(type === "material" ? "Nombre es requerido." : "Nombre e imagen son requeridos.");
        return;
      }
      setLoading(true);
      setValidationError(null);
      try {
        const fd = new FormData();
        fd.append("nombre", name.trim());
        if (file) {
          fd.append("imagen", file);
        }
        if (type === "muestra") {
          fd.append("informacion", info.trim());
          fd.append("material", String(parentId));
        } else if (type === "region") {
          fd.append("muestra", String(parentId));
        }
        await onConfirm([fd]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-[28px] shadow-xl border border-[#10243f14] max-w-md w-[90%] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-[#10243f14]">
          <h3 className="text-lg font-bold m-0" style={{ color: "#339eea" }}>
            {titles[type]}
          </h3>
          <button
            onClick={onCancel}
            className="text-[#4d6684] hover:text-[#10243f] transition p-1 rounded-full hover:bg-[#dff1ff]"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-7 py-5 flex flex-col gap-4">
          {!isBulk && (
            <div>
              <label className="block text-xs font-semibold text-[#10243f] mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-[#10243f14] text-[#10243f] text-sm focus:outline-none focus:border-[#339eea] focus:ring-2 focus:ring-[#339eea33] transition"
              />
            </div>
          )}
          {type === "muestra" && (
            <div>
              <label className="block text-xs font-semibold text-[#10243f] mb-2">
                Información
              </label>
              <textarea
                value={info}
                onChange={(e) => {
                  setInfo(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-[#10243f14] text-[#10243f] text-sm focus:outline-none focus:border-[#339eea] focus:ring-2 focus:ring-[#339eea33] transition"
              />
            </div>
          )}
          {type !== "material" && (
            <div>
              <label className="block text-xs font-semibold text-[#10243f] mb-2">
                {isBulk ? `Imágenes (${files.length} seleccionadas)` : "Imagen"}
              </label>
              {isBulk ? (
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  multiple
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files || []));
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full text-sm text-[#4d6684] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#eef8ff] file:text-[#339eea] hover:file:bg-[#dff1ff] transition"
                />
              ) : (
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full text-sm text-[#4d6684] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#eef8ff] file:text-[#339eea] hover:file:bg-[#dff1ff] transition"
                />
              )}
            </div>
          )}
          {validationError && (
            <p className="m-0 text-[12px] font-semibold text-[#b42318]">
              {validationError}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-end px-7 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-semibold text-xs border border-[#10243f14] text-[#4d6684] bg-[#f8fbff] hover:bg-[#eef8ff] transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl font-semibold text-xs text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #339eea, #0d5a91)" }}
          >
            {loading
              ? "Guardando..."
              : isBulk
                ? `Subir ${files.length} imagen${files.length !== 1 ? "es" : ""}`
                : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// RESPONSIVE GALLERY COMPONENT
// ==========================================
function ResponsiveGallery({
  images,
  calibrableByUrl,
  calibratedByUrl,
  calibratingByUrl,
  failedCalibrationByUrl,
  microMaterialHasModelByUrl = {},
  calibrationData,
  companyEnabled,
  highlightedByUrl,
  apiMicrografias,
  measureEventsById,
  fixImageUrl,
  onImageClick,
}: {
  images: { name: string; url: string }[];
  calibrableByUrl: Record<string, boolean>;
  calibratedByUrl: Record<string, boolean>;
  calibratingByUrl?: Record<string, boolean>;
  failedCalibrationByUrl?: Record<string, boolean>;
  microMaterialHasModelByUrl?: Record<string, boolean>;
  calibrationData?: Record<string, CalibrationInfo>;
  companyEnabled?: boolean;
  highlightedByUrl?: Record<string, boolean>;
  apiMicrografias: ApiMicrografia[];
  measureEventsById: Record<string, any>;
  fixImageUrl: (url: string | undefined | null) => string;
  onImageClick: (img: { name: string; url: string }) => void;
}) {
  const count = images.length;
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center absolute inset-0 opacity-70 p-4 text-center">
        <div className="text-[#9ca3af] mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        </div>
        <p className="text-[#6b7280] text-[0.9rem] italic m-0">
          Seleccione un elemento para ver las imágenes.
        </p>
      </div>
    );
  }

  const gridTemplateColumns =
    count === 1
      ? "1fr"
      : count === 2
        ? "repeat(2, minmax(220px, 1fr))"
        : count === 3
          ? "repeat(3, minmax(180px, 1fr))"
          : count === 4
            ? "repeat(2, minmax(220px, 1fr))"
            : "repeat(auto-fill, minmax(210px, 1fr))";

  const cardAspectRatio =
    count === 1 ? "auto" : count <= 4 ? "4 / 3" : "16 / 10";

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns,
    gap: "12px",
    width: "100%",
    maxWidth: count === 2 ? 920 : "100%",
    margin: "0 auto",
    alignItems: "stretch",
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    el.style.display = "none";
    // Show the fallback sibling
    const fallback = el.nextElementSibling as HTMLElement | null;
    if (fallback && fallback.dataset.fallback) {
      fallback.style.display = "flex";
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: count === 1 ? "center" : "flex-start",
        justifyContent: "center",
      }}
    >
      <div style={gridStyle}>
        {images.map((img, i) =>
          (() => {
            const isCalibrable = !!calibrableByUrl[img.url];
            const isCalibrated = isCalibrable && (!!calibratedByUrl[img.url] || (!!calibrationData?.[img.url]?.umByPx && Number(calibrationData?.[img.url]?.umByPx) > 0));
            const isCalibrating = !!calibratingByUrl?.[img.url];
            const isFailed = !!failedCalibrationByUrl?.[img.url];
            const hasModel = microMaterialHasModelByUrl?.[img.url] ?? true;
            const isHighlighted = !!highlightedByUrl?.[img.url];
            
            const mic = apiMicrografias.find((m) => fixImageUrl(m.imagen) === img.url);
            const measureEvt = mic ? measureEventsById[String(mic.id)] : undefined;
            const isChartProcessed = measureEvt ? measureEvt.status === "completed" && measureEvt.is_valid === true : mic?.measure_is_valid === true || !!mic?.measure_imagen;
            const isChartFailed = measureEvt ? measureEvt.status === "completed" && measureEvt.is_valid === false : mic?.measure_is_valid === false;
            const isChartProcessing = !isChartProcessed && !isChartFailed;

            return (
              <div
                key={`${img.url}-${i}`}
                className="rounded-xl overflow-hidden cursor-zoom-in group relative transition-all"
                style={{
                  width: "100%",
                  height: "auto",
                  minHeight: count === 1 ? 0 : count <= 2 ? 220 : 165,
                  maxHeight: count === 1 ? "100%" : undefined,
                  aspectRatio: cardAspectRatio,
                  overflow: "hidden",
                  background: "#f0f4f8",
                  border: "1px solid rgba(16,36,63,0.08)",
                  boxShadow: "0 1px 3px rgba(16,36,63,0.08)",
                }}
                onClick={() => onImageClick(img)}
              >
                {isCalibrable && companyEnabled !== false && (!ENABLE_AUTOCALIBRATION ? isCalibrated : (hasModel || isCalibrated)) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      zIndex: 2,
                      background: isCalibrated
                        ? "rgba(22, 163, 74, 0.92)"
                        : isFailed
                          ? "rgba(220, 38, 38, 0.92)"
                          : "rgba(232, 163, 23, 0.92)",
                      color: "white",
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      height: "22px",
                      boxSizing: "border-box",
                      padding: "0 8px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      letterSpacing: "0.02em",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                    title={
                      isCalibrated
                        ? calibrationData?.[img.url]?.isAi
                          ? "Calibrada por IA"
                          : "Calibrada manualmente"
                        : isCalibrating
                          ? "Autocalibrando..."
                          : isFailed
                            ? "Fallo de autocalibración"
                            : "Micrografía sin calibrar"
                    }
                  >
                    <span style={{ lineHeight: 0, display: "inline-flex" }}>
                      {isCalibrated ? (
                        calibrationData?.[img.url]?.isAi && hasModel ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckIcon size={11} /> IA
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckIcon size={11} /> CM
                          </span>
                        )
                      ) : isCalibrating && hasModel ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"white", animation:"pulse 1.5s infinite"}}/> IA
                        </span>
                      ) : isFailed && hasModel ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertIcon size={11} /> IA
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"white"}}/> Sin Calibrar
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {isCalibrable && companyEnabled !== false && hasModel && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: isCalibrated || isCalibrating || isFailed ? (isCalibrated ? 64 : 58) : 8,
                      zIndex: 2,
                      background: isChartProcessed
                        ? "rgba(22, 163, 74, 0.92)"
                        : isChartFailed
                          ? "rgba(220, 38, 38, 0.92)"
                          : "rgba(232, 163, 23, 0.92)",
                      color: "white",
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      height: "22px",
                      boxSizing: "border-box",
                      padding: "0 8px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      letterSpacing: "0.02em",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                    title={
                      isChartProcessed
                        ? "Gráfico de medición disponible"
                        : isChartProcessing
                          ? "Procesando gráfico..."
                          : isChartFailed
                            ? "Fallo al generar gráfico"
                            : "Procesando gráfico..."
                    }
                  >
                    <span style={{ lineHeight: 0, display: "inline-flex" }}>
                        <ChartIcon size={12} />
                    </span>
                  </div>
                )}
                {img.url ? (
                  <img
                    src={img.url}
                    alt={img.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: count === 1 ? "contain" : "cover",
                      display: "block",
                    }}
                    className="transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={handleImgError}
                  />
                ) : null}
                {/* Fallback placeholder when image fails to load */}
                <div
                  data-fallback="true"
                  style={{
                    display: "none",
                    position: "absolute",
                    inset: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                    color: "#4d6684",
                    background: "#f0f4f8",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.4 }}
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    ></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      opacity: 0.6,
                    }}
                  >
                    {img.name}
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                  <span className="text-white font-medium text-xs truncate">
                    {img.name}
                  </span>
                </div>
              </div>
            );
          })(),
        )}
      </div>
    </div>
  );
}

// ==========================================
// CALIBRATION TYPES
// ==========================================
interface CalibrationInfo {
  pixelLength: number;
  micrometers: number;
  width?: number;
  height?: number;
  umByPx?: number;
  isAi?: boolean;
  vertices?: number[][];
  sourceWidth?: number;
  sourceHeight?: number;
}

interface ToastNotification {
  id: number;
  title: string;
  message: string;
  tone: "error" | "info" | "success" | "warning";
  durationMs: number;
  leaving: boolean;
}

// ==========================================
// ICONS for tools
// ==========================================
const CaliperIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="20" x2="20" y2="4" />
    <line x1="4" y1="20" x2="8" y2="20" />
    <line x1="4" y1="20" x2="4" y2="16" />
    <line x1="20" y1="4" x2="20" y2="1" />
    <line x1="16" y1="1" x2="20" y2="1" />
    <line x1="7" y1="17" x2="9" y2="19" />
    <line x1="10" y1="14" x2="12" y2="16" />
    <line x1="13" y1="11" x2="15" y2="13" />
    <rect x="10" y="8" width="6" height="4" rx="0.6" />
  </svg>
);

const RefreshIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const RulerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </svg>
);
const MaskIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12c0 5.5 4.5 10 10 10s10-4.5 10-10S17.5 2 12 2 2 6.5 2 12Z" />
    <path d="M7 11h.01" />
    <path d="M10 8h.01" />
    <path d="M14 8h.01" />
    <path d="M17 11h.01" />
    <path d="M9 15c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5" />
  </svg>
);
const InclusionsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);
const ChartIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v18h18" />
    <path d="M7 16l4-4 3 3 6-7" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
const PencilIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);
const EraserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

// ==========================================
// IMAGE LIGHTBOX CAROUSEL (with calibration)
// ==========================================
function ImageLightboxCarousel({
  images,
  initialIndex,
  calibrableByUrl,
  calibrationData,
  maskByImageUrl = {},
  maskLabelsByImageUrl,
  maskVisibleByImageUrl,
  maskLoadingByImageUrl,
  lastMicrometers,
  onSaveCalibration,
  onGenerateMask,
  onUpdateMaskData,
  onClose,
  contextInfo,
  calibratingByUrl,
  failedCalibrationByUrl,
  microMaterialHasModelByUrl = {},
  measurementOverlayById,
  measurementOverlayVisibleByUrl,
  onToggleMeasurementOverlay,
  onRetryAutoCalibration,
  onCheckMicrographLimit = (action) => action(),
  pushToast,
  inclusionsByImageUrl = {},
  inclusionsVisibleByImageUrl = {},
  inclusionsLoadingByImageUrl = {},
  onDetectInclusiones,
}: {
  images: { name: string; url: string; id?: string }[];
  initialIndex: number;
  calibrableByUrl: Record<string, boolean>;
  calibrationData: Record<string, CalibrationInfo>;
  maskByImageUrl: Record<string, string>;
  maskLabelsByImageUrl: Record<string, api.HfMaskLabels>;
  maskVisibleByImageUrl: Record<string, boolean>;
  maskLoadingByImageUrl: Record<string, boolean>;
  lastMicrometers: number;
  contextInfo: {
    materialName?: string;
    muestraName?: string;
    regionName?: string;
  };
  onSaveCalibration: (imageUrl: string, data: CalibrationInfo) => void;
  onGenerateMask: (imageUrl: string) => Promise<void>;
  onUpdateMaskData: (imageUrl: string, newDataUrl: string) => void;
  onClose: () => void;
  onRetryAutoCalibration?: (imageUrl: string) => void;
  calibratingByUrl?: Record<string, boolean>;
  failedCalibrationByUrl?: Record<string, boolean>;
  microMaterialHasModelByUrl?: Record<string, boolean>;
  onCheckMicrographLimit?: (action: () => void) => void;
  measurementOverlayById?: Record<string, string>;
  measurementOverlayVisibleByUrl?: Record<string, boolean>;
  onToggleMeasurementOverlay?: (imageUrl: string) => void;
  pushToast: (message: string, type?: "success" | "error" | "info" | "warning", duration?: number) => void;
  inclusionsByImageUrl?: Record<string, api.InclusionPolygon[]>;
  inclusionsVisibleByImageUrl?: Record<string, boolean>;
  inclusionsLoadingByImageUrl?: Record<string, boolean>;
  onDetectInclusiones?: (imageUrl: string) => Promise<void>;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [inclusionsThreshold, setInclusionsThreshold] = useState<number>(0.1);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null);
  const [measurementStart, setMeasurementStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [measurementEnd, setMeasurementEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [measurementPx, setMeasurementPx] = useState(0);
  const [measurementLabelPos, setMeasurementLabelPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [lineFinished, setLineFinished] = useState(false);
  const [canvasLayoutCounter, setCanvasLayoutCounter] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [micrometersInput, setMicrometersInput] = useState(
    String(lastMicrometers || ""),
  );
  const [activeSidebarTool, setActiveSidebarTool] = useState<
    "overview" | "calibration" | "measurement" | "mask"
  >("overview");
  const [pixelLength, setPixelLength] = useState(0);
  const [detectedPixelLength, setDetectedPixelLength] = useState(0);
  const [hoveredInclusion, setHoveredInclusion] = useState<{
    poly: api.InclusionPolygon;
    x: number;
    y: number;
  } | null>(null);
  const [editorLayout, setEditorLayout] = useState({
    imageWidth: 640,
    imageHeight: 360,
    imageLeft: 0,
    imageRight: 1280,
    viewportWidth: 1280,
    viewportHeight: 720,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inclusionsCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const currentImage = images[currentIndex];

  useEffect(() => {
    const canvas = inclusionsCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    
    // Sync size
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = img.clientWidth + "px";
    canvas.style.height = img.clientHeight + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isVisible = inclusionsVisibleByImageUrl?.[currentImage?.url];
    const polygons = inclusionsByImageUrl?.[currentImage?.url];
    
    if (isVisible && polygons) {
      ctx.strokeStyle = "#00ff00";
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      ctx.lineWidth = Math.max(1, Math.round(canvas.width / 500));
      for (const poly of polygons) {
        if (poly.confidence >= inclusionsThreshold && poly.points && poly.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(poly.points[0].x, poly.points[0].y);
          for (let i = 1; i < poly.points.length; i++) {
            ctx.lineTo(poly.points[i].x, poly.points[i].y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        }
      }
    }
  }, [
    currentImage?.url, 
    inclusionsByImageUrl, 
    inclusionsVisibleByImageUrl, 
    inclusionsThreshold, 
    currentIndex
  ]);


  // ---- Mask editing state ----
  const [maskEditTool, setMaskEditTool] = useState<"pencil" | "eraser" | null>(
    null,
  );
  const [isMaskDrawing, setIsMaskDrawing] = useState(false);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastMaskPosRef = useRef<{ x: number; y: number } | null>(null);
  const [drawByImageUrl, setDrawByImageUrl] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    setDrawByImageUrl(readDrawCacheStore());
  }, []);

  const hasSiblingImages = images.length > 1;
  const currentImageIsCalibrable = !!calibrableByUrl[currentImage.url];
  const hasCalibration = !!calibrationData[currentImage.url];
  const currentCalibration = calibrationData[currentImage.url];
  const currentMaskUrl = maskByImageUrl[currentImage.url] || "";
  const currentDrawUrl = drawByImageUrl[currentImage.url] || "";
  const currentMaskLabels = maskLabelsByImageUrl[currentImage.url];
  const currentMeasurementOverlayUrl =
    (currentImage.id && measurementOverlayById?.[currentImage.id]) || "";
  const isMeasurementOverlayVisible =
    !!measurementOverlayVisibleByUrl?.[currentImage.url];
  const displayedImageUrl =
    currentMeasurementOverlayUrl && isMeasurementOverlayVisible
      ? currentMeasurementOverlayUrl
      : currentImage.url;
  const isMaskVisible =
    !!currentMaskUrl && maskVisibleByImageUrl[currentImage.url] !== false;
  const isMaskLoading = !!maskLoadingByImageUrl[currentImage.url];
  const isDrawingToolActive = !!maskEditTool;
  const drawingToolLabel =
    maskEditTool === "pencil"
      ? "Lápiz"
      : maskEditTool === "eraser"
        ? "Goma"
        : "";
  const maskLegendEntries = useMemo(() => {
    if (!currentMaskLabels) return [];
    return Object.entries(currentMaskLabels)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, info]) => ({
        id,
        name: info.name,
        color: info.color,
        colorLabel: getColorNameFromRgb(info.color),
      }));
  }, [currentMaskLabels]);
  const calibrationRatio =
    hasCalibration && currentCalibration
      ? currentCalibration.umByPx ||
        currentCalibration.micrometers /
          Math.max(currentCalibration.pixelLength, 1)
      : null;
  const measurementEnabled = !!calibrationRatio;
  const measurementMode =
    activeSidebarTool === "measurement" && measurementEnabled;
  const measurementDistanceUm =
    measurementPx > 0 && calibrationRatio
      ? measurementPx * calibrationRatio
      : null;
  // Derive AI UI state early so we can account for border padding in layout
  const isExternallyCalibrating = calibratingByUrl?.[currentImage.url];
  const currentMaterialHasModel = microMaterialHasModelByUrl[currentImage.url] ?? true;
  const isExternallyFailed = failedCalibrationByUrl?.[currentImage.url];
  const aiSuccess = hasCalibration && calibrationData[currentImage.url]?.isAi === true && currentMaterialHasModel;
  const aiError = isExternallyFailed && currentMaterialHasModel;
  const aiProcessing = isExternallyCalibrating && currentMaterialHasModel;
  const showAiFx = (aiSuccess || aiError || aiProcessing) && !calibrationMode && !measurementMode && !isDrawingToolActive;
  let aiFxColor = "#4ade80"; // green
  if (aiError) aiFxColor = "#f87171"; // red
  else if (aiProcessing) aiFxColor = "#e8a317"; // yellow

  const LIGHTBOX_SIDE_MIN = 40;
  const MIN_CONTEXT_WIDTH = 280;
  const borderPad = showAiFx ? 8 : 0; // reserve space for the animated border
  const imageMaxWidth = Math.max(
    260,
    editorLayout.viewportWidth - LIGHTBOX_SIDE_MIN - MIN_CONTEXT_WIDTH - borderPad,
  );
  const imageMaxHeight = Math.max(220, editorLayout.viewportHeight - 100 - borderPad);
  // Sidebar positions: center each panel in the gap between viewport edge and image edge
  // Clamp sidebar so the 62px pill doesn't clip off-screen (center >= 38px)
  const sidebarCenterX = Math.max(38, editorLayout.imageLeft / 2);
  const contextCenterX =
    (editorLayout.imageRight + editorLayout.viewportWidth) / 2;
  const contextGapWidth = Math.max(
    0,
    editorLayout.viewportWidth - editorLayout.imageRight,
  );
  const toolTitle = isDrawingToolActive
    ? "Dibujo"
    : activeSidebarTool === "calibration"
      ? "Calibración"
      : activeSidebarTool === "measurement"
        ? "Medición"
        : activeSidebarTool === "mask"
          ? "Máscaras IA"
          : "Información";
  const toolDescription = isDrawingToolActive
    ? "Dibujá sobre la micrografia con lapiz o goma. Los trazos se guardan localmente en este navegador."
    : activeSidebarTool === "calibration"
      ? "Traza una linea sobre la escala visible y guarda la medida en micrometros para obtener um/px con precision."
      : activeSidebarTool === "measurement"
        ? "Arrastra una linea sobre la micrografia para medir distancias en micrometros. La medida es temporal y no se guarda."
        : activeSidebarTool === "mask"
          ? "Genera y superpone la mascara de segmentacion. La opacidad es fija al 65% para mantener consistencia visual."
          : "Usa las herramientas del lateral izquierdo para calibrar o segmentar la micrografia actual.";
  const calibrationStateLabel = calibrationMode
    ? lineStart
      ? "trazando escala"
      : "lista para trazar"
    : hasCalibration
      ? "calibrada"
      : "sin calibrar";

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showConfirmModal || showInputModal || showAutoDetectModal) return;
      if (e.key === "Escape") onClose();
      if (images.length > 1) {
        if (e.key === "ArrowLeft")
          setCurrentIndex((p) => (p > 0 ? p - 1 : images.length - 1));
        if (e.key === "ArrowRight")
          setCurrentIndex((p) => (p < images.length - 1 ? p + 1 : 0));
      }
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [
    onClose,
    currentIndex,
    images.length,
    showConfirmModal,
    showInputModal,
    showAutoDetectModal,
  ]);

  // When navigating images, reset calibration/measurement mode but
  // preserve drawing tool and mask sidebar so the user can keep
  // working across images without losing context.
  useEffect(() => {
    // Save current drawing tool and sidebar before resetting
    const wasDrawing = maskEditTool;
    const wasMaskSidebar = activeSidebarTool === "mask";

    // Reset calibration/measurement state (image-specific)
    setCalibrationMode(false);
    setLineStart(null);
    setLineEnd(null);
    setLineFinished(false);
    setMeasurementStart(null);
    setMeasurementEnd(null);
    setMeasurementPx(0);
    setMeasurementLabelPos(null);
    setIsMeasuring(false);
    setShowConfirmModal(false);
    setShowInputModal(false);
    setShowAutoDetectModal(false);
    setIsMaskDrawing(false);
    setShowAutoDetectModal(false);
    setIsMaskDrawing(false);
    clearCanvas();

    // If the user was using a drawing tool or viewing the mask panel,
    // keep those active; otherwise fall back to overview.
    if (wasDrawing) {
      // maskEditTool stays as-is; sidebar stays on "mask"
      setActiveSidebarTool("mask");
    } else if (wasMaskSidebar) {
      setActiveSidebarTool("mask");
    } else {
      setActiveSidebarTool("overview");
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!currentImageIsCalibrable && activeSidebarTool !== "overview") {
      setActiveSidebarTool("overview");
    }
  }, [activeSidebarTool, currentImageIsCalibrable]);

  const onSaveCalibrationRef = useRef(onSaveCalibration);
  useEffect(() => {
    onSaveCalibrationRef.current = onSaveCalibration;
  }, [onSaveCalibration]);

  // AI state variables are now derived earlier (before imageMaxWidth/imageMaxHeight)

  const resetCalibrationState = (goToOverview = false) => {
    setCalibrationMode(false);
    setLineStart(null);
    setLineEnd(null);
    setLineFinished(false);
    setMeasurementStart(null);
    setMeasurementEnd(null);
    setMeasurementPx(0);
    setMeasurementLabelPos(null);
    setIsMeasuring(false);
    setShowConfirmModal(false);
    setShowInputModal(false);
    setShowAutoDetectModal(false);
    setShowAutoDetectModal(false);
    setMaskEditTool(null);
    setIsMaskDrawing(false);
    if (goToOverview) {
      setActiveSidebarTool("overview");
    }
    clearCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resetMeasurementState = () => {
    setMeasurementStart(null);
    setMeasurementEnd(null);
    setMeasurementPx(0);
    setMeasurementLabelPos(null);
    setIsMeasuring(false);
    clearCanvas();
  };

  const syncEditorLayout = useCallback(() => {
    if (typeof window === "undefined") return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const imgRect = imgRef.current?.getBoundingClientRect();
    const fallbackRect = imageContainerRef.current?.getBoundingClientRect();
    const rect =
      imgRect && imgRect.width > 0 && imgRect.height > 0
        ? imgRect
        : fallbackRect;

    setEditorLayout({
      imageWidth: rect?.width || 640,
      imageHeight: rect?.height || 360,
      imageLeft: rect?.left || 0,
      imageRight: rect?.right || viewportWidth,
      viewportWidth,
      viewportHeight,
    });
  }, []);

  // Sync canvas size with image container
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = img.clientWidth + "px";
    canvas.style.height = img.clientHeight + "px";
    syncEditorLayout();
    setCanvasLayoutCounter(c => c + 1);
  }, [syncEditorLayout]);

  useEffect(() => {
    syncEditorLayout();

    const onResize = () => syncEditorLayout();
    window.addEventListener("resize", onResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncEditorLayout());
      if (imageContainerRef.current)
        observer.observe(imageContainerRef.current);
      if (imgRef.current) observer.observe(imgRef.current);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (observer) observer.disconnect();
    };
  }, [currentIndex, syncEditorLayout]);

  // Draw the line on canvas
  const drawLine = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      const scale = (scaleX + scaleY) / 2;
      const displayLineWidthPx = 4;
      const displayPointRadiusPx = 8;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = "#ff3333";
      ctx.lineWidth = displayLineWidthPx * scale;
      ctx.lineCap = "round";
      ctx.stroke();
    },
    [],
  );

  // Draw AI calibration box — scale vertices from source image space to canvas space
  const drawVertices = useCallback((vertices: number[][], sourceWidth?: number, sourceHeight?: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const scale = (scaleX + scaleY) / 2;
    const displayLineWidthPx = 3;

    // Scale factor from source (original file sent to API) to canvas (naturalWidth of displayed image)
    const sX = (sourceWidth && sourceWidth > 0) ? canvas.width / sourceWidth : 1;
    const sY = (sourceHeight && sourceHeight > 0) ? canvas.height / sourceHeight : 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    vertices.forEach((v, i) => {
      const x = v[0] * sX;
      const y = v[1] * sY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "#339eea";
    ctx.lineWidth = displayLineWidthPx * scale;
    ctx.stroke();
  }, []);

  useEffect(() => {
    const currentImage = images[currentIndex];
    if (!currentImage) return;
    const data = calibrationData[currentImage.url];
    // Only draw it if we're not currently doing manual calibration/measure and if it's AI
    if (data?.vertices && data.isAi && showAiFx) {
      drawVertices(data.vertices, data.sourceWidth, data.sourceHeight);
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [currentIndex, calibrationData, drawVertices, images, showAiFx, canvasLayoutCounter]);

  // Get position relative to the canvas (which matches natural image coords)
  const getCanvasPos = (
    e: React.MouseEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Scale from displayed size to canvas (natural) size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!calibrationMode || lineFinished) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    setLineStart(pos);
    setLineEnd(pos);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!calibrationMode || !lineStart || lineFinished) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    setLineEnd(pos);
    drawLine(lineStart, pos);
  };

  const handleCanvasMouseUp = () => {
    if (!calibrationMode || !lineStart || !lineEnd || lineFinished) return;
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) {
      // Too short, ignore
      clearCanvas();
      setLineStart(null);
      setLineEnd(null);
      return;
    }
    setPixelLength(Math.round(len));
    setLineFinished(true);
    setShowConfirmModal(true);
    // Update micrometersInput with lastMicrometers preset
    setMicrometersInput(String(lastMicrometers || ""));
  };

  const handleMeasurementMouseDown = (e: React.MouseEvent) => {
    if (!measurementMode) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    setIsMeasuring(true);
    setMeasurementStart(pos);
    setMeasurementEnd(pos);
    setMeasurementPx(0);
    setMeasurementLabelPos({ x: e.clientX, y: e.clientY });
  };

  const handleMeasurementMouseMove = (e: React.MouseEvent) => {
    if (!measurementMode || !isMeasuring || !measurementStart) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    setMeasurementEnd(pos);
    const dx = pos.x - measurementStart.x;
    const dy = pos.y - measurementStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    setMeasurementPx(len);
    drawLine(measurementStart, pos);
    setMeasurementLabelPos({ x: e.clientX, y: e.clientY });
  };

  const handleMeasurementMouseUp = () => {
    if (!measurementMode || !isMeasuring) return;
    setIsMeasuring(false);
    setMeasurementLabelPos(null);

    if (!measurementStart || !measurementEnd) {
      clearCanvas();
      setMeasurementStart(null);
      setMeasurementEnd(null);
      setMeasurementPx(0);
      return;
    }

    const dx = measurementEnd.x - measurementStart.x;
    const dy = measurementEnd.y - measurementStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) {
      clearCanvas();
      setMeasurementStart(null);
      setMeasurementEnd(null);
      setMeasurementPx(0);
      return;
    }

    setMeasurementPx(len);
  };

  const handleMeasurementMouseLeave = () => {
    if (!isMeasuring) return;
    setIsMeasuring(false);
    setMeasurementLabelPos(null);
  };

  const handleActivateCalibration = () => {
    if (!currentImageIsCalibrable) return;
    if (activeSidebarTool === "calibration") {
      setActiveSidebarTool("overview");
      resetCalibrationState(false);
      return;
    }
    resetCalibrationState(false);
    setActiveSidebarTool("calibration");

    // 1. Check if another image has same dimensions and has calibration
    const img = imgRef.current;
    if (img && Object.keys(calibrationData).length > 0) {
      const currentW = img.naturalWidth;
      const currentH = img.naturalHeight;

      // Find a previously calibrated image with the exact same dimensions
      let matchedCal: CalibrationInfo | null = null;
      for (const url of Object.keys(calibrationData)) {
        const cal = calibrationData[url];
        if (
          cal.width === currentW &&
          cal.height === currentH &&
          cal.pixelLength > 0
        ) {
          matchedCal = cal;
          break;
        }
      }

      if (matchedCal) {
        setDetectedPixelLength(matchedCal.pixelLength);
        setMicrometersInput(String(lastMicrometers || ""));
        setShowAutoDetectModal(true);
        return;
      }
    }

    // No auto-detect
    setCalibrationMode(true);
    setLineStart(null);
    setLineEnd(null);
    setLineFinished(false);
    clearCanvas();
    setTimeout(syncCanvasSize, 50);
  };

  const handleActivateMeasurement = () => {
    if (!currentImageIsCalibrable || !measurementEnabled) return;
    if (activeSidebarTool === "measurement") {
      resetMeasurementState();
      setActiveSidebarTool("overview");
      return;
    }
    resetCalibrationState(false);
    setActiveSidebarTool("measurement");
    setTimeout(syncCanvasSize, 50);
  };

  const handleAutoDetectCancel = () => {
    setShowAutoDetectModal(false);
    // User wants to do it manual
    setCalibrationMode(true);
    setLineStart(null);
    setLineEnd(null);
    setLineFinished(false);
    clearCanvas();
    setTimeout(syncCanvasSize, 50);
  };

  const handleAutoDetectSave = () => {
    const um = parseFloat(micrometersInput);
    if (isNaN(um) || um <= 0) return;
    const img = imgRef.current;
    onSaveCalibration(currentImage.url, {
      pixelLength: detectedPixelLength,
      micrometers: um,
      width: img?.naturalWidth,
      height: img?.naturalHeight,
      umByPx: um / detectedPixelLength,
    });
    setShowAutoDetectModal(false);
    resetCalibrationState(true);
  };

  // Modal actions
  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    resetCalibrationState(true);
  };

  const handleConfirmRedo = () => {
    setShowConfirmModal(false);
    setLineStart(null);
    setLineEnd(null);
    setLineFinished(false);
    clearCanvas();
  };

  const handleConfirmOk = () => {
    setShowConfirmModal(false);
    setShowInputModal(true);
  };

  const handleInputCancel = () => {
    setShowInputModal(false);
    setShowConfirmModal(true);
  };

  const handleInputSave = () => {
    const um = parseFloat(micrometersInput);
    if (isNaN(um) || um <= 0) return;
    const img = imgRef.current;
    onSaveCalibration(currentImage.url, {
      pixelLength,
      micrometers: um,
      width: img?.naturalWidth,
      height: img?.naturalHeight,
      umByPx: um / pixelLength,
    });
    setShowInputModal(false);
    resetCalibrationState(true);
  };

  // ---- Mask drawing helpers ----
  const DRAW_PENCIL_RADIUS_PX = 3;
  const DRAW_ERASER_RADIUS_PX = 4.5;

  const initMaskCanvas = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (!maskCanvas || !img) return;

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return;

    maskCanvas.width = naturalWidth;
    maskCanvas.height = naturalHeight;
    maskCanvas.style.width = img.clientWidth + "px";
    maskCanvas.style.height = img.clientHeight + "px";

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    if (!currentDrawUrl) return;

    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = () => {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      ctx.drawImage(tempImg, 0, 0);
    };
    tempImg.src = currentDrawUrl;
  }, [currentDrawUrl]);

  // Initialize mask canvas when a mask edit tool is selected, when
  // the stored drawing changes, or when navigating to a new image.
  useEffect(() => {
    if (maskEditTool) {
      // Small delay to ensure the canvas element and new image are in the DOM
      const t = setTimeout(() => initMaskCanvas(), 60);
      return () => clearTimeout(t);
    }
  }, [maskEditTool, initMaskCanvas, currentDrawUrl, currentIndex]);

  // Re-sync mask canvas display size when image resizes
  useEffect(() => {
    if (!maskEditTool) return;
    const maskCanvas = maskCanvasRef.current;
    const img = imgRef.current;
    if (maskCanvas && img) {
      maskCanvas.style.width = img.clientWidth + "px";
      maskCanvas.style.height = img.clientHeight + "px";
    }
  }, [editorLayout, maskEditTool]);

  const getMaskCanvasPos = (
    e: React.MouseEvent,
  ): { x: number; y: number } | null => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const paintOnMaskCanvas = (pos: { x: number; y: number }) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const scale = (scaleX + scaleY) / 2;
    const baseRadius =
      maskEditTool === "eraser" ? DRAW_ERASER_RADIUS_PX : DRAW_PENCIL_RADIUS_PX;
    const brushRadius = baseRadius * scale;

    const lastPos = lastMaskPosRef.current;

    if (maskEditTool === "pencil") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgb(0,0,0)";
      ctx.fillStyle = "rgb(0,0,0)";
      ctx.lineWidth = brushRadius * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (lastPos) {
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (maskEditTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushRadius * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (lastPos) {
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    lastMaskPosRef.current = pos;
  };

  const persistMaskEdit = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setDrawByImageUrl((prev) => {
      const next = { ...prev, [currentImage.url]: dataUrl };
      writeDrawCacheStore(next);
      return next;
    });
  }, [currentImage.url]);

  const clearCurrentDrawing = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDrawByImageUrl((prev) => {
      const next = { ...prev };
      delete next[currentImage.url];
      writeDrawCacheStore(next);
      return next;
    });
  }, [currentImage.url]);

  const handleMaskCanvasMouseDown = (e: React.MouseEvent) => {
    if (!maskEditTool) return;
    setIsMaskDrawing(true);
    lastMaskPosRef.current = null;
    const pos = getMaskCanvasPos(e);
    if (pos) paintOnMaskCanvas(pos);
  };

  const handleMaskCanvasMouseMove = (e: React.MouseEvent) => {
    if (!maskEditTool || !isMaskDrawing) return;
    const pos = getMaskCanvasPos(e);
    if (pos) paintOnMaskCanvas(pos);
  };

  const handleMaskCanvasMouseUp = () => {
    if (!maskEditTool || !isMaskDrawing) return;
    setIsMaskDrawing(false);
    lastMaskPosRef.current = null;
    persistMaskEdit();
  };

  const handleMaskCanvasMouseLeave = () => {
    if (isMaskDrawing) {
      setIsMaskDrawing(false);
      lastMaskPosRef.current = null;
      persistMaskEdit();
    }
  };

  // Modal "backdrop" style reusable
  const modalBackdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 10010,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(16,36,63,0.5)",
    backdropFilter: "blur(4px)",
  };
  const modalCardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: 28,
    boxShadow: "0 8px 32px rgba(16,36,63,0.18)",
    border: "1px solid rgba(16,36,63,0.08)",
    maxWidth: 420,
    width: "90%",
    overflow: "hidden",
  };
  const modalHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 28px 12px",
    borderBottom: "1px solid rgba(16,36,63,0.08)",
  };
  const modalTitleStyle: React.CSSProperties = {
    fontSize: "1.1rem",
    fontWeight: 700,
    margin: 0,
    color: "#339eea",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: "0.75rem",
    border: "1px solid rgba(16,36,63,0.08)",
    color: "#4d6684",
    background: "#f8fbff",
    cursor: "pointer",
    transition: "background 0.15s",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: "0.75rem",
    border: "none",
    color: "white",
    cursor: "pointer",
    transition: "opacity 0.15s",
    background: "linear-gradient(135deg, #339eea, #0d5a91)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        {/* Close button */}
        <button
          title="Cerrar"
          style={{
            background: "rgba(0,0,0,0.5)",
            border: "none",
            borderRadius: "50%",
            padding: 8,
            cursor: "pointer",
            color: "white",
            lineHeight: 0,
            transition: "background 0.15s",
          }}
          onClick={onClose}
          onMouseOver={(e) =>
            (e.currentTarget.style.background = "rgba(0,0,0,0.8)")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.background = "rgba(0,0,0,0.5)")
          }
        >
          <CloseIcon />
        </button>
      </div>

      {/* ===== Image centered in viewport (offset left to reserve context space) ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: 50,
          paddingBottom: 50,
          paddingLeft: LIGHTBOX_SIDE_MIN,
          paddingRight: MIN_CONTEXT_WIDTH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <div
          ref={imageContainerRef}
          onMouseMove={(e) => {
            const polygons = inclusionsByImageUrl?.[currentImage?.url];
            const isVisible = inclusionsVisibleByImageUrl?.[currentImage?.url];
            if (!isVisible || !polygons || polygons.length === 0) {
              setHoveredInclusion(null);
              return;
            }
            
            const img = imgRef.current;
            const container = imageContainerRef.current;
            if (!img || !container) return;
            
            const rect = img.getBoundingClientRect();
            const scaleX = img.naturalWidth / rect.width;
            const scaleY = img.naturalHeight / rect.height;
            
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            
            const x = clientX * scaleX;
            const y = clientY * scaleY;
            
            let found = null;
            for (const poly of polygons) {
              if (poly.confidence < inclusionsThreshold) continue;
              
              let inside = false;
              for (let i = 0, j = poly.points.length - 1; i < poly.points.length; j = i++) {
                const xi = poly.points[i].x, yi = poly.points[i].y;
                const xj = poly.points[j].x, yj = poly.points[j].y;
                const intersect = ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
              }
              if (inside) {
                found = poly;
                break;
              }
            }
            
            if (found) {
              const containerRect = container.getBoundingClientRect();
              setHoveredInclusion({ poly: found, x: e.clientX - containerRect.left, y: e.clientY - containerRect.top });
            } else {
              setHoveredInclusion(null);
            }
          }}
          onMouseLeave={() => setHoveredInclusion(null)}
          style={{
            maxWidth: imageMaxWidth + borderPad,
            maxHeight: imageMaxHeight + borderPad,
            overflow: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            className={(aiProcessing && !calibrationMode) ? "ai-snake-border" : undefined}
            style={{
              position: "relative",
              display: "inline-block",
              lineHeight: 0,
              padding: showAiFx ? 4 : 0,
              borderRadius: showAiFx ? 12 : 8,
              overflow: "hidden",
              background: showAiFx
                ? (aiProcessing && !calibrationMode)
                  ? `conic-gradient(from var(--border-angle), transparent 60%, ${aiFxColor} 100%)`
                  : aiFxColor
                : "transparent",
            }}
          >
            {showAiFx && (
              <div
                style={{
                  position: "absolute",
                  inset: 4,
                  background: "rgba(0,0,0,0.92)",
                  borderRadius: 8,
                  zIndex: 0,
                }}
              />
            )}
            <img
              ref={imgRef}
              src={displayedImageUrl}
              alt={
                isMeasurementOverlayVisible
                  ? `Medicion de ${currentImage.name}`
                  : currentImage.name
              }
              draggable={false}
              onLoad={syncCanvasSize}
              style={{
                display: "block",
                borderRadius: 8,
                maxWidth: imageMaxWidth,
                maxHeight: imageMaxHeight,
                position: showAiFx ? "relative" : "static",
                zIndex: showAiFx ? 1 : "auto",
              }}
            />
            {currentMaskUrl && !isMeasurementOverlayVisible ? (
              <img
                src={currentMaskUrl}
                alt={`Mascara de ${currentImage.name}`}
                draggable={false}
                style={{
                  position: "absolute",
                  top: showAiFx ? 4 : 0,
                  left: showAiFx ? 4 : 0,
                  width: showAiFx ? "calc(100% - 8px)" : "100%",
                  height: showAiFx ? "calc(100% - 8px)" : "100%",
                  objectFit: "contain",
                  borderRadius: 8,
                  opacity: isMaskVisible ? 1 : 0,
                  transition: "opacity 1960ms cubic-bezier(0.22, 1, 0.36, 1)",
                  pointerEvents: "none",
                  zIndex: showAiFx ? 2 : "auto",
                }}
              />
            ) : null}
            {maskEditTool && !isMeasurementOverlayVisible && (
              <canvas
                ref={maskCanvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  borderRadius: 8,
                  opacity: 1,
                  cursor: maskEditTool === "pencil" ? "crosshair" : "cell",
                  zIndex: 2,
                }}
                onMouseDown={handleMaskCanvasMouseDown}
                onMouseMove={handleMaskCanvasMouseMove}
                onMouseUp={handleMaskCanvasMouseUp}
                onMouseLeave={handleMaskCanvasMouseLeave}
              />
            )}
            <canvas
              ref={inclusionsCanvasRef}
              style={{
                position: "absolute",
                top: showAiFx ? 4 : 0,
                left: showAiFx ? 4 : 0,
                display: "block",
                pointerEvents: "none",
                zIndex: 3,
                borderRadius: 8,
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: showAiFx ? 4 : 0,
                left: showAiFx ? 4 : 0,
                display: isMeasurementOverlayVisible ? "none" : "block",
                cursor: calibrationMode
                  ? lineFinished
                    ? "default"
                    : "crosshair"
                  : measurementMode ? "crosshair" : "default",
                zIndex: 2,
                pointerEvents: (!isMeasurementOverlayVisible && (calibrationMode || measurementMode)) ? "auto" : "none",
              }}
                onMouseDown={(e) => {
                  if (measurementMode) {
                    handleMeasurementMouseDown(e);
                  } else {
                    handleCanvasMouseDown(e);
                  }
                }}
                onMouseMove={(e) => {
                  if (measurementMode) {
                    handleMeasurementMouseMove(e);
                  } else {
                    handleCanvasMouseMove(e);
                  }
                }}
                onMouseUp={() => {
                  if (measurementMode) {
                    handleMeasurementMouseUp();
                  } else {
                    handleCanvasMouseUp();
                  }
                }}
                onMouseLeave={() => {
                  if (measurementMode) {
                    handleMeasurementMouseLeave();
                  }
                }}
              />
            {/* Old pill removed */}
            {measurementMode &&
              measurementLabelPos &&
              measurementDistanceUm !== null && (
                <div
                  style={{
                    position: "fixed",
                    left: measurementLabelPos.x + 12,
                    top: measurementLabelPos.y - 28,
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.72)",
                    color: "white",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.2)",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
                    pointerEvents: "none",
                    zIndex: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {measurementDistanceUm.toFixed(2)} µm
                </div>
              )}
            {hoveredInclusion && (
              <div
                style={{
                  position: "absolute",
                  left: hoveredInclusion.x + 10,
                  top: hoveredInclusion.y - 20,
                  padding: "6px 12px",
                  background: "rgba(0,0,0,0.65)",
                  color: "white",
                  fontSize: "0.85rem",
                  fontFamily: "monospace, Courier New, Courier, serif",
                  borderRadius: 8,
                  pointerEvents: "none",
                  zIndex: 20,
                  whiteSpace: "nowrap",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center"
                }}
              >
                <span style={{ fontWeight: 600, color: "#4caf50" }}>{hoveredInclusion.poly.class_name}</span>
                <span style={{ opacity: 0.85 }}>{(hoveredInclusion.poly.confidence * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Left sidebar — centered in left gap ===== */}
      <div
        style={{
          position: "absolute",
          left: sidebarCenterX,
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 6,
        }}
      >
        <aside
          style={{
            width: 62,
            minHeight: currentImageIsCalibrable ? 300 : 112,
            maxHeight: `calc(100vh - 40px)`, // Ensure it fits viewport
            borderRadius: 999,
            padding: currentImageIsCalibrable ? "16px 8px 0px 8px" : "8px 8px 0px 8px", // Move bottom padding to a spacer
            background: "rgba(0,0,0,0.52)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(4px)",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: currentImageIsCalibrable
              ? "space-between"
              : "center",
            alignItems: "center",
            gap: currentImageIsCalibrable ? 12 : 8,
            boxShadow: "0 10px 30px rgba(0,0,0,0.26)",
          }}
        >
          {currentImageIsCalibrable && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: "100%",
              }}
            >
              <button
                title="Calibrar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    activeSidebarTool === "calibration" || calibrationMode
                      ? "rgba(51,158,234,0.88)"
                      : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: "pointer",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onClick={() => onCheckMicrographLimit(handleActivateCalibration)}
                onMouseOver={(e) => {
                  if (!calibrationMode)
                    e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (!calibrationMode && activeSidebarTool !== "calibration") {
                    e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                  }
                }}
              >
                <CaliperIcon />
              </button>
              {ENABLE_AUTOCALIBRATION && (
                <button
                  title="Reintentar autocalibración"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "none",
                    background: !!calibratingByUrl?.[currentImage.url]
                        ? "rgba(51,158,234,0.88)"
                        : "rgba(0,0,0,0.56)",
                    color: "white",
                    cursor: !!calibratingByUrl?.[currentImage.url] ? "wait" : "pointer",
                    lineHeight: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s, transform 0.15s",
                    opacity: !!calibratingByUrl?.[currentImage.url] ? 0.65 : 1,
                  }}
                  disabled={!!calibratingByUrl?.[currentImage.url] || !onRetryAutoCalibration}
                  onClick={() => onCheckMicrographLimit(() => {
                    if (!currentImage?.url || !!calibratingByUrl?.[currentImage.url] || !onRetryAutoCalibration) return;
                    if (!(microMaterialHasModelByUrl[currentImage.url] ?? true)) {
                      pushToast("Material no soportado.", "error", 5000);
                      return;
                    }
                    onRetryAutoCalibration(currentImage.url);
                  })}
                  onMouseOver={(e) => {
                    if (!!calibratingByUrl?.[currentImage.url]) return;
                    e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                  }}
                  onMouseOut={(e) => {
                    if (!!calibratingByUrl?.[currentImage.url]) return;
                    e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                  }}
                >
                  <RefreshIcon />
                </button>
              )}
              <button
                title={
                  !measurementEnabled
                    ? "Calibrá la micrografía para habilitar la medición"
                    : activeSidebarTool === "measurement"
                      ? "Salir de medición"
                      : "Medir"
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    activeSidebarTool === "measurement"
                      ? "rgba(51,158,234,0.88)"
                      : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: measurementEnabled ? "pointer" : "default",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: measurementEnabled ? 1 : 0.55,
                }}
                onClick={() => onCheckMicrographLimit(() => {
                  if (!measurementEnabled) return;
                  handleActivateMeasurement();
                })}
                onMouseOver={(e) => {
                  if (
                    !measurementEnabled ||
                    activeSidebarTool === "measurement"
                  )
                    return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (
                    !measurementEnabled ||
                    activeSidebarTool === "measurement"
                  )
                    return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <RulerIcon />
              </button>
              <button
                title={
                  isMaskLoading
                    ? "Generando mascara..."
                    : currentMaskUrl
                      ? isMaskVisible
                        ? "Desenmascarar"
                        : "Enmascarar"
                      : "Enmascarar"
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: isMaskVisible
                    ? "rgba(51,158,234,0.88)"
                    : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: isMaskLoading ? "wait" : "pointer",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: isMaskLoading ? 0.65 : 1,
                }}
                disabled={isMaskLoading}
                onClick={() => onCheckMicrographLimit(() => {
                  if (isMaskVisible) {
                    setActiveSidebarTool("overview");
                  } else {
                    setActiveSidebarTool("mask");
                  }
                  void onGenerateMask(currentImage.url);
                })}
                onMouseOver={(e) => {
                  if (isMaskLoading || isMaskVisible) return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (isMaskLoading || isMaskVisible) return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <MaskIcon />
              </button>
              {/* ---- Inclusions tool ---- */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <button
                  title={
                    inclusionsLoadingByImageUrl?.[currentImage.url]
                      ? "Detectando inclusiones..."
                      : inclusionsVisibleByImageUrl?.[currentImage.url]
                        ? "Ocultar Inclusiones"
                        : "Detectar Inclusiones"
                  }
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: "none",
                    background: inclusionsVisibleByImageUrl?.[currentImage.url]
                      ? "rgba(51,158,234,0.88)"
                      : "rgba(0,0,0,0.56)",
                    color: "white",
                    cursor: inclusionsLoadingByImageUrl?.[currentImage.url] ? "wait" : "pointer",
                    lineHeight: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s",
                    opacity: inclusionsLoadingByImageUrl?.[currentImage.url] ? 0.65 : 1,
                  }}
                  disabled={inclusionsLoadingByImageUrl?.[currentImage.url]}
                  onClick={() => onCheckMicrographLimit(() => {
                    if (onDetectInclusiones) {
                      void onDetectInclusiones(currentImage.url);
                    }
                  })}
                  onMouseOver={(e) => {
                    if (inclusionsLoadingByImageUrl?.[currentImage.url] || inclusionsVisibleByImageUrl?.[currentImage.url]) return;
                    e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                  }}
                  onMouseOut={(e) => {
                    if (inclusionsLoadingByImageUrl?.[currentImage.url] || inclusionsVisibleByImageUrl?.[currentImage.url]) return;
                    e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                  }}
                >
                  <InclusionsIcon />
                </button>
                {inclusionsVisibleByImageUrl?.[currentImage.url] && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ 
                      fontSize: 12, 
                      fontWeight: "bold", 
                      color: "white", 
                      userSelect: "none",
                      background: "rgba(0,0,0,0.56)",
                      padding: "4px 8px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                      {(inclusionsThreshold * 100).toFixed(0)}%
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={inclusionsThreshold}
                      onChange={(e) => setInclusionsThreshold(parseFloat(e.target.value))}
                      title={`Threshold de confianza: ${(inclusionsThreshold * 100).toFixed(0)}%`}
                      style={{
                        height: 100,
                        width: 40,
                        writingMode: "vertical-lr",
                        direction: "rtl",
                        accentColor: "#339eea",
                        cursor: "pointer",
                        margin: 0
                      }}
                    />
                  </div>
                )}
              </div>
              {/* ---- Chart tool ---- */}
              <button
                title={
                  !currentMeasurementOverlayUrl
                    ? "Gráfico de medición no disponible"
                    : isMeasurementOverlayVisible
                      ? "Ocultar gráfico de medición"
                      : "Ver gráfico de medición"
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: isMeasurementOverlayVisible
                    ? "rgba(51,158,234,0.88)"
                    : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: "pointer",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: currentMeasurementOverlayUrl ? 1 : 0.55,
                }}
                disabled={false}
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckMicrographLimit(() => {
                    if (!(microMaterialHasModelByUrl[currentImage.url] ?? true)) {
                      pushToast("Material no soportado.", "error", 5000);
                      return;
                    }
                    if (currentMeasurementOverlayUrl) {
                      onToggleMeasurementOverlay?.(currentImage.url);
                    }
                  });
                }}
                onMouseOver={(e) => {
                  if (!currentMeasurementOverlayUrl || isMeasurementOverlayVisible) return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (!currentMeasurementOverlayUrl || isMeasurementOverlayVisible) return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <ChartIcon />
              </button>
              {/* ---- Pencil tool ---- */}
              <button
                title="Lápiz (pintar negro)"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    maskEditTool === "pencil"
                      ? "rgba(51,158,234,0.88)"
                      : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: "pointer",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: 1,
                }}
                onClick={() => onCheckMicrographLimit(() => {
                  setActiveSidebarTool("mask");
                  setMaskEditTool((prev) =>
                    prev === "pencil" ? null : "pencil",
                  );
                })}
                onMouseOver={(e) => {
                  if (maskEditTool === "pencil") return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (maskEditTool === "pencil") return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <PencilIcon />
              </button>
              {/* ---- Eraser tool ---- */}
              <button
                title="Goma (borrar máscara)"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    maskEditTool === "eraser"
                      ? "rgba(51,158,234,0.88)"
                      : "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: "pointer",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: 1,
                }}
                onClick={() => onCheckMicrographLimit(() => {
                  setActiveSidebarTool("mask");
                  setMaskEditTool((prev) =>
                    prev === "eraser" ? null : "eraser",
                  );
                })}
                onMouseOver={(e) => {
                  if (maskEditTool === "eraser") return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (maskEditTool === "eraser") return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <EraserIcon />
              </button>
              <button
                title="Limpiar dibujo"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.56)",
                  color: "white",
                  cursor: isDrawingToolActive ? "pointer" : "default",
                  lineHeight: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                  opacity: isDrawingToolActive ? 1 : 0.45,
                }}
                disabled={!isDrawingToolActive}
                onClick={() => onCheckMicrographLimit(() => {
                  if (!isDrawingToolActive) return;
                  clearCurrentDrawing();
                })}
                onMouseOver={(e) => {
                  if (!isDrawingToolActive) return;
                  e.currentTarget.style.background = "rgba(51,158,234,0.78)";
                }}
                onMouseOut={(e) => {
                  if (!isDrawingToolActive) return;
                  e.currentTarget.style.background = "rgba(0,0,0,0.56)";
                }}
              >
                <TrashIcon />
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: currentImageIsCalibrable ? 4 : 0,
            }}
          >
            <button
              title={
                hasSiblingImages
                  ? "Imagen anterior"
                  : "Sin micrografías hermanas"
              }
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.56)",
                color: "white",
                cursor: hasSiblingImages ? "pointer" : "default",
                lineHeight: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
                opacity: hasSiblingImages ? 1 : 0.55,
              }}
              onClick={() => {
                if (!hasSiblingImages) return;
                setCurrentIndex((p) => (p > 0 ? p - 1 : images.length - 1));
              }}
              onMouseOver={(e) => {
                if (!hasSiblingImages) return;
                e.currentTarget.style.background = "rgba(51,158,234,0.78)";
              }}
              onMouseOut={(e) => {
                if (!hasSiblingImages) return;
                e.currentTarget.style.background = "rgba(0,0,0,0.56)";
              }}
            >
              <ArrowLeftIcon />
            </button>

            <button
              title={
                hasSiblingImages
                  ? "Imagen siguiente"
                  : "Sin micrografías hermanas"
              }
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.56)",
                color: "white",
                cursor: hasSiblingImages ? "pointer" : "default",
                lineHeight: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
                opacity: hasSiblingImages ? 1 : 0.55,
              }}
              onClick={() => {
                if (!hasSiblingImages) return;
                setCurrentIndex((p) => (p < images.length - 1 ? p + 1 : 0));
              }}
              onMouseOver={(e) => {
                if (!hasSiblingImages) return;
                e.currentTarget.style.background = "rgba(51,158,234,0.78)";
              }}
              onMouseOut={(e) => {
                if (!hasSiblingImages) return;
                e.currentTarget.style.background = "rgba(0,0,0,0.56)";
              }}
            >
              <ArrowRightIcon />
            </button>
          </div>
          <div style={{ flexShrink: 0, height: 16, width: "100%" }} />
        </aside>
      </div>

      {/* ===== Right context panel — header/main/footer, 80% height ===== */}
      <div
        style={{
          position: "absolute",
          left: contextCenterX,
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 3,
          width: Math.max(150, contextGapWidth - 20),
          height: "80%",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ---- HEADER (25%) ---- */}
        <div
          style={{
            flex: "0 0 25%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: 6,
            padding: "8px 10px",
            color: "white",
            textAlign: "left",
          }}
        >
          {aiSuccess && !calibrationMode && ENABLE_AUTOCALIBRATION && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(74, 222, 128, 0.15)",
                border: "1px solid #4ade80",
                boxShadow: "0 0 12px rgba(74, 222, 128, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4ade80" }}>
                Autocalibración con Inteligencia Artificial
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "white" }}>
                Autocalibración exitosa
              </div>
            </div>
          )}
          {aiProcessing && !calibrationMode && ENABLE_AUTOCALIBRATION && (
            <div
              className="ai-shimmer-bg"
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "linear-gradient(90deg, rgba(232, 163, 23, 0.1) 0%, rgba(232, 163, 23, 0.4) 50%, rgba(232, 163, 23, 0.1) 100%)",
                border: "1px solid #e8a317",
                boxShadow: "0 0 12px rgba(232, 163, 23, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#e8a317" }}>
                Autocalibración con Inteligencia Artificial
              </div>
              <div
                className="ai-shimmer-text"
                style={{ background: "linear-gradient(90deg, #e8a317 0%, #fff 50%, #e8a317 100%)", fontSize: "0.88rem", fontWeight: 600 } as React.CSSProperties}
              >
                Autocalibrando...
              </div>
            </div>
          )}
          {aiError && !hasCalibration && !calibrationMode && ENABLE_AUTOCALIBRATION && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(248, 113, 113, 0.15)",
                border: "1px solid #f87171",
                boxShadow: "0 0 12px rgba(248, 113, 113, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f87171" }}>
                Autocalibración con Inteligencia Artificial
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "white" }}>
                Error al autocalibrar. Calibrar manualmente
              </div>
            </div>
          )}
          <div
            style={{
              fontSize: "0.76rem",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#99d1ff",
            }}
          >
            {toolTitle}
          </div>
          <div
            style={{
              fontSize: "0.92rem",
              fontWeight: 700,
              lineHeight: 1.3,
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            {currentImage.name}
          </div>
          {(contextInfo.regionName ||
            contextInfo.muestraName ||
            contextInfo.materialName) && (
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 500,
                lineHeight: 1.4,
                opacity: 0.8,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {contextInfo.regionName && <span>{contextInfo.regionName}</span>}
              {contextInfo.muestraName && (
                <span>{contextInfo.muestraName}</span>
              )}
              {contextInfo.materialName && (
                <span>{contextInfo.materialName}</span>
              )}
            </div>
          )}
        </div>

        {/* ---- MAIN (50%) ---- */}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 12,
            padding: "8px 10px",
            color: "white",
            textAlign: "left",
            overflow: "auto",
          }}
        >
          {activeSidebarTool === "overview" ? (
            <div
              style={{
                fontSize: "0.84rem",
                lineHeight: 1.5,
                fontWeight: 500,
                opacity: 0.7,
              }}
            >
              Selecciona una de las herramientas de la barra lateral izquierda
              para ver más información aquí.
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: "0.84rem",
                  lineHeight: 1.45,
                  fontWeight: 500,
                }}
              >
                {toolDescription}
              </div>

              {isDrawingToolActive && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.82rem",
                    lineHeight: 1.35,
                    fontWeight: 600,
                  }}
                >
                  <span>Herramienta: {drawingToolLabel}</span>
                  <span>
                    Dibujos: visibles mientras la herramienta esta activa
                  </span>
                </div>
              )}

              {activeSidebarTool === "measurement" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.82rem",
                    lineHeight: 1.35,
                    fontWeight: 600,
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  {measurementEnabled ? (
                    <>
                      <span>
                        Calibración: {calibrationRatio?.toFixed(4)} µm/px
                      </span>
                      {currentCalibration?.pixelLength > 0 && currentCalibration?.micrometers > 0 && (
                        <span>
                          Medida base: {currentCalibration.micrometers} µm en {currentCalibration.pixelLength.toFixed(1)} px
                        </span>
                      )}
                      {measurementDistanceUm ? (
                        <span>
                          Medición actual: {measurementDistanceUm.toFixed(2)} µm
                          ({measurementPx.toFixed(1)} px)
                        </span>
                      ) : (
                        <span>Arrastra sobre la imagen para medir.</span>
                      )}
                    </>
                  ) : (
                    <span>
                      Primero calibrá la micrografía para habilitar la medición.
                    </span>
                  )}
                </div>
              )}

              {activeSidebarTool === "calibration" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.82rem",
                    lineHeight: 1.35,
                    fontWeight: 600,
                  }}
                >
                  <span>Estado: {calibrationStateLabel}</span>
                  {calibrationRatio && (
                    <>
                      <span>
                        Calibración: {calibrationRatio.toFixed(4)} µm/px
                      </span>
                      {currentCalibration.pixelLength > 0 &&
                        currentCalibration.micrometers > 0 && (
                          <span>
                            {currentCalibration.pixelLength} px ={" "}
                            {currentCalibration.micrometers} µm
                          </span>
                        )}
                    </>
                  )}
                </div>
              )}

              {activeSidebarTool === "mask" &&
                !isDrawingToolActive &&
                (isMaskVisible || isMaskLoading) && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                      {isMaskLoading
                        ? "Estado: generando máscara"
                        : currentMaskUrl
                          ? isMaskVisible
                            ? "Estado: máscara visible (65%)"
                            : "Estado: máscara oculta"
                          : "Estado: sin máscara generada"}
                    </span>
                    {maskLegendEntries.length > 0 ? (
                      <div
                        style={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {maskLegendEntries.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              lineHeight: 1.25,
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                border: "1px solid rgba(255,255,255,0.48)",
                                background: `rgb(${entry.color[0]}, ${entry.color[1]}, ${entry.color[2]})`,
                                flexShrink: 0,
                              }}
                            />
                            <span>
                              {entry.name} ({entry.colorLabel})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                        No hay clases disponibles para esta imagen.
                      </span>
                    )}
                  </div>
                )}
            </>
          )}
        </div>

        {/* ---- FOOTER (25%) ---- */}
        <div
          style={{
            flex: "0 0 25%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 4,
            padding: "8px 10px",
            color: "white",
            textAlign: "left",
            fontSize: "0.78rem",
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          <div>
            Imagen {currentIndex + 1} de {images.length}
          </div>
          <div
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(51, 158, 234, 0.15)",
              border: "1px solid #339eea",
              boxShadow: "0 0 12px rgba(51, 158, 234, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#339eea", textAlign: "center", marginBottom: 4 }}>
              Información de calibración
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>Micrómetros:</span>
              <span style={{ fontWeight: 600 }}>{hasCalibration && currentCalibration?.micrometers ? currentCalibration.micrometers : "-"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>Píxeles:</span>
              <span style={{ fontWeight: 600 }}>{hasCalibration && currentCalibration?.pixelLength ? currentCalibration.pixelLength.toFixed(1) : "-"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>Ratio:</span>
              <span style={{ fontWeight: 600 }}>{calibrationRatio ? `${calibrationRatio.toFixed(4)} µm/px` : "-"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- MODAL: Confirm calibration ---- */}
      {showConfirmModal && (
        <div style={modalBackdropStyle} onClick={(e) => e.stopPropagation()}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Confirmar medida</h3>
            </div>
            <div style={{ padding: "20px 28px" }}>
              <p
                style={{
                  color: "#4d6684",
                  fontSize: "0.875rem",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Línea detectada:{" "}
                <strong style={{ color: "#339eea" }}>
                  {pixelLength} píxeles
                </strong>
                . ¿Continuar?
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                padding: "0 28px 20px",
              }}
            >
              <button style={btnSecondary} onClick={handleConfirmCancel}>
                Cancelar
              </button>
              <button
                style={{
                  ...btnSecondary,
                  color: "#e8a317",
                  borderColor: "rgba(232,163,23,0.3)",
                }}
                onClick={handleConfirmRedo}
              >
                Rehacer
              </button>
              <button style={btnPrimary} onClick={handleConfirmOk}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL: Input micrometers ---- */}
      {showInputModal && (
        <div style={modalBackdropStyle} onClick={(e) => e.stopPropagation()}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Ingresar medida</h3>
            </div>
            <div style={{ padding: "20px 28px" }}>
              <p
                style={{
                  color: "#4d6684",
                  fontSize: "0.875rem",
                  margin: "0 0 16px",
                  lineHeight: 1.6,
                }}
              >
                Ingresá el valor de la escala ({pixelLength} px).
              </p>
              <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={micrometersInput}
                  onChange={(e) => setMicrometersInput(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "12px 0 0 12px",
                    border: "1px solid rgba(16,36,63,0.14)",
                    borderRight: "none",
                    fontSize: "0.9rem",
                    color: "#10243f",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#339eea")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(16,36,63,0.14)")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInputSave();
                  }}
                  placeholder="100"
                />
                <div
                  style={{
                    padding: "10px 16px",
                    background: "#f0f4f8",
                    borderRadius: "0 12px 12px 0",
                    border: "1px solid rgba(16,36,63,0.14)",
                    borderLeft: "none",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#4d6684",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  µm
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                padding: "0 28px 20px",
              }}
            >
              <button style={btnSecondary} onClick={handleInputCancel}>
                Cancelar
              </button>
              <button style={btnPrimary} onClick={handleInputSave}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL: Auto-Detect Calibration ---- */}
      {showAutoDetectModal && (
        <div style={modalBackdropStyle} onClick={(e) => e.stopPropagation()}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Autodetección de escala</h3>
            </div>
            <div style={{ padding: "20px 28px" }}>
              <p
                style={{
                  color: "#4d6684",
                  fontSize: "0.875rem",
                  margin: "0 0 16px",
                  lineHeight: 1.6,
                }}
              >
                Se detectó una escala de{" "}
                <strong style={{ color: "#339eea" }}>
                  {detectedPixelLength} px
                </strong>
                . Ingresá µm para confirmar o calibrá manualmente.
              </p>
              <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={micrometersInput}
                  onChange={(e) => setMicrometersInput(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "12px 0 0 12px",
                    border: "1px solid rgba(16,36,63,0.14)",
                    borderRight: "none",
                    fontSize: "0.9rem",
                    color: "#10243f",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#339eea")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(16,36,63,0.14)")
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAutoDetectSave();
                  }}
                  placeholder="100"
                />
                <div
                  style={{
                    padding: "10px 16px",
                    background: "#f0f4f8",
                    borderRadius: "0 12px 12px 0",
                    border: "1px solid rgba(16,36,63,0.14)",
                    borderLeft: "none",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#4d6684",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  µm
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                padding: "0 28px 20px",
              }}
            >
              <button
                style={{
                  ...btnSecondary,
                  background: "transparent",
                  border: "none",
                  padding: "8px",
                }}
                onClick={() => {
                  setShowAutoDetectModal(false);
                  resetCalibrationState(true);
                }}
              >
                Cancelar
              </button>
              <button
                style={{
                  ...btnSecondary,
                  color: "#4d6684",
                  borderColor: "rgba(16,36,63,0.14)",
                }}
                onClick={handleAutoDetectCancel}
              >
                Calibrar manualmente
              </button>
              <button style={btnPrimary} onClick={handleAutoDetectSave}>
                Confirmar calibración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { Group, Panel, Separator } from "react-resizable-panels";

function ResizeHandle() {
  return (
    <Separator
      className="flex items-center justify-center w-2 group cursor-col-resize hover:bg-[#339eea11] transition-colors z-10"
      style={{ position: 'relative', width: '8px' }}
    >
      <div className="w-1 h-8 rounded-full bg-[#339eea44] group-hover:bg-[#339eea] transition-colors" />
    </Separator>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
interface FileManagerProps {
  onLogout?: () => void;
  showAdmin?: boolean;
  showGallery?: boolean;
  showReports?: boolean;
  showAssistant?: boolean;
}

export default function FileManager({ 
  onLogout, 
  showAdmin = true,
  showGallery = true,
  showReports = true,
  showAssistant = true
}: FileManagerProps) {
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  );

  const [showAdminLegend, setShowAdminLegend] = useState(false);
  const [showGalleryLegend, setShowGalleryLegend] = useState(false);

  const [companyEnabled, setCompanyEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("company_enabled") === "true";
    }
    return true;
  });

  const [showDisabledCompanyModal, setShowDisabledCompanyModal] = useState<boolean>(!companyEnabled);



  const apiOrigin = useMemo(() => {
    try {
      return new URL(api.BASE_URL).origin;
    } catch {
      return "";
    }
  }, []);

  const [apiMuestras, setApiMuestras] = useState<ApiMuestra[]>([]);
  const [apiMateriales, setApiMateriales] = useState<api.ApiMaterial[]>([]);
  const [apiRegiones, setApiRegiones] = useState<ApiRegion[]>([]);
  const [apiMicrografias, setApiMicrografias] = useState<ApiMicrografia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maskByImageUrl, setMaskByImageUrl] = useState<Record<string, string>>(
    {},
  );
  const [maskLabelsByImageUrl, setMaskLabelsByImageUrl] = useState<
    Record<string, api.HfMaskLabels>
  >({});
  const [maskVisibleByImageUrl, setMaskVisibleByImageUrl] = useState<
    Record<string, boolean>
  >({});
  const [maskLoadingByImageUrl, setMaskLoadingByImageUrl] = useState<
    Record<string, boolean>
  >({});
  const [queuedPdfMuestraIds, setQueuedPdfMuestraIds] = useState<Set<string>>(
    new Set(),
  );
  const [dirtyPdfMuestraIds, setDirtyPdfMuestraIds] = useState<Set<string>>(
    new Set(),
  );
  const [calibratingByUrl, setCalibratingByUrl] = useState<Record<string, boolean>>({});
  const [failedCalibrationByUrl, setFailedCalibrationByUrl] = useState<Record<string, boolean>>({});
  const [inclusionsByImageUrl, setInclusionsByImageUrl] = useState<Record<string, api.InclusionPolygon[]>>({});
  const [inclusionsVisibleByImageUrl, setInclusionsVisibleByImageUrl] = useState<Record<string, boolean>>({});
  const [inclusionsLoadingByImageUrl, setInclusionsLoadingByImageUrl] = useState<Record<string, boolean>>({});


  // Derived state for the UI
  const fixImageUrl = useCallback(
    (url: string | undefined | null) => {
      if (!url) return "";
      const buildApiUrl = (pathWithQuery: string) =>
        apiOrigin ? `${apiOrigin}${pathWithQuery}` : pathWithQuery;
      const buildCloudinaryUrl = (fragment: string) =>
        CLOUDINARY_BASE_URL
          ? `${CLOUDINARY_BASE_URL}${fragment.replace(/^\/+/, "")}`
          : fragment;

      if (url.startsWith("http://") || url.startsWith("https://")) {
        try {
          const u = new URL(url);
          if (u.pathname.startsWith("/media/")) {
            return buildApiUrl(`${u.pathname}${u.search}`);
          }
        } catch {
          return url;
        }
        return url;
      }

      if (url.startsWith("/media/")) {
        return buildApiUrl(url);
      }

      if (
        CLOUDINARY_BASE_URL &&
        (url.startsWith("image/upload/") || url.startsWith("/image/upload/"))
      ) {
        return buildCloudinaryUrl(url);
      }

      return url;
    },
    [apiOrigin],
  );

  const microInfoByUrl = useMemo(() => {
    const map: Record<string, { rawId: string; umByPx: number | null }> = {};
    apiMicrografias.forEach((mic) => {
      const url = fixImageUrl(mic.imagen);
      if (!url) return;
      map[url] = {
        rawId: String(mic.id),
        umByPx:
          mic.um_by_px !== undefined && mic.um_by_px !== null
            ? Number(mic.um_by_px)
            : null,
      };
    });
    return map;
  }, [apiMicrografias, fixImageUrl]);

  const calibratedByUrl = useMemo(() => {
    const map: Record<string, boolean> = {};
    Object.entries(microInfoByUrl).forEach(([url, info]) => {
      map[url] = typeof info.umByPx === "number" && info.umByPx > 0;
    });
    return map;
  }, [microInfoByUrl]);

  const materials: Material[] = useMemo(
    () =>
      apiMateriales.map((material) => {
        const muestrasDelMaterial = apiMuestras.filter(
          (mue) => String(mue.material) === String(material.id),
        );

        const muestraImage = muestrasDelMaterial[0]?.imagen
          ? fixImageUrl(muestrasDelMaterial[0].imagen)
          : "";

        return {
          id: `mat_${material.id}`,
          name: material.nombre,
          image: muestraImage,
          muestras: muestrasDelMaterial.map((mue) => ({
            id: `mue_${mue.id}`,
            name: mue.nombre,
            image: fixImageUrl(mue.imagen),
            regiones: apiRegiones
              .filter((r) => String(r.muestra) === String(mue.id))
              .map((reg) => ({
                id: `reg_${reg.id}`,
                name: reg.nombre,
                image: fixImageUrl(reg.imagen),
                micrografias: apiMicrografias
                  .filter((mic) => String(mic.region) === String(reg.id))
                  .map((mic) => ({
                    id: `mic_${mic.id}`,
                    rawId: String(mic.id),
                    name: mic.nombre,
                    url: fixImageUrl(mic.imagen),
                    umByPx:
                      mic.um_by_px !== undefined && mic.um_by_px !== null
                        ? Number(mic.um_by_px)
                        : null,
                  })),
              })),
          })),
        };
      }),
    [apiMateriales, apiMuestras, apiRegiones, apiMicrografias, fixImageUrl],
  );

  // Extract raw API id from namespaced id (e.g. "mue_42" → "42")
  const apiId = (namespacedId: string) =>
    namespacedId.replace(/^(mat|mue|reg|mic)_/, "");

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [m, mats, r, img, companyStatus] = await Promise.all([
        api.getMuestras(),
        api.getMateriales(),
        api.getRegiones(),
        api.getMicrografias(),
        api.getCompanyStatus(),
      ]);
      setApiMuestras(m);
      setApiMateriales(mats);
      setApiRegiones(r);
      setApiMicrografias(img);
      
      if (companyStatus !== companyEnabled) {
        setCompanyEnabled(companyStatus);
        setShowDisabledCompanyModal(!companyStatus);
        if (typeof window !== "undefined") {
          localStorage.setItem("company_enabled", companyStatus ? "true" : "false");
        }
      }
      return { m, mats, r, img };
    } catch (err) {
      console.error(err);
      if (typeof window !== "undefined" && String(err).includes("401")) {
        setToken(null);
        api.logout();
        if (onLogout) onLogout();
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window !== "undefined" && !token) {
      if (onLogout) onLogout();
      return;
    }
    fetchAll();
  }, [fetchAll, token]);

  useEffect(() => {
    if (companyEnabled) {
      connectNotificationsWebSocket(token);
    } else {
      disconnectNotificationsWebSocket();
    }
    return () => disconnectNotificationsWebSocket();
  }, [companyEnabled, token]);

  const hasInitializedLastMicrometers = useRef(false);

  useEffect(() => {
    const nextCalibrationData: Record<string, CalibrationInfo> = {};
    const nextFailed: Record<string, boolean> = {};
    let rememberedMicrometers = 0;
    const verticesCache = readVerticesCacheStore();

    apiMicrografias.forEach((mic) => {
      const imageUrl = fixImageUrl(mic.imagen);
      if (!imageUrl) return;

      if ((mic as any).calibration_failed) {
        nextFailed[imageUrl] = true;
      }

      if (mic.um_by_px && mic.um_by_px > 0) {
          const calInfo: CalibrationInfo = {
            umByPx: Number(mic.um_by_px),
            isAi: !!mic.is_ai,
            pixelLength: mic.pixel_length ? Number(mic.pixel_length) : 0,
            micrometers: mic.micrometers ? Number(mic.micrometers) : 0,
          };
          // Merge cached vertices if available for this URL
          const cached = verticesCache[imageUrl];
          if (cached && cached.vertices && mic.is_ai) {
            calInfo.vertices = cached.vertices;
            calInfo.sourceWidth = cached.sourceWidth;
            calInfo.sourceHeight = cached.sourceHeight;
          }
          nextCalibrationData[imageUrl] = calInfo;
          if (mic.micrometers && mic.micrometers > 0) {
            rememberedMicrometers = Number(mic.micrometers);
          }
      }
    });

    setCalibrationData((prev) => {
      const merged = { ...nextCalibrationData };
      for (const key in merged) {
        if (prev[key]) {
          if (prev[key].width) merged[key].width = prev[key].width;
          if (prev[key].height) merged[key].height = prev[key].height;
        }
      }
      return merged;
    });
    setFailedCalibrationByUrl(prev => ({ ...prev, ...nextFailed }));
    
    if (rememberedMicrometers > 0 && !hasInitializedLastMicrometers.current) {
      setLastMicrometers(rememberedMicrometers);
      hasInitializedLastMicrometers.current = true;
    }
  }, [apiMicrografias, fixImageUrl]);

  const microInfoByUrlRef = useRef(microInfoByUrl);
  useEffect(() => { microInfoByUrlRef.current = microInfoByUrl; }, [microInfoByUrl]);

  useEffect(() => {
    const handleCalibrationStarted = (e: any) => {
      const { url } = e.detail;
      setCalibratingByUrl((prev) => ({ ...prev, [url]: true }));
      setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: false }));
    };
    const handleCalibrationUpdated = (e: any) => {
      const { url, data } = e.detail;
      const info = microInfoByUrlRef.current[url];
      
      const existing = calibrationDataRef.current[url];
      if (existing && existing.isAi === false) {
         setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
         window.dispatchEvent(new CustomEvent("show_toast", { detail: { message: "Autocalibración por IA lista, no se aplica el resultado por micrografía ya calibrada manualmente", type: "warning" } }));
         return;
      }
      
      setCalibrationData((prev) => ({ ...prev, [url]: data }));
      setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
      setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: false }));
      // Persist vertices to localStorage
      if (data.vertices && data.vertices.length > 0) {
        const freshVerticesCache = readVerticesCacheStore();
        freshVerticesCache[url] = {
          vertices: data.vertices,
          sourceWidth: data.sourceWidth || 0,
          sourceHeight: data.sourceHeight || 0,
        };
        writeVerticesCacheStore(freshVerticesCache);
      }
      // Persist to backend and update local state
      if (info?.rawId && data?.umByPx) {
        const fd = new FormData();
        fd.append("um_by_px", String(data.umByPx));
        fd.append("is_ai", "true");
        if (data.pixelLength) fd.append("pixel_length", String(data.pixelLength));
        if (data.micrometers) fd.append("micrometers", String(data.micrometers));

        api.updateMicrografia(info.rawId, fd).then(() => {
          setApiMicrografias((prev) =>
            prev.map((m) =>
              String(m.id) === info.rawId
                ? { ...m, um_by_px: data.umByPx, is_ai: true, pixel_length: data.pixelLength, micrometers: data.micrometers }
                : m,
            ),
          );
        }).catch((err) => console.error("Error persisting auto-calibration", err));
      }
    };
    const handleCalibrationFailed = (e: any) => {
      const { url } = e.detail;
      
      const existing = calibrationDataRef.current[url];
      if (existing && existing.isAi === false) {
         setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
         window.dispatchEvent(new CustomEvent("show_toast", { detail: { message: "Autocalibración por IA fallida, micrografía ya calibrada manualmente", type: "warning" } }));
         return;
      }

      setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
      setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: true }));

      const info = microInfoByUrlRef.current[url];
      if (info?.rawId) {
        const fd = new FormData();
        fd.append("calibration_failed", "true");
        api.updateMicrografia(info.rawId, fd).then(() => {
          setApiMicrografias((prev) =>
            prev.map((m) =>
              String(m.id) === info.rawId
                ? { ...m, calibration_failed: true } as any
                : m,
            ),
          );
        }).catch((err) => console.error("Error persisting auto-calibration failure", err));
      }
    };
    window.addEventListener("calibration_started", handleCalibrationStarted);
    window.addEventListener("calibration_updated", handleCalibrationUpdated);
    window.addEventListener("calibration_failed", handleCalibrationFailed);
    return () => {
      window.removeEventListener("calibration_started", handleCalibrationStarted);
      window.removeEventListener("calibration_updated", handleCalibrationUpdated);
      window.removeEventListener("calibration_failed", handleCalibrationFailed);
    };
  }, []);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      toastTimeoutsRef.current = [];
    };
  }, []);



  // Expanded folder ids
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Gallery view
  const [galleryView, setGalleryView] = useState<GalleryView>({ kind: "none" });
  const [galleryTitle, setGalleryTitle] = useState("Seleccione un elemento");
  const [measureEventsById, setMeasureEventsById] =
    useState<Record<string, MicrographyMeasureCompletedEvent>>({});
  const [measurementOverlayVisibleByUrl, setMeasurementOverlayVisibleByUrl] =
    useState<Record<string, boolean>>({});
  const missingActiveMicrografiaRefreshRef = useRef<string | null>(null);

  // Derive context info for the lightbox from the selected node in the tree
  const lightboxContextInfo = useMemo(() => {
    const info: {
      materialName?: string;
      muestraName?: string;
      regionName?: string;
    } = {};
    if (!selectedId) return info;
    for (const mat of materials) {
      if (mat.id === selectedId) {
        info.materialName = mat.name;
        return info;
      }
      for (const mue of mat.muestras) {
        if (mue.id === selectedId) {
          info.materialName = mat.name;
          info.muestraName = mue.name;
          return info;
        }
        for (const reg of mue.regiones) {
          if (reg.id === selectedId) {
            info.materialName = mat.name;
            info.muestraName = mue.name;
            info.regionName = reg.name;
            return info;
          }
          for (const mic of reg.micrografias) {
            if (mic.id === selectedId) {
              info.materialName = mat.name;
              info.muestraName = mue.name;
              info.regionName = reg.name;
              return info;
            }
          }
        }
      }
    }
    return info;
  }, [selectedId, materials]);

  // UI
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<
    { name: string; url: string }[]
  >([]);
  const [calibrationData, setCalibrationData] = useState<
    Record<string, CalibrationInfo>
  >({});
  const calibrationDataRef = useRef(calibrationData);
  useEffect(() => { calibrationDataRef.current = calibrationData; }, [calibrationData]);
  const [lastMicrometers, setLastMicrometers] = useState<number>(100);
  const [toastNotifications, setToastNotifications] = useState<
    ToastNotification[]
  >([]);
  const MAX_VISIBLE_TOASTS = 10;
  const toastIdRef = useRef(0);
  const toastTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [renameModal, setRenameModal] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [renameModalError, setRenameModalError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{
    parentId: string | number;
    type: "material" | "muestra" | "region" | "micrografia";
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const removeToast = useCallback((id: number) => {
    setToastNotifications((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    const timeout = setTimeout(() => {
      setToastNotifications((prev) => prev.filter((t) => t.id !== id));
    }, 260);
    toastTimeoutsRef.current.push(timeout);
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      tone: "error" | "info" | "success" | "warning" = "error",
      dismissDelayMs = 7200,
    ) => {
      const id = ++toastIdRef.current;
      const titleByTone = {
        success: "Correcto",
        error: "Error",
        info: "Información",
        warning: "Advertencia",
      } as const;
      const nextToast: ToastNotification = {
        id,
        title: titleByTone[tone],
        message,
        tone,
        durationMs: dismissDelayMs,
        leaving: false,
      };
      setToastNotifications((prev) => {
        const active = prev.filter((t) => !t.leaving);
        return [...active, nextToast].slice(-MAX_VISIBLE_TOASTS);
      });
      const timeout = setTimeout(() => removeToast(id), dismissDelayMs);
      toastTimeoutsRef.current.push(timeout);
      return id;
    },
    [removeToast],
  );

  const checkMicrographLimit = useCallback((action: () => void) => {
    if (!companyEnabled) {
      pushToast(`Tu compañía no está habilitada aún.`, "error", 5000);
    } else {
      action();
    }
  }, [companyEnabled, pushToast]);

  useEffect(() => {
    const handleShowToast = (e: any) => {
      pushToast(e.detail.message, e.detail.type || "warning", e.detail.duration || 6000);
    };
    window.addEventListener("show_toast", handleShowToast);
    return () => window.removeEventListener("show_toast", handleShowToast);
  }, [pushToast]);

  useEffect(() => {
    const handleMeasureCompleted = (event: Event) => {
      const payload = (event as CustomEvent<MicrographyMeasureCompletedEvent>)
        .detail;
      const microId = normalizeId(payload?.micrografia_id);
      if (!microId) return;

      setMeasureEventsById((prev) => ({
        ...prev,
        [microId]: payload,
      }));
      
      if (payload?.status === "completed") {
        if (payload?.is_valid) {
          window.dispatchEvent(new CustomEvent("show_toast", { detail: { message: "Gráfico procesado correctamente", type: "success" } }));
        } else if (payload?.is_valid === false) {
          window.dispatchEvent(new CustomEvent("show_toast", { detail: { message: "Error al procesar el gráfico", type: "error" } }));
        }
      }
      
      missingActiveMicrografiaRefreshRef.current = null;
      void fetchAll();
    };

    window.addEventListener(
      MICROGRAPHY_MEASURE_COMPLETED_EVENT,
      handleMeasureCompleted,
    );
    return () =>
      window.removeEventListener(
        MICROGRAPHY_MEASURE_COMPLETED_EVENT,
        handleMeasureCompleted,
      );
  }, [fetchAll]);



  const closeMenu = () => undefined;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Gallery image list derived from view ----
  const getGalleryImages = (): { name: string; url: string; id?: string }[] => {
    const v = galleryView;
    switch (v.kind) {
      case "none":
        return [];
      case "all-materials":
        return v.images;
      case "single-material":
        return [{ name: v.material.name, url: v.material.image }];
      case "all-muestras":
        return v.images;
      case "single-muestra":
        return [{ name: v.muestra.name, url: v.muestra.image }];
      case "all-regiones":
        return v.images;
      case "single-region":
        return [{ name: v.region.name, url: v.region.image }];
      case "micrografias":
        return v.images.map((m) => ({ name: m.name, url: m.url, id: m.rawId }));
      default:
        return [];
    }
  };
  const galleryImages = getGalleryImages();
  const galleryCalibrableByUrl = useMemo(() => {
    if (galleryView.kind !== "micrografias")
      return {} as Record<string, boolean>;
    const map: Record<string, boolean> = {};
    galleryImages.forEach((img) => {
      map[img.url] = true;
    });
    return map;
  }, [galleryImages, galleryView.kind]);

  const galleryCalibratedByUrl = useMemo(() => {
    const map: Record<string, boolean> = {};
    galleryImages.forEach((img) => {
      map[img.url] =
        !!galleryCalibrableByUrl[img.url] && !!calibratedByUrl[img.url];
    });
    return map;
  }, [galleryImages, galleryCalibrableByUrl, calibratedByUrl]);

  const measurementOverlayById = useMemo(() => {
    const overlays: Record<string, string> = {};
    
    apiMicrografias.forEach((mic) => {
      if (mic.measure_imagen) {
        overlays[String(mic.id)] = fixImageUrl(mic.measure_imagen);
      }
    });

    // Merge in real-time WebSocket events (may arrive before fetchAll updates apiMicrografias)
    for (const [microId, evt] of Object.entries(measureEventsById)) {
      if (evt.imagen) {
        overlays[microId] = fixImageUrl(evt.imagen);
      }
    }
    
    return overlays;
  }, [measureEventsById, apiMicrografias, fixImageUrl]);

  const toggleMeasurementOverlay = useCallback((imageUrl: string) => {
    setMeasurementOverlayVisibleByUrl((prev) => ({
      ...prev,
      [imageUrl]: !prev[imageUrl],
    }));
  }, []);

  const microSiblingsByUrl = useMemo(() => {
    const map: Record<string, { name: string; url: string }[]> = {};
    materials.forEach((mat) => {
      mat.muestras.forEach((mue) => {
        mue.regiones.forEach((reg) => {
          const regionImages = reg.micrografias.map((m) => ({
            name: m.name,
            url: m.url,
            id: m.rawId,
          }));
          reg.micrografias.forEach((mic) => {
            map[mic.url] = regionImages;
          });
        });
      });
    });
    return map;
  }, [materials]);

  const lightboxCalibrableByUrl = useMemo(() => {
    const map: Record<string, boolean> = {};
    lightboxImages.forEach((img) => {
      map[img.url] = !!microInfoByUrl[img.url];
    });
    return map;
  }, [lightboxImages, microInfoByUrl]);

  const microMaterialCodeByUrl = useMemo(() => {
    const map: Record<string, string> = {};
    apiMateriales.forEach((apiMat) => {
      const code = apiMat.code || "";
      const muestrasOfMat = apiMuestras.filter(
        (mue) => String(mue.material) === String(apiMat.id),
      );
      muestrasOfMat.forEach((mue) => {
        const regionsOfMue = apiRegiones.filter(
          (r) => String(r.muestra) === String(mue.id),
        );
        regionsOfMue.forEach((reg) => {
          const microsOfReg = apiMicrografias.filter(
            (mic) => String(mic.region) === String(reg.id),
          );
          microsOfReg.forEach((mic) => {
            const url = fixImageUrl(mic.imagen);
            map[url] = code;
          });
        });
      });
    });
    return map;
  }, [apiMateriales, apiMuestras, apiRegiones, apiMicrografias, fixImageUrl]);

  const microMaterialHasModelByUrl = useMemo(() => {
    const map: Record<string, boolean> = {};
    apiMateriales.forEach((apiMat) => {
      const hasModel = !!apiMat.has_model;
      const muestrasOfMat = apiMuestras.filter(
        (mue) => String(mue.material) === String(apiMat.id),
      );
      muestrasOfMat.forEach((mue) => {
        const regionsOfMue = apiRegiones.filter(
          (r) => String(r.muestra) === String(mue.id),
        );
        regionsOfMue.forEach((reg) => {
          const microsOfReg = apiMicrografias.filter(
            (mic) => String(mic.region) === String(reg.id),
          );
          microsOfReg.forEach((mic) => {
            const url = fixImageUrl(mic.imagen);
            map[url] = hasModel;
          });
        });
      });
    });
    return map;
  }, [apiMateriales, apiMuestras, apiRegiones, apiMicrografias, fixImageUrl]);

  const getMaterialHasModelByRegionId = useCallback((regionId: string) => {
    const reg = apiRegiones.find(r => String(r.id) === regionId);
    if (!reg) return false;
    const mue = apiMuestras.find(m => String(m.id) === String(reg.muestra));
    if (!mue) return false;
    const mat = apiMateriales.find(m => String(m.id) === String(mue.material));
    return !!mat?.has_model;
  }, [apiRegiones, apiMuestras, apiMateriales]);

  // ---- Helper: recursively collect children IDs for removal ----
  const getChildIds = (
    mat: Material,
    mueId?: string,
    regId?: string,
  ): string[] => {
    const ids: string[] = [];
    if (regId) return ids; // regions have no expandable children
    if (mueId) {
      const mue = mat.muestras.find((m) => m.id === mueId);
      mue?.regiones.forEach((r) => ids.push(r.id));
      return ids;
    }
    // material level: collect all muestras + regiones
    mat.muestras.forEach((m) => {
      ids.push(m.id);
      m.regiones.forEach((r) => ids.push(r.id));
    });
    return ids;
  };

  // ---- Header click handlers (just show group gallery) ----
  const handleHeaderMateriales = () => {
    setSelectedId(null);
    setGalleryTitle("Todos los Materiales");
    setGalleryView({
      kind: "all-materials",
      images: materials.map((m) => ({ name: m.name, url: m.image })),
    });
  };

  const handleHeaderMuestras = (mat: Material) => {
    setSelectedId(null);
    setGalleryTitle(`Muestras de ${mat.name}`);
    setGalleryView({
      kind: "all-muestras",
      images: mat.muestras.map((m) => ({ name: m.name, url: m.image })),
    });
  };

  const handleHeaderRegiones = (mue: Muestra) => {
    setSelectedId(null);
    setGalleryTitle(`Regiones de ${mue.name}`);
    setGalleryView({
      kind: "all-regiones",
      images: mue.regiones.map((r) => ({ name: r.name, url: r.image })),
    });
  };

  const handleHeaderMicrografias = (reg: Region) => {
    setSelectedId(null);
    setGalleryTitle(`Micrografías de ${reg.name}`);
    setGalleryView({ kind: "micrografias", images: reg.micrografias });
  };

  // ---- Item click handlers (independent toggle) ----
  // Each folder toggles independently. Collapsing also collapses children.
  const handleClickMaterial = (mat: Material) => {
    setSelectedId(mat.id);
    setGalleryTitle(mat.name);
    setGalleryView({ kind: "single-material", material: mat });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mat.id)) {
        next.delete(mat.id);
        // Also collapse all children
        mat.muestras.forEach((mue) => {
          next.delete(mue.id);
          mue.regiones.forEach((r) => next.delete(r.id));
        });
      } else {
        next.add(mat.id);
      }
      return next;
    });
  };

  const handleClickMuestra = (mue: Muestra, parentMat: Material) => {
    setSelectedId(mue.id);
    setGalleryTitle(mue.name);
    setGalleryView({ kind: "single-muestra", muestra: mue });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mue.id)) {
        next.delete(mue.id);
        mue.regiones.forEach((r) => next.delete(r.id));
      } else {
        next.add(mue.id);
      }
      return next;
    });
  };

  const handleClickRegion = (
    reg: Region,
    parentMue: Muestra,
    parentMat: Material,
  ) => {
    setSelectedId(reg.id);
    setGalleryTitle(reg.name);
    setGalleryView({ kind: "single-region", region: reg });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reg.id)) {
        next.delete(reg.id);
      } else {
        next.add(reg.id);
      }
      return next;
    });
  };

  const handleClickMicrografia = (mic: Micrografia, parentReg: Region) => {
    setSelectedId(mic.id);
    setGalleryTitle(mic.name);
    setGalleryView({ kind: "micrografias", images: [mic] });
  };

  const getMuestraIdFromRegionId = useCallback(
    (regionId: string) => {
      const region = apiRegiones.find((r) => String(r.id) === String(regionId));
      return region ? String(region.muestra) : null;
    },
    [apiRegiones],
  );

  const getMuestraIdFromMicroId = useCallback(
    (microId: string) => {
      const micro = apiMicrografias.find(
        (m) => String(m.id) === String(microId),
      );
      if (!micro) return null;
      return getMuestraIdFromRegionId(String(micro.region));
    },
    [apiMicrografias, getMuestraIdFromRegionId],
  );

  const markMuestraAsDirtyForPdf = useCallback((muestraId: string | null) => {
    if (!muestraId) return;
    setDirtyPdfMuestraIds((prev) => new Set(prev).add(String(muestraId)));
    setQueuedPdfMuestraIds((prev) => {
      const next = new Set(prev);
      next.delete(String(muestraId));
      return next;
    });
  }, []);

  // ---- API Mutations ----
  const handleDelete = async (id: string, type: string) => {
    if (type === "material") {
      setDeleteModal(null);
      pushToast(
        "Este elemento no puede eliminarse desde el panel de trabajo.",
        "warning",
        7600,
      );
      return;
    }

    const rawId = apiId(id);
    try {
      if (type === "muestra") await api.deleteMuestra(rawId);
      else if (type === "region") await api.deleteRegion(rawId);
      else if (type === "micrografia") await api.deleteMicrografia(rawId);

      setDeleteModal(null);
      setGalleryView((prev) => {
        if (prev.kind === "none") return prev;
        if (type === "micrografia" && prev.kind === "micrografias") {
          const filtered = prev.images.filter((img) => String(img.id) !== id && img.rawId !== rawId);
          if (filtered.length > 0) return { kind: "micrografias", images: filtered };
        }
        setGalleryTitle("Seleccione un elemento");
        return { kind: "none" };
      });
      fetchAll();
      pushToast("Elemento eliminado correctamente.", "success", 4200);
    } catch (e) {
      pushToast("No se pudo eliminar el elemento.", "error", 8200);
    }
  };

  const handleRename = async (id: string, type: string, newName: string) => {
    if (type === "material") {
      setRenameModal(null);
      setRenameModalError(null);
      pushToast(
        "Este elemento no puede renombrarse desde el panel de trabajo.",
        "warning",
        7600,
      );
      return;
    }

    const rawId = apiId(id);
    const oldName = renameModal?.name || "";
    try {
      setRenameModalError(null);
      const fd = new FormData();
      fd.append("nombre", newName);
      if (type === "muestra") await api.updateMuestra(rawId, fd);
      else if (type === "region") await api.updateRegion(rawId, fd);
      else if (type === "micrografia") await api.updateMicrografia(rawId, fd);

      // Instantly sync the visible gallery UI
      setGalleryTitle((prev) =>
        prev.includes(oldName) ? prev.replace(oldName, newName) : prev,
      );
      setGalleryView((prev) => {
        if (prev.kind === "none") return prev;
        const next = { ...prev } as GalleryView;
        if (next.kind === "single-material" && next.material.id === id)
          next.material = { ...next.material, name: newName };
        if (next.kind === "single-muestra" && next.muestra.id === id)
          next.muestra = { ...next.muestra, name: newName };
        if (next.kind === "single-region" && next.region.id === id)
          next.region = { ...next.region, name: newName };

        if (next.kind === "all-materials" && type === "material") {
          next.images = next.images.map((img) =>
            img.name === oldName ? { ...img, name: newName } : img,
          );
        }
        if (next.kind === "all-muestras" && type === "muestra") {
          next.images = next.images.map((img) =>
            img.name === oldName ? { ...img, name: newName } : img,
          );
        }
        if (next.kind === "all-regiones" && type === "region") {
          next.images = next.images.map((img) =>
            img.name === oldName ? { ...img, name: newName } : img,
          );
        }
        if (next.kind === "micrografias" && type === "micrografia") {
          next.images = next.images.map((mic) =>
            mic.id === id ? { ...mic, name: newName } : mic,
          );
        }
        return next;
      });

      setRenameModal(null);
      setRenameModalError(null);
      fetchAll();
      pushToast("Nombre actualizado correctamente.", "success", 3800);
    } catch (e) {
      const maybeApiError = e as ApiLikeError;
      if (
        type === "micrografia" &&
        isMicrografiaDuplicateError(maybeApiError)
      ) {
        setRenameModalError(
          "Ya existe una micrografía con ese nombre dentro de esta región.",
        );
        return;
      }

      const backendMessage =
        maybeApiError?.data?.detail ||
        maybeApiError?.data?.error ||
        maybeApiError?.message;
      setRenameModalError(
        backendMessage ||
          "No se pudo renombrar el elemento. Intenta nuevamente.",
      );
    }
  };

  const handleCreate = async (fds: FormData[]) => {
    const currentCreateModal = createModal;
    try {
      setCreateModal(null);
      if (currentCreateModal?.type === "micrografia" && fds.length > 1) {
        // Bulk upload: sequential queue with progress
        setUploadProgress({ current: 0, total: fds.length });
        let errors = 0;
        let duplicateErrors = 0;
        for (let i = 0; i < fds.length; i++) {
          setUploadProgress({ current: i + 1, total: fds.length });
          try {
            const apiRes = await api.createMicrografia(fds[i]);
            const rawFile = fds[i].get("imagen");
            const normalizedUrl = fixImageUrl(apiRes?.imagen);
            if (rawFile instanceof Blob && normalizedUrl) {
              const regionId = String(fds[i].get("region") || "");
              if (getMaterialHasModelByRegionId(regionId)) {
                addMicrografiaToAutoCalibrationQueue(rawFile, normalizedUrl);
              }
            }
          } catch (e) {
            errors++;
            const maybeApiError = e as ApiLikeError;
            if (isMicrografiaDuplicateError(maybeApiError)) {
              duplicateErrors++;
              const microName = String(
                fds[i].get("nombre") || "la micrografía",
              );
              pushToast(
                `No se pudo crear ${microName}: ya existe en la región seleccionada.`,
                "error",
                8500,
              );
            }
            console.error(`Error uploading image ${i + 1}:`, e);
          }
        }
        setUploadProgress(null);
        if (errors > 0 && duplicateErrors !== errors) {
          pushToast(
            `${errors} imagen(es) fallaron al subir. Revisá los datos e intentá nuevamente.`,
            "warning",
            9000,
          );
        }
      } else {
        // Single upload
        const fd = fds[0];
        if (currentCreateModal?.type === "material") await api.createMaterial(fd);
        else if (currentCreateModal?.type === "muestra") await api.createMuestra(fd);
        else if (currentCreateModal?.type === "region")
          await api.createRegion(fd);
        else if (currentCreateModal?.type === "micrografia") {
          const apiRes = await api.createMicrografia(fd);
          const rawFile = fd.get("imagen");
          const normalizedUrl = fixImageUrl(apiRes?.imagen);
          if (rawFile instanceof Blob && normalizedUrl) {
            const regionId = String(fd.get("region") || "");
            if (getMaterialHasModelByRegionId(regionId)) {
              addMicrografiaToAutoCalibrationQueue(rawFile, normalizedUrl);
            }
          }
        }
      }
      const nextData = await fetchAll();

      if (currentCreateModal?.type === "micrografia" && nextData) {
        const dirtyMuestraIds = new Set<string>();
        fds.forEach((fd) => {
          const regionIdFromFd = String(fd.get("region") || "");
          if (!regionIdFromFd) return;
          const regionFromNextData = nextData.r.find(
            (reg: ApiRegion) => String(reg.id) === regionIdFromFd,
          );
          if (regionFromNextData) {
            dirtyMuestraIds.add(String(regionFromNextData.muestra));
          }
        });
        dirtyMuestraIds.forEach((muestraId) =>
          markMuestraAsDirtyForPdf(muestraId),
        );

        const regionId = String(fds[0]?.get("region") || "");
        if (regionId) {
          const region = nextData.r.find(
            (reg: ApiRegion) => String(reg.id) === regionId,
          );

          const nextMicrografias: Micrografia[] = nextData.img
            .filter((mic: ApiMicrografia) => String(mic.region) === regionId)
            .map((mic: ApiMicrografia) => ({
              id: `mic_${mic.id}`,
              rawId: String(mic.id),
              name: mic.nombre,
              url: fixImageUrl(mic.imagen),

              umByPx:
                mic.um_by_px !== undefined && mic.um_by_px !== null
                  ? Number(mic.um_by_px)
                  : null,
            }));

          setSelectedId(`reg_${regionId}`);
          setGalleryTitle(
            region
              ? `Micrografías de ${region.nombre}`
              : "Micrografías de la región",
          );
          setGalleryView({ kind: "micrografias", images: nextMicrografias });
        }
      }
      if (currentCreateModal?.type === "micrografia") {
        pushToast(`${fds.length} micrografía${fds.length > 1 ? 's' : ''} añadida${fds.length > 1 ? 's' : ''} correctamente.`, "success", 4200);
      } else {
        pushToast("Elemento creado correctamente.", "success", 4200);
      }
    } catch (e) {
      const maybeApiError = e as ApiLikeError;
      if (
        currentCreateModal?.type === "micrografia" &&
        isMicrografiaDuplicateError(maybeApiError)
      ) {
        pushToast(
          "Ya existe una micrografía con ese nombre dentro de esta región.",
          "error",
          9000,
        );
        return;
      }
      pushToast("No se pudo crear el elemento.", "error", 8400);
    }
  };

  // ---- PDF Tracking State ----
  const [pdfHistory, setPdfHistory] = useState<any[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfStatusMessage, setPdfStatusMessage] = useState<string | null>(null);
  const [showInformeDispatchMessage, setShowInformeDispatchMessage] =
    useState(false);
  const [selectedPdfMuestraId, setSelectedPdfMuestraId] = useState<
    string | null
  >(null);
  const PDF_SELECTOR_ITEM_HEIGHT = 38;
  const PDF_SELECTOR_ITEM_GAP = 6;
  const REPORT_HISTORY_ITEM_HEIGHT = 36;
  const REPORT_HISTORY_ITEM_GAP = 7;

  const materialNameById = useMemo(() => {
    const map: Record<string, string> = {};
    apiMateriales.forEach((material) => {
      map[String(material.id)] = material.nombre;
    });
    return map;
  }, [apiMateriales]);

  const getMuestraDisplayName = useCallback(
    (mue: ApiMuestra) => {
      const materialName = materialNameById[String(mue.material)] || "";
      return materialName ? `${mue.nombre} (${materialName})` : mue.nombre;
    },
    [materialNameById],
  );

  const refreshReportHistory = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.getReportList();
      const normalized = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.results)
          ? (response as any).results
          : [];
      const sorted = [...normalized].sort((a: any, b: any) => {
        const timeA = Date.parse(a?.fecha || "");
        const timeB = Date.parse(b?.fecha || "");
        if (
          Number.isFinite(timeA) &&
          Number.isFinite(timeB) &&
          timeA !== timeB
        ) {
          return timeB - timeA;
        }

        const idA = Number(a?.id);
        const idB = Number(b?.id);
        if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
          return idB - idA;
        }

        return String(b?.id ?? "").localeCompare(String(a?.id ?? ""));
      });
      setPdfHistory(sorted);
    } catch (err) {
      console.warn("No se pudo obtener la lista de informes", err);
      setPdfHistory([]);
    }
  }, [token]);

  useEffect(() => {
    refreshReportHistory();
  }, [refreshReportHistory]);

  const isMuestraLockedForPdfSelection = useCallback(
    (muestraId: string) =>
      queuedPdfMuestraIds.has(String(muestraId)) &&
      !dirtyPdfMuestraIds.has(String(muestraId)),
    [queuedPdfMuestraIds, dirtyPdfMuestraIds],
  );

  const selectedPdfMuestraLocked =
    !!selectedPdfMuestraId &&
    isMuestraLockedForPdfSelection(String(selectedPdfMuestraId));

  const queueMissingCalibrationToasts = useCallback(
    (
      missing: Array<{
        micrografia_id?: number;
        micrografia_nombre?: string;
        region_nombre?: string;
      }>,
    ) => {
      const seen = new Set<string>();
      missing.forEach((item, index) => {
        const key = String(
          item.micrografia_id ?? `${item.micrografia_nombre}-${index}`,
        );
        if (seen.has(key)) return;
        seen.add(key);

        const message = item.micrografia_nombre
          ? `Falta calibrar ${item.micrografia_nombre}${item.region_nombre ? ` (${item.region_nombre})` : ""}`
          : "Hay micrografías sin calibrar";

        const timeout = setTimeout(() => {
          pushToast(message, "error", 7200 + index * 1100);
        }, index * 200);
        toastTimeoutsRef.current.push(timeout);
      });
    },
    [pushToast],
  );

  const handleGeneratePdf = async () => {
    if (!selectedPdfMuestraId) {
      pushToast(
        "Seleccioná una muestra para generar el informe.",
        "info",
        5600,
      );
      return;
    }

    if (isMuestraLockedForPdfSelection(selectedPdfMuestraId)) {
      pushToast(
        "Ya se solicitó el informe de esta muestra. Cargá o calibrá nuevas micrografías para volver a enviarla.",
        "info",
        7600,
      );
      return;
    }

    const selectedMuestra = apiMuestras.find(
      (mue) => String(mue.id) === String(selectedPdfMuestraId),
    );
    if (!selectedMuestra) {
      pushToast("No se encontró la muestra seleccionada.", "error", 7200);
      return;
    }

    const relatedRegiones = apiRegiones.filter(
      (region) => String(region.muestra) === String(selectedMuestra.id),
    );
    if (relatedRegiones.length === 0) {
      pushToast(
        "La muestra debe tener al menos una región para generar el informe.",
        "error",
        8200,
      );
      return;
    }

    const relatedMicrografias = apiMicrografias.filter((micro) =>
      relatedRegiones.some(
        (region) => String(region.id) === String(micro.region),
      ),
    );
    const calibratedMicrografias = relatedMicrografias.filter((micro) => {
      const ratio =
        micro.um_by_px !== undefined && micro.um_by_px !== null
          ? Number(micro.um_by_px)
          : null;
      return !!ratio && Number.isFinite(ratio) && ratio > 0;
    });
    if (calibratedMicrografias.length === 0) {
      pushToast(
        "La muestra necesita al menos una micrografía calibrada para generar el informe.",
        "error",
        8600,
      );
      return;
    }

    try {
      setPdfLoading(true);
      await api.generatePdf(selectedPdfMuestraId);
      pushToast("Solicitud de informe enviada. En proceso.", "info", 5000);
      setQueuedPdfMuestraIds((prev) => new Set(prev).add(selectedPdfMuestraId));
      setDirtyPdfMuestraIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPdfMuestraId);
        return next;
      });
      await refreshReportHistory();
    } catch (e) {
      const err = e as { data?: any; message?: string };
      const payload = err?.data;

      if (Array.isArray(payload?.micrografias_faltantes)) {
        if (payload.micrografias_faltantes.length > 0) {
          queueMissingCalibrationToasts(payload.micrografias_faltantes);
        } else {
          pushToast("Hay micrografías sin calibrar.", "error", 7200);
        }
      } else if (Array.isArray(payload?.regiones_sin_micrografias)) {
        pushToast(
          payload?.detalle || "Hay regiones sin micrografías.",
          "error",
          8400,
        );
      } else {
        pushToast(
          payload?.error || err?.message || "Error generando informe",
          "error",
        );
      }

      setPdfStatusMessage(null);
      setShowInformeDispatchMessage(false);
      setPdfLoading(false);
      return;
    }

    setPdfLoading(false);
  };

  const bakeMaskAlpha = async (
    maskSrc: string,
    originalSrc: string,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const maskImg = new Image();
      maskImg.crossOrigin = "anonymous";

      const origImg = new Image();
      origImg.crossOrigin = "anonymous";

      let maskLoaded = false;
      let origLoaded = false;
      let origFailed = false;

      const tryResolve = () => {
        if (!maskLoaded || !origLoaded) return;

        // Use original image dimensions as the target size.
        // If the original failed to load, fall back to mask's own dimensions
        // to avoid creating a 0×0 canvas.
        const targetW = origFailed
          ? (maskImg.naturalWidth || maskImg.width)
          : (origImg.naturalWidth || origImg.width);
        const targetH = origFailed
          ? (maskImg.naturalHeight || maskImg.height)
          : (origImg.naturalHeight || origImg.height);

        if (!targetW || !targetH) {
          // Both images have no dimensions; return raw mask
          resolve(maskSrc);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.globalAlpha = 0.65;
          
          const mWidth = maskImg.naturalWidth || maskImg.width;
          const mHeight = maskImg.naturalHeight || maskImg.height;

          // Si la máscara es cuadrada (ej. 512x512 o 1024x1024) y la imagen original no lo es, 
          // significa que la máscara fue rellenada (letterbox) y debemos recortar el exceso.
          if (mWidth === mHeight && targetW !== targetH && mWidth > 0) {
             const scale = Math.min(mWidth / targetW, mHeight / targetH);
             const newW = Math.round(targetW * scale);
             const newH = Math.round(targetH * scale);
             const xOffset = Math.floor((mWidth - newW) / 2);
             const yOffset = Math.floor((mHeight - newH) / 2);
             
             ctx.drawImage(maskImg, xOffset, yOffset, newW, newH, 0, 0, targetW, targetH);
          } else {
             // Ya está en la proporción correcta o la original también es cuadrada
             ctx.drawImage(maskImg, 0, 0, targetW, targetH);
          }
          
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(maskSrc);
        }
      };

      maskImg.onload = () => {
        maskLoaded = true;
        tryResolve();
      };
      maskImg.onerror = () => resolve(maskSrc);
      origImg.onload = () => {
        origLoaded = true;
        tryResolve();
      };
      origImg.onerror = () => {
        origFailed = true;
        origLoaded = true;
        tryResolve();
      };

      maskImg.src = maskSrc;
      origImg.src = originalSrc;
    });
  };

  const handleGenerateMask = useCallback(
    async (imageUrl: string) => {
      const microInfo = microInfoByUrl[imageUrl];
      if (!microInfo?.rawId) {
        pushToast("Esta imagen no admite generación de máscara.", "info", 5200);
        return;
      }

      const hasModel = microMaterialHasModelByUrl[imageUrl] ?? true;
      if (!hasModel) {
        pushToast("Material no soportado.", "error", 5000);
        return;
      }

      const hasMaskLoaded = !!maskByImageUrl[imageUrl];
      if (hasMaskLoaded) {
        setMaskVisibleByImageUrl((prev) => ({
          ...prev,
          [imageUrl]: !prev[imageUrl],
        }));
        return;
      }

      if (maskLoadingByImageUrl[imageUrl]) return;

      setMaskLoadingByImageUrl((prev) => ({ ...prev, [imageUrl]: true }));
      // The toast is deferred until we know if it's from backend or not

      try {
        let finalMaskUrl = "";
        let finalMaskLabels: api.HfMaskLabels | undefined;

        const materialCode = microMaterialCodeByUrl[imageUrl] || "";
        // Acero (45951) usa /rgb/, magnesia (45956) y otros usan /
        const suffix = materialCode === "45951" ? "/rgb/" : "/";
        const endpoint = materialCode
          ? `${api.HF_BASE_URL}/segment/${materialCode}${suffix}`
          : undefined;
        // Acero (/rgb/) handles resizing server-side; other models output
        // a fixed 512x512 mask, so we letterbox the image to match.
        const modelInputSize = materialCode !== "45951" ? 512 : undefined;

        let fromBackend = false;
        try {
          const maskData = await api.getMask(microInfo.rawId);
          if (maskData) {
            finalMaskUrl = fixImageUrl(maskData.mask_url);
            if (maskData.labels) {
              finalMaskLabels = maskData.labels;
            }
            fromBackend = true;
          }
        } catch (e) {
          console.warn("Mask not found in backend, generating locally...", e);
        }

        if (!finalMaskLabels && materialCode === "45951") {
          finalMaskLabels = api.ACERO_LABELS;
        }



        if (!fromBackend) {
          pushToast("Generando máscara de la micrografía...", "info", 5000);
          try {
            const hfResult = await api.generateMaskWithHf(
              imageUrl,
              endpoint,
              modelInputSize,
            );
            finalMaskUrl = hfResult.url;
            finalMaskLabels = hfResult.labels;
            
            // Guardar la máscara en el backend si no provino de ahí
            if (microInfo?.rawId && finalMaskUrl) {
              api.saveMask(microInfo.rawId, finalMaskUrl, finalMaskLabels).catch((e) => {
                console.warn("Error guardando la máscara en el backend", e);
              });
            }
          } catch {
            throw new Error("No se pudo generar la máscara. El servidor de IA no está disponible.");
          }
        }

        if (!finalMaskUrl) {
          throw new Error("No se obtuvo la máscara de la micrografía");
        }

        const bakedUrl = await bakeMaskAlpha(finalMaskUrl, imageUrl);
        if (bakedUrl) {
          finalMaskUrl = bakedUrl;
        }

        setMaskByImageUrl((prev) => {
          const next = { ...prev };
          next[imageUrl] = finalMaskUrl;
          return next;
        });
        setMaskVisibleByImageUrl((prev) => ({ ...prev, [imageUrl]: true }));

        // Re-read the cache right before writing to avoid overwriting
        // masks generated concurrently for other micrographs.
        if (finalMaskLabels && Object.keys(finalMaskLabels).length > 0) {
          setMaskLabelsByImageUrl((prev) => ({
            ...prev,
            [imageUrl]: finalMaskLabels as api.HfMaskLabels,
          }));
        }

        pushToast(
          "Máscara aplicada satisfactoriamente.",
          "info",
          5600,
        );
      } catch (err) {
        const maybeApiError = err as ApiLikeError;
        const msg =
          maybeApiError?.data?.error ||
          maybeApiError?.data?.detail ||
          maybeApiError?.message ||
          "No se pudo generar la máscara.";
        pushToast(msg, "error", 8600);
      } finally {
        setMaskLoadingByImageUrl((prev) => ({ ...prev, [imageUrl]: false }));
      }
    },
    [
      fixImageUrl,
      maskByImageUrl,
      maskLabelsByImageUrl,
      maskLoadingByImageUrl,
      maskVisibleByImageUrl,
      microInfoByUrl,
      microMaterialCodeByUrl,
      pushToast,
    ],
  );

  const handleDetectInclusiones = useCallback(
    async (imageUrl: string) => {
      const hasInclusionsLoaded = !!inclusionsByImageUrl[imageUrl];
      if (hasInclusionsLoaded) {
        setInclusionsVisibleByImageUrl((prev) => ({
          ...prev,
          [imageUrl]: !prev[imageUrl],
        }));
        return;
      }

      if (inclusionsLoadingByImageUrl[imageUrl]) return;

      setInclusionsLoadingByImageUrl((prev) => ({ ...prev, [imageUrl]: true }));
      pushToast("Detectando inclusiones...", "info", 4000);

      try {
        const boxes = await api.detectInclusiones(imageUrl);
        setInclusionsByImageUrl((prev) => ({ ...prev, [imageUrl]: boxes }));
        setInclusionsVisibleByImageUrl((prev) => ({ ...prev, [imageUrl]: true }));
        pushToast("Inclusiones detectadas.", "success", 4000);
      } catch (err) {
        const maybeApiError = err as ApiLikeError;
        const msg = maybeApiError?.message || "No se pudo detectar inclusiones.";
        pushToast(msg, "error", 6000);
      } finally {
        setInclusionsLoadingByImageUrl((prev) => ({ ...prev, [imageUrl]: false }));
      }
    },
    [inclusionsByImageUrl, inclusionsLoadingByImageUrl, pushToast]
  );

  // ---- Action Row ----
  const ItemRow = ({
    id,
    name,
    type,
    isOpen,
    isCalibrated = false,
    isCalibrating = false,
    isFailed = false,
    isAi = false,
    hasModel = true,
    isChartProcessed = false,
    isChartProcessing = false,
    isChartFailed = false,
    onClick,
  }: {
    id: string;
    name: string;
    type: string;
    isOpen?: boolean;
    isCalibrated?: boolean;
    isCalibrating?: boolean;
    isFailed?: boolean;
    isAi?: boolean;
    hasModel?: boolean;
    isChartProcessed?: boolean;
    isChartProcessing?: boolean;
    isChartFailed?: boolean;
    onClick: () => void;
  }) => {
    const isFolder = type !== "micrografia";
    const isSelected = selectedId === id;
    const addLabel =
      type === "material"
        ? "Añadir muestra"
        : type === "muestra"
          ? "Añadir región"
          : type === "region"
            ? "Añadir micrografía"
            : "Añadir";
    const addType =
      type === "material"
        ? "muestra"
        : type === "muestra"
          ? "region"
          : "micrografia";
    const showRenameButton = type !== "material";
    const showDeleteButton = type !== "material";
    return (
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none transition-all text-sm ${isSelected ? "bg-[#dff1ff]" : "hover:bg-[#f0f7ff]"}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          paddingLeft: 10,
          paddingRight: 12,
        }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
          {isFolder && (
            <span className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center text-[#4d6684]">
              {isOpen ? <ChevronDown /> : <ChevronRight />}
            </span>
          )}
          <span className="flex-shrink-0">
            {isFolder ? <FolderIcon /> : <ImageFileIcon />}
          </span>
          <span
            className="truncate font-semibold"
            style={{ color: isSelected ? "#339eea" : "#10243f" }}
            title={name}
          >
            {name}
          </span>
        </div>
        <div className="flex-shrink-0 ml-2 flex items-center gap-1.5">
          {type === "micrografia" && companyEnabled !== false && (!ENABLE_AUTOCALIBRATION ? isCalibrated : (hasModel || isCalibrated)) && (
            <span
              title={
                isCalibrated
                  ? "Calibrada"
                  : isCalibrating
                    ? "Autocalibrando..."
                    : isFailed
                      ? "Fallo IA"
                      : "Sin calibrar"
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {isCalibrated ? (
                (isAi && ENABLE_AUTOCALIBRATION) ? (
                  <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0 4px", height: "18px", boxSizing: "border-box", lineHeight: 1, borderRadius: 4, background: "rgba(22,163,74,0.15)", border: "1px solid #16a34a", color: "#16a34a", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>IA</span>
                ) : (
                  <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", height: "18px", boxSizing: "border-box" }}><CheckIcon /></span>
                )
              ) : ENABLE_AUTOCALIBRATION && (isCalibrating ? (
                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0 4px", height: "18px", boxSizing: "border-box", lineHeight: 1, borderRadius: 4, background: "rgba(232,163,23,0.15)", border: "1px solid #e8a317", color: "#e8a317", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>IA</span>
              ) : isFailed ? (
                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0 4px", height: "18px", boxSizing: "border-box", lineHeight: 1, borderRadius: 4, background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>IA</span>
              ) : (
                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "0 4px", height: "18px", boxSizing: "border-box", lineHeight: 1, borderRadius: 4, background: "rgba(232,163,23,0.15)", border: "1px solid #e8a317", color: "#e8a317", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>IA</span>
              ))}
            </span>
          )}
          {type === "micrografia" && companyEnabled !== false && hasModel && (
            <span
              title={
                isChartProcessed
                  ? "Gráfico de medición disponible"
                  : isChartProcessing
                    ? "Procesando gráfico..."
                    : isChartFailed
                      ? "Fallo al generar gráfico"
                      : "Procesando gráfico..."
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {isChartProcessed ? (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px", height: "18px", boxSizing: "border-box", borderRadius: 4, background: "rgba(22,163,74,0.15)", border: "1px solid #16a34a", color: "#16a34a" }}><ChartIcon size={12}/></span>
              ) : isChartFailed ? (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px", height: "18px", boxSizing: "border-box", borderRadius: 4, background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171" }}><ChartIcon size={12}/></span>
              ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px", height: "18px", boxSizing: "border-box", borderRadius: 4, background: "rgba(232,163,23,0.15)", border: "1px solid #e8a317", color: "#e8a317" }}><ChartIcon size={12}/></span>
              )}
            </span>
          )}
          {type !== "micrografia" && (
            <button
              title={addLabel}
              className="h-6 w-6 rounded-md border border-[#16a34a33] bg-[#ecfdf3] text-[#16a34a] hover:bg-[#dcfce8] transition flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setCreateModal({
                  parentId: apiId(id),
                  type: addType,
                });
              }}
            >
              <PlusIcon />
            </button>
          )}
          {showRenameButton && (
            <button
              title="Renombrar"
              className="h-6 w-6 rounded-md border border-[#0d5a9133] bg-[#eef8ff] text-[#0d5a91] hover:bg-[#dff1ff] transition flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setRenameModal({ id, name, type });
                setRenameModalError(null);
              }}
            >
              <EditIcon />
            </button>
          )}
          {showDeleteButton && (
            <button
              title="Eliminar"
              className="h-6 w-6 rounded-md border border-[#e53e3e33] bg-[#fff5f5] text-[#e53e3e] hover:bg-[#fee2e2] transition flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ id, name, type });
              }}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ---- Section Header ----
  const SectionHeader = ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <div
      className="px-3 py-2 text-sm font-bold text-[#4d6684] uppercase tracking-widest cursor-pointer hover:text-[#339eea] hover:bg-[#eef8ff] transition-colors select-none border-b border-[#10243f08]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`Ver todas las imágenes de ${label}`}
      style={{ flexShrink: 0 }}
    >
      {label}
    </div>
  );

  const getToastToneConfig = (tone: ToastNotification["tone"]) => {
    switch (tone) {
      case "success":
        return {
          accent: "#22c55e",
          iconBg: "#e9fcef",
          iconColor: "#16a34a",
          titleColor: "#1f2937",
          bodyColor: "#6b7280",
          icon: <CheckIcon size={18} />,
        };
      case "warning":
        return {
          accent: "#f59e0b",
          iconBg: "#fff7e8",
          iconColor: "#d97706",
          titleColor: "#1f2937",
          bodyColor: "#6b7280",
          icon: <AlertIcon size={18} />,
        };
      case "error":
        return {
          accent: "#f43f5e",
          iconBg: "#fff0f3",
          iconColor: "#e11d48",
          titleColor: "#1f2937",
          bodyColor: "#6b7280",
          icon: <XCircleIcon size={18} />,
        };
      case "info":
      default:
        return {
          accent: "#3b82f6",
          iconBg: "#eaf3ff",
          iconColor: "#2563eb",
          titleColor: "#1f2937",
          bodyColor: "#6b7280",
          icon: <InfoIcon size={18} />,
        };
    }
  };

  const informesListIsEmpty = pdfHistory.length === 0 && !pdfStatusMessage;
  const muestrasListIsEmpty = apiMuestras.length === 0;

  if (!showAdmin && !showGallery && !showReports && !showAssistant) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white rounded-2xl border border-[#10243f14] shadow-sm">
        <div className="text-center opacity-70 flex flex-col items-center">
          <div className="text-[#9ca3af] mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M2 15h10"></path><path d="M9 18l3-3-3-3"></path></svg>
          </div>
          <p className="text-[#6b7280] text-[0.9rem] italic m-0">
            Elija la sección que quiera ver desde la barra lateral izquierda
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <Group 
        orientation="horizontal" 
        style={{ height: "100%", width: "100%" }}
      >
      {showAdmin && (
        <Panel minSize={15} collapsible={false} defaultSize={25}>
          {/* ======== ISLAND 1: DIRECTORY ======== */}
          <div
            className="island"
            style={{
              position: "relative",
              background: "#ffffff",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              height: "100%",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
            }}
          >
        <div
          className="px-4 py-2.5 border-b border-[#10243f1a] flex justify-between items-center"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#10243f] m-0">Administrador</h3>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowAdminLegend(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-transparent border-none text-[#339eea] cursor-pointer transition-all hover:bg-[#eef8ff] hover:-translate-y-0.5"
              title="Leyenda de íconos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </button>
          </div>
        </div>

        {/* Scrollable tree */}
        <div
          style={{
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            paddingBottom: 14,
          }}
          className="custom-scrollbar"
          onScroll={closeMenu}
        >
          {/* MATERIALES header */}
          <div className="flex items-center gap-2">
            <div
              className="mx-2 my-2 inline-flex items-center px-3 py-1.5 text-[11px] font-bold text-[#3f6b8f] uppercase tracking-[0.12em] cursor-pointer select-none rounded-lg border border-[#b7dbf7] bg-white shadow-[0_1px_2px_rgba(16,36,63,0.06)] transition-shadow hover:shadow-[0_8px_16px_rgba(16,36,63,0.16)]"
              onClick={(e) => {
                e.stopPropagation();
                handleHeaderMateriales();
              }}
              title="Ver todas las imágenes de Materiales"
            >
              Materiales
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreateModal({ parentId: "root", type: "material" });
              }}
              title="Crear Material"
              className="w-6 h-6 flex items-center justify-center rounded border border-[#b7dbf7] text-[#3f6b8f] hover:bg-[#eef8ff] transition shadow-[0_1px_2px_rgba(16,36,63,0.06)] bg-white cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>


          {/* Material items */}
          {materials.map((mat) => (
            <React.Fragment key={mat.id}>
              <ItemRow
                id={mat.id}
                name={mat.name}
                type="material"
                isOpen={expandedIds.has(mat.id)}
                onClick={() => handleClickMaterial(mat)}
              />

              {/* Muestras of this material (animated) */}
              <Collapsible open={expandedIds.has(mat.id)}>
                <div
                  className="mx-2 my-1 inline-flex items-center px-3 py-1.5 text-[11px] font-bold text-[#3f6b8f] uppercase tracking-[0.12em] cursor-pointer select-none rounded-lg border border-[#b7dbf7] bg-white shadow-[0_1px_2px_rgba(16,36,63,0.06)] transition-shadow hover:shadow-[0_8px_16px_rgba(16,36,63,0.16)]"
                  style={{ marginLeft: 12, marginRight: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHeaderMuestras(mat);
                  }}
                  title={`Ver todas las muestras de ${mat.name}`}
                >
                  Muestras
                </div>

                {mat.muestras.map((mue) => (
                  <React.Fragment key={mue.id}>
                    <div style={{ marginLeft: 10 }}>
                      <ItemRow
                        id={mue.id}
                        name={mue.name}
                        type="muestra"
                        isOpen={expandedIds.has(mue.id)}
                        onClick={() => handleClickMuestra(mue, mat)}
                      />
                    </div>

                    {/* Regiones of this muestra (animated) */}
                    <Collapsible open={expandedIds.has(mue.id)}>
                      <div
                        className="mx-2 my-1 inline-flex items-center px-3 py-1.5 text-[11px] font-bold text-[#3f6b8f] uppercase tracking-[0.12em] cursor-pointer select-none rounded-lg border border-[#b7dbf7] bg-white shadow-[0_1px_2px_rgba(16,36,63,0.06)] transition-shadow hover:shadow-[0_8px_16px_rgba(16,36,63,0.16)]"
                        style={{ marginLeft: 24, marginRight: 8 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHeaderRegiones(mue);
                        }}
                        title={`Ver todas las regiones de ${mue.name}`}
                      >
                        Regiones
                      </div>

                      {mue.regiones.map((reg) => (
                        <React.Fragment key={reg.id}>
                          <div style={{ marginLeft: 22 }}>
                            <ItemRow
                              id={reg.id}
                              name={reg.name}
                              type="region"
                              isOpen={expandedIds.has(reg.id)}
                              onClick={() => handleClickRegion(reg, mue, mat)}
                            />
                          </div>

                          {/* Micrografías of this region (animated) */}
                          <Collapsible open={expandedIds.has(reg.id)}>
                            <div
                              className="mx-2 my-1 inline-flex items-center px-3 py-1.5 text-[11px] font-bold text-[#3f6b8f] uppercase tracking-[0.12em] cursor-pointer select-none rounded-lg border border-[#b7dbf7] bg-white shadow-[0_1px_2px_rgba(16,36,63,0.06)] transition-shadow hover:shadow-[0_8px_16px_rgba(16,36,63,0.16)]"
                              style={{ marginLeft: 36, marginRight: 8 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHeaderMicrografias(reg);
                              }}
                              title={`Ver todas las micrografías de ${reg.name}`}
                            >
                              Micrografías
                            </div>

                            {reg.micrografias.map((mic) => (
                              <div key={mic.id} style={{ marginLeft: 34 }}>
                                <ItemRow
                                  id={mic.id}
                                  name={mic.name}
                                  type="micrografia"
                                  isCalibrated={
                                    (!!mic.umByPx && Number(mic.umByPx) > 0) ||
                                    (!!calibrationData[mic.url]?.umByPx && Number(calibrationData[mic.url]?.umByPx) > 0)
                                  }
                                  isCalibrating={!!calibratingByUrl[mic.url] && (microMaterialHasModelByUrl[mic.url] ?? true)}
                                  isFailed={!!failedCalibrationByUrl[mic.url] && (microMaterialHasModelByUrl[mic.url] ?? true)}
                                  isAi={!!calibrationData[mic.url]?.isAi && (microMaterialHasModelByUrl[mic.url] ?? true)}
                                  hasModel={microMaterialHasModelByUrl[mic.url] ?? true}
                                  isChartProcessed={(() => {
                                    const mApi = apiMicrografias.find(m => String(m.id) === String(mic.rawId) || fixImageUrl(m.imagen) === mic.url);
                                    const mEvt = mApi ? measureEventsById[String(mApi.id)] : undefined;
                                    return mEvt ? mEvt.status === "completed" && mEvt.is_valid === true : mApi?.measure_is_valid === true || !!mApi?.measure_imagen;
                                  })()}
                                  isChartFailed={(() => {
                                    const mApi = apiMicrografias.find(m => String(m.id) === String(mic.rawId) || fixImageUrl(m.imagen) === mic.url);
                                    const mEvt = mApi ? measureEventsById[String(mApi.id)] : undefined;
                                    return mEvt ? mEvt.status === "completed" && mEvt.is_valid === false : mApi?.measure_is_valid === false;
                                  })()}
                                  isChartProcessing={(() => {
                                    const mApi = apiMicrografias.find(m => String(m.id) === String(mic.rawId) || fixImageUrl(m.imagen) === mic.url);
                                    const mEvt = mApi ? measureEventsById[String(mApi.id)] : undefined;
                                    const processed = mEvt ? mEvt.status === "completed" && mEvt.is_valid === true : mApi?.measure_is_valid === true || !!mApi?.measure_imagen;
                                    const failed = mEvt ? mEvt.status === "completed" && mEvt.is_valid === false : mApi?.measure_is_valid === false;
                                    return !processed && !failed;
                                  })()}
                                  onClick={() =>
                                    handleClickMicrografia(mic, reg)
                                  }
                                />
                              </div>
                            ))}
                          </Collapsible>
                        </React.Fragment>
                      ))}
                    </Collapsible>
                  </React.Fragment>
                ))}
              </Collapsible>
            </React.Fragment>
          ))}
        </div>
      </div>
        </Panel>
      )}
      {showAdmin && (showGallery || showReports || showAssistant) && <ResizeHandle />}
      
      {showGallery && (
        <Panel minSize={15} collapsible={false} defaultSize={35}>
          {/* ======== ISLAND 2: GALLERY ======== */}
          <div
            className="island"
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              height: "100%",
              minWidth: 0,
            }}
            onClick={closeMenu}
          >
        <div
          className="px-4 py-2.5 border-b border-[#10243f1a] flex justify-between items-center"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#10243f] m-0">
              {galleryTitle}
            </h3>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowGalleryLegend(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-transparent border-none text-[#339eea] cursor-pointer transition-all hover:bg-[#eef8ff] hover:-translate-y-0.5"
              title="Leyenda de íconos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </button>
          </div>
          <span className="text-[10px] font-bold bg-[#dff1ff] text-[#339eea] py-1 px-2.5 rounded-full">
            {galleryImages.length} imágenes
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 16,
              overflowY: "auto",
              overflowX: "hidden",
            }}
            className="custom-scrollbar"
          >
            <ResponsiveGallery
              companyEnabled={companyEnabled}
              images={galleryImages}
              calibrableByUrl={galleryCalibrableByUrl}
              calibratedByUrl={galleryCalibratedByUrl}
              calibratingByUrl={calibratingByUrl}
              failedCalibrationByUrl={failedCalibrationByUrl}
              calibrationData={calibrationData}
              microMaterialHasModelByUrl={microMaterialHasModelByUrl}
              highlightedByUrl={{} as Record<string, boolean>}
              apiMicrografias={apiMicrografias}
              measureEventsById={measureEventsById}
              fixImageUrl={fixImageUrl}
              onImageClick={(img) => {
                const isSingleMicroFromTree =
                  galleryView.kind === "micrografias" &&
                  galleryView.images.length === 1;
                const nextLightboxImages = isSingleMicroFromTree
                  ? microSiblingsByUrl[img.url] || galleryImages
                  : galleryImages;
                const idx = nextLightboxImages.findIndex(
                  (g) => g.url === img.url,
                );
                if (idx !== -1) {
                  setLightboxImages(nextLightboxImages);
                  setLightboxIndex(idx);
                }
              }}
            />
          </div>
        </div>
      </div>
      </Panel>
      )}

      {/* ======== UPLOAD PROGRESS BANNER ======== */}
      {uploadProgress && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 200,
            background: "white",
            border: "1px solid rgba(51,158,234,0.3)",
            borderRadius: 16,
            padding: "12px 24px",
            boxShadow: "0 8px 32px rgba(16,36,63,0.18)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 320,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#10243f",
                marginBottom: 6,
              }}
            >
              Subiendo imagen {uploadProgress.current} de {uploadProgress.total}
              ...
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                background: "#eef8ff",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #339eea, #0d5a91)",
                  borderRadius: 3,
                  transition: "width 300ms ease",
                }}
              />
            </div>
          </div>
          <span
            style={{ fontSize: "0.75rem", fontWeight: 700, color: "#339eea" }}
          >
            {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
          </span>
        </div>
      )}

      {/* ======== ISLAND 3: INFORMES ======== */}
      {showGallery && (showReports || showAssistant) && <ResizeHandle />}
      
      {showReports && (
        <Panel minSize={15} collapsible={false} defaultSize={15}>
          <section
            className="island"
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
              height: "100%",
            }}
          >
            <div
              className="px-4 py-2.5 border-b border-[#10243f1a] flex items-center"
              style={{ flexShrink: 0 }}
            >
              <h3 className="text-base font-bold text-[#10243f] m-0">Informes</h3>
            </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowY: "hidden",
            overflowX: "hidden",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr) auto minmax(0, 1fr)",
              gap: 10,
              flex: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <div
              style={{ fontSize: "0.84rem", fontWeight: 700, color: "#4d6684" }}
            >
              Informes guardados
            </div>

            <div
              style={{
                border: "1px solid rgba(16,36,63,0.16)",
                borderRadius: 18,
                padding: "10px 2px 10px 10px",
                background: "#f9fcff",
                minHeight: 120,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                height: "100%",
                overflow: "hidden",
              }}
            >
              {informesListIsEmpty ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center opacity-70 p-2">
                  <div className="text-[#9ca3af] mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <span className="text-[#6b7280] text-[0.9rem] italic m-0">Aún no hay informes que mostrar.</span>
                </div>
              ) : (
                <>

                  {pdfHistory.length > 0 && (
                    <div
                      className="custom-scrollbar"
                      style={{
                        width: "100%",
                        flex: 1,
                        overflowY: "auto",
                        minHeight: 0,
                      }}
                    >
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: REPORT_HISTORY_ITEM_GAP,
                        }}
                      >
                        {pdfHistory.map((pdf, idx) => (
                          <li
                            key={pdf.id || idx}
                            style={{
                              display: "flex",
                              width: "100%",
                              gap: 8,
                              fontSize: "0.82rem",
                              color: "#10243f",
                              alignItems: "center",
                              background: "white",
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(16,36,63,0.09)",
                              minHeight: REPORT_HISTORY_ITEM_HEIGHT,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                                textAlign: "center",
                              }}
                            >
                              {pdf.value || `Informe_ID_${pdf.id}`}.pdf
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "#4d6684",
              }}
            >
              Seleccione una muestra
            </div>

            <div
              style={{
                border: "1px solid rgba(16,36,63,0.16)",
                borderRadius: 18,
                padding: "10px 2px 10px 10px",
                background: "#f9fcff",
                minHeight: 120,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
              }}
            >
              {muestrasListIsEmpty ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center opacity-70 p-2">
                  <div className="text-[#9ca3af] mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  </div>
                  <span className="text-[#6b7280] text-[0.9rem] italic m-0">Aún no hay muestras que mostrar.</span>
                </div>
              ) : (
                <div
                  className="custom-scrollbar"
                  style={{
                    width: "100%",
                    flex: 1,
                    overflowY: "auto",
                    minHeight: 0,
                  }}
                >
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: PDF_SELECTOR_ITEM_GAP,
                    }}
                  >
                    {apiMuestras.filter((mue) => {
                      const mat = apiMateriales.find(m => String(m.id) === String(mue.material));
                      return !!mat?.has_model;
                    }).map((mue) => {
                      const muestraId = String(mue.id);
                      const isSelected = selectedPdfMuestraId === muestraId;
                      const isLocked =
                        isMuestraLockedForPdfSelection(muestraId);
                      return (
                        <li
                          key={mue.id}
                          onClick={() => {
                            if (isLocked && !isSelected) return;
                            if (selectedPdfMuestraId !== muestraId) {
                              setShowInformeDispatchMessage(false);
                            }
                            setSelectedPdfMuestraId(muestraId);
                          }}
                          style={{
                            display: "flex",
                            gap: 8,
                            fontSize: "0.9rem",
                            alignItems: "center",
                            background: isSelected ? "#339eea" : "white",
                            color: isSelected ? "white" : "#10243f",
                            padding: "6px 10px",
                            borderRadius: 9,
                            cursor:
                              isLocked && !isSelected
                                ? "not-allowed"
                                : "pointer",
                            minHeight: PDF_SELECTOR_ITEM_HEIGHT,
                            border: isSelected
                              ? "1px solid #0d5a91"
                              : "1px solid rgba(16,36,63,0.06)",
                            opacity: isLocked && !isSelected ? 0.5 : 1,
                          }}
                        >
                          <svg
                            style={{ flexShrink: 0 }}
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <span
                            style={{
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              minWidth: 0,
                            }}
                            title={getMuestraDisplayName(mue)}
                          >
                            {getMuestraDisplayName(mue)}
                          </span>
                          {isLocked && !isSelected && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                color: "#4d6684",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              Enviado
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              minWidth: 0,
            }}
          >
            {showInformeDispatchMessage && (
              <div
                style={{
                  textAlign: "center",
                  color: "#4d6684",
                  fontSize: "0.84rem",
                  lineHeight: 1.25,
                }}
              >
                En breve se enviará el informe a su correo.
              </div>
            )}

            <button
              className="pdf-btn-primary"
              onClick={() => checkMicrographLimit(handleGeneratePdf)}
              disabled={
                pdfLoading ||
                selectedPdfMuestraLocked ||
                !selectedPdfMuestraId ||
                !!uploadProgress
              }
              style={{
                opacity:
                  pdfLoading ||
                  selectedPdfMuestraLocked ||
                  !selectedPdfMuestraId ||
                  !!uploadProgress
                    ? 0.6
                    : 1,
                width: "100%",
                maxWidth: 172,
                minHeight: 84,
                justifyContent: "center",
                borderRadius: 12,
                padding: "8px 10px",
                fontSize: "1rem",
                gap: 0,
                textAlign: "center",
                lineHeight: 1.15,
              }}
            >
              <span>
                GENERAR
                <br />
                INFORME
              </span>
            </button>
          </div>
        </div>
      </section>
      </Panel>
      )}

      {showReports && showAssistant && <ResizeHandle />}

      {/* ======== ISLAND 4: ASSISTANT ======== */}
      {showAssistant && (
        <Panel minSize={15} collapsible={false} defaultSize={25}>
          <section
            className="island"
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
              height: "100%",
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div
                className="px-4 py-2.5 border-b border-[#10243f1a] flex items-center"
                style={{ flexShrink: 0 }}
              >
                <h3 className="text-base font-bold text-[#10243f] m-0">Asistente</h3>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ChatPanel />
              </div>
            </div>
          </section>
        </Panel>
      )}
    </Group>

      {/* Lightbox via Portal */}
      {lightboxIndex !== null &&
        lightboxImages.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <ImageLightboxCarousel
            onCheckMicrographLimit={checkMicrographLimit}
            images={lightboxImages}
            initialIndex={lightboxIndex}
            calibrableByUrl={lightboxCalibrableByUrl}
            calibrationData={calibrationData}
            calibratingByUrl={calibratingByUrl}
            failedCalibrationByUrl={failedCalibrationByUrl}
            microMaterialHasModelByUrl={microMaterialHasModelByUrl}
            maskByImageUrl={maskByImageUrl}
            maskLabelsByImageUrl={maskLabelsByImageUrl}
            maskVisibleByImageUrl={maskVisibleByImageUrl}
            maskLoadingByImageUrl={maskLoadingByImageUrl}
            inclusionsByImageUrl={inclusionsByImageUrl}
            inclusionsVisibleByImageUrl={inclusionsVisibleByImageUrl}
            inclusionsLoadingByImageUrl={inclusionsLoadingByImageUrl}
            onDetectInclusiones={handleDetectInclusiones}
            lastMicrometers={lastMicrometers}
            contextInfo={lightboxContextInfo}
            measurementOverlayById={measurementOverlayById}
            measurementOverlayVisibleByUrl={measurementOverlayVisibleByUrl}
            onToggleMeasurementOverlay={toggleMeasurementOverlay}
            pushToast={pushToast}
            onRetryAutoCalibration={async (url) => {
              try {
                setCalibratingByUrl((prev) => ({ ...prev, [url]: true }));
                setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: false }));
                const response = await fetch(url);
                const blob = await response.blob();
                addMicrografiaToAutoCalibrationQueue(blob, url);
              } catch (e) {
                console.error("Failed to retry auto calibration", e);
                setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
                setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: true }));
              }
            }}
            onSaveCalibration={async (url, data) => {
              const ratio =
                data.umByPx || data.micrometers / Math.max(data.pixelLength, 1);
              const microInfo = microInfoByUrl[url];

              setCalibratingByUrl((prev) => ({ ...prev, [url]: false }));
              setFailedCalibrationByUrl((prev) => ({ ...prev, [url]: false }));

              if (microInfo?.rawId) {
                try {
                  const fd = new FormData();
                  fd.append("um_by_px", String(ratio));
                  fd.append("is_ai", "false");
                  if (data.pixelLength) fd.append("pixel_length", String(data.pixelLength));
                  if (data.micrometers) fd.append("micrometers", String(data.micrometers));

                  await api.updateMicrografia(microInfo.rawId, fd);
                  setApiMicrografias((prev) =>
                    prev.map((m) =>
                      String(m.id) === microInfo.rawId
                        ? { ...m, um_by_px: ratio, is_ai: false, pixel_length: data.pixelLength, micrometers: data.micrometers }
                        : m,
                    ),
                  );
                } catch (err) {
                  console.error("Error patching um_by_px", err);
                  const apiErr = err as ApiLikeError;
                  const detail =
                    apiErr?.data?.error ||
                    apiErr?.data?.detail ||
                    apiErr?.message ||
                    "No se pudo guardar la calibración.";
                  pushToast(detail, "error", 9200);
                  return;
                }

                markMuestraAsDirtyForPdf(
                  getMuestraIdFromMicroId(microInfo.rawId),
                );
              }

              setCalibrationData((prev) => ({
                ...prev,
                [url]: { ...data, umByPx: ratio },
              }));
              setLastMicrometers(data.micrometers);
            }}
            onGenerateMask={handleGenerateMask}
            onUpdateMaskData={(imageUrl, newDataUrl) => {
              setMaskByImageUrl((prev) => ({
                ...prev,
                [imageUrl]: newDataUrl,
              }));
              const microInfo = microInfoByUrl[imageUrl];
              if (microInfo?.rawId) {
                // Mask edit logic should ideally update the backend here if desired,
                // but for now we only update local state.
              }
            }}
            onClose={() => {
              setLightboxIndex(null);
              setLightboxImages([]);
            }}
          />,
          document.body,
        )}

      {/* Modals via Portal */}
      {deleteModal &&
        typeof document !== "undefined" &&
        createPortal(
          <ConfirmModal
            title="Eliminar elemento"
            message={`¿Estás seguro de que deseas eliminar "${deleteModal.name}"? ${deleteModal.type === "muestra" || deleteModal.type === "region" ? "Todos los elementos internos se eliminarán también." : ""}`}
            confirmLabel="Eliminar"
            confirmColor="#e53e3e"
            onConfirm={() => handleDelete(deleteModal.id, deleteModal.type)}
            onCancel={() => setDeleteModal(null)}
          />,
          document.body,
        )}
      {renameModal &&
        typeof document !== "undefined" &&
        createPortal(
          <RenameModal
            currentName={renameModal.name}
            onConfirm={(n) => handleRename(renameModal.id, renameModal.type, n)}
            errorMessage={renameModalError}
            onInputChange={() => setRenameModalError(null)}
            onCancel={() => {
              setRenameModal(null);
              setRenameModalError(null);
            }}
          />,
          document.body,
        )}
      {createModal &&
        typeof document !== "undefined" &&
        createPortal(
          <CreateModal
            parentId={createModal.parentId}
            type={createModal.type}
            onConfirm={handleCreate}
            onCancel={() => setCreateModal(null)}
          />,
          document.body,
        )}

      {toastNotifications.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              zIndex: 12000,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              pointerEvents: "auto",
              width: "min(420px, calc(100vw - 24px))",
              maxHeight: "calc(100vh - 140px)",
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: 4,
            }}
            className="custom-scrollbar"
          >
            {[...toastNotifications].reverse().map((toast) => {
              const toneConfig = getToastToneConfig(toast.tone);
              return (
                <div
                  key={toast.id}
                  style={{
                    position: "relative",
                    background: "#ffffff",
                    border: "1px solid rgba(16,36,63,0.1)",
                    borderRadius: 14,
                    boxShadow: "0 14px 34px rgba(16,36,63,0.16)",
                    padding: "12px 14px 14px 14px",
                    opacity: toast.leaving ? 0 : 1,
                    transform: toast.leaving
                      ? "translateY(-6px)"
                      : "translateY(0)",
                    transition: "opacity 240ms ease, transform 240ms ease",
                    pointerEvents: "auto",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      background: toneConfig.accent,
                    }}
                  />
                  <button
                    onClick={() => removeToast(toast.id)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      border: "none",
                      background: "transparent",
                      color: "#6b7280",
                      cursor: "pointer",
                      padding: 2,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Cerrar notificación"
                  >
                    <CloseIcon />
                  </button>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      paddingLeft: 10,
                      paddingRight: 18,
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        background: toneConfig.iconBg,
                        color: toneConfig.iconColor,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {toneConfig.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "1.02rem",
                          fontWeight: 800,
                          lineHeight: 1.1,
                          color: toneConfig.titleColor,
                          marginBottom: 3,
                        }}
                      >
                        {toast.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.92rem",
                          fontWeight: 500,
                          lineHeight: 1.35,
                          color: toneConfig.bodyColor,
                          wordBreak: "break-word",
                        }}
                      >
                        {toast.message}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 5,
                      background: "rgba(16,36,63,0.08)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: "100%",
                        background: toneConfig.accent,
                        transformOrigin: "left center",
                        animation: `toastProgress ${toast.durationMs}ms linear forwards`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}

      {showAdminLegend && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" onClick={() => setShowAdminLegend(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-[#10243f14] w-[400px] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#f8fbff]">
              <h3 className="m-0 text-[#10243f] text-lg font-bold">Leyenda Administrador</h3>
              <button onClick={() => setShowAdminLegend(false)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ENABLE_AUTOCALIBRATION && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(22,163,74,0.15)', border: '1px solid #16a34a', color: '#16a34a', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibración exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(232,163,23,0.15)', border: '1px solid #e8a317', color: '#e8a317', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibrando (o en cola)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 5px', borderRadius: 4, background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', color: '#f87171', lineHeight: 1 }}>IA</span>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Error en autocalibración</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#16a34a', padding: '2px 4px', display: 'flex' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Calibración Manual exitosa</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(22,163,74,0.15)", border: "1px solid #16a34a", color: "#16a34a", lineHeight: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Gráfico de medición disponible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(232,163,23,0.15)", border: "1px solid #e8a317", color: "#e8a317", lineHeight: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Procesando gráfico...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: "flex", padding: "2px", borderRadius: 4, background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171", lineHeight: 1 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Fallo al generar gráfico</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGalleryLegend && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" onClick={() => setShowGalleryLegend(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-[#10243f14] w-[400px] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#f8fbff]">
              <h3 className="m-0 text-[#10243f] text-lg font-bold">Leyenda Galería</h3>
              <button onClick={() => setShowGalleryLegend(false)} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ENABLE_AUTOCALIBRATION && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibración exitosa</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(232, 163, 23, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:"white"}}/> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Autocalibrando (o en cola)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(220, 38, 38, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> IA
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Error en autocalibración</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> CM
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Calibración Manual exitosa</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(22, 163, 74, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Gráfico de medición disponible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(232, 163, 23, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Procesando gráfico...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(220, 38, 38, 0.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 6-7" /></svg>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#4d6684' }}>Fallo al generar gráfico</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDisabledCompanyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-[#10243f66] backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-[28px] shadow-xl border border-[#10243f14] max-w-md w-[90%] overflow-hidden text-center p-8"
          >
            <div
              className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 className="m-0 mb-4 text-[#10243f] text-2xl font-bold">
              Compañía en Revisión
            </h2>
            <p className="m-0 mb-6 text-[#4d6684] leading-relaxed">
              Tu compañía aún no está habilitada. Debes cargar al menos <strong>20 micrografías</strong> ordenadas como quieras (materiales, muestras, regiones) y luego esperar la habilitación manual de los administradores.
            </p>
            <button
              onClick={() => setShowDisabledCompanyModal(false)}
              className="px-8 py-3 rounded-xl bg-[#10243f] text-white font-semibold text-base cursor-pointer transition-opacity hover:opacity-90 border-none w-full"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,36,63,0.12); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,36,63,0.22); }
        .island {
          background: white;
          border: 1px solid rgba(16, 36, 63, 0.14);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(16, 36, 63, 0.08);
          border-bottom: 5px solid #339eea;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }
        .island:hover {
          box-shadow: 0 12px 32px rgba(16, 36, 63, 0.14);
        }
        .pane {
          display: flex;
          flex-direction: column;
          text-align: center;
          padding: 24px;
          min-height: 0;
          overflow-y: auto;
        }
        .pane-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          min-height: 0;
          margin: auto 0;
        }
        .pdf-btn-primary {
          padding: 16px 32px; 
          border-radius: 12px; 
          background: linear-gradient(135deg, #339eea, #0d5a91); 
          border: none; 
          color: white; 
          font-weight: 800; 
          font-size: 1.1rem; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          box-shadow: 0 4px 12px rgba(51, 158, 234, 0.3); 
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pdf-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(51, 158, 234, 0.4);
        }
        @keyframes toastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `,
        }}
      />
    </div>
  );
}
