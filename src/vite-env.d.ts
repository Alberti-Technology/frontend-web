/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_CLOUDINARY_BASE_URL: string
  readonly VITE_HF_MASK_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
