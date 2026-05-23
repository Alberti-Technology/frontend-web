const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/").trim();
const rawCloudinaryBaseUrl = (
  import.meta.env.VITE_CLOUDINARY_BASE_URL || ""
).trim();

function normalizeBaseUrl(rawUrl: string, envVarName: string): string {
  let parsed: URL;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    parsed = new URL(rawUrl, base);
  } catch {
    throw new Error(`${envVarName} no es una URL valida: ${rawUrl}`);
  }

  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }

  return parsed.toString();
}

export const API_BASE_URL = normalizeBaseUrl(
  rawApiBaseUrl,
  "VITE_API_BASE_URL",
);

export const CLOUDINARY_BASE_URL = rawCloudinaryBaseUrl
  ? normalizeBaseUrl(rawCloudinaryBaseUrl, "VITE_CLOUDINARY_BASE_URL")
  : "";

export const API_BASE_URL_NO_TRAILING = API_BASE_URL.replace(/\/$/, "");

export const API_ORIGIN = new URL(API_BASE_URL).origin;

export const API_WAKEUP_RETRY_MS = 5000;
