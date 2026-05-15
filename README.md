# Frontend - Alberti Technology

Aplicación construida con React, TypeScript y Vite. Empaquetada como aplicación de escritorio nativa usando Tauri v2.

## Desarrollo Local

Para trabajar en el entorno de desarrollo (con recarga rápida):

1. Instala las dependencias:
   ```bash
   bun install
   ```

2. Ejecuta el entorno como **Aplicación de Escritorio**:
   ```bash
   bun run tauri dev
   ```
   *Nota: Esto abrirá la ventana nativa de tu sistema. Asegúrate de tener el backend corriendo simultáneamente (con `docker compose up` o ejecutando `desktop.py` manualmente en otra terminal).*

## Compilación Final (Producción)

Tauri se encarga de crear el instalador final (`.deb` en Linux, `.msi`/`.exe` en Windows) e inyectar el backend de Python de forma invisible como "Sidecar".

### Prerrequisitos antes de compilar
1. Debes haber compilado el backend previamente usando Nuitka (ver el README del backend).
2. Debes copiar el ejecutable generado (`build/desktop.bin` en Linux o `build/desktop.exe` en Windows) hacia la carpeta `frontend/src-tauri/bin/` bajo el nombre específico requerido por Tauri (ej: `backend-x86_64-unknown-linux-gnu`).

### Compilar Instalador
Una vez tengas el Sidecar en su lugar, simplemente ejecuta:
```bash
bun run tauri build
```
Esto generará los instaladores listos para distribuir a tus usuarios en `frontend/src-tauri/target/release/bundle/`.
