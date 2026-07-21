import { describe, it, expect } from 'vitest';
import { HF_BASE_URL } from './api';

describe('Integración de Modelos - Hugging Face', () => {
  // Se marca con 'skip' para que no rompa los tests locales a menos que se le provea
  // un archivo real de acero. Gradio/FastAPI devuelve 422 Unprocessable Entity
  // si le mandamos un PNG de 1x1 en lugar de una muestra real.
  it.skip('el endpoint de Hugging Face de máscaras debe devolver el formato de contrato esperado', async () => {
    // 1. Crear una imagen básica en memoria (1 píxel blanco) para enviar al modelo
    // Esto evita depender de URLs externas que puedan caerse.
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const blob = await (await fetch('data:image/png;base64,' + transparentPixel)).blob();
    const formData = new FormData();
    formData.append('file', blob, 'test.png');

    const endpoint = 'https://dlalberti.duckdns.org:7860/segment/45951/rgb/';

    // 2. Realizar la petición real al backend de Hugging Face
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    // 3. Validar el contrato de red (HTTP Status)
    expect(response.status).toBe(200);

    // 4. Validar el contrato de respuesta
    const contentType = response.headers.get('content-type') || '';
    
    // El frontend soporta dos contratos:
    // A. Una imagen directa en la respuesta
    // B. Un JSON con la estructura { mask_url: string, labels?: {...} }
    
    if (contentType.startsWith('image/')) {
      const resBlob = await response.blob();
      expect(resBlob.size).toBeGreaterThan(0);
      expect(resBlob.type).toContain('image/');
    } else {
      const payload = await response.json();
      
      // Contrato de estructura del JSON
      expect(payload).toBeDefined();
      
      // Comprobamos si tiene alguna de las keys que usamos en api.ts (mask_url, url, image, output)
      const hasMaskUrl = 'mask_url' in payload || 'url' in payload || 'image' in payload || 'output' in payload;
      expect(hasMaskUrl).toBe(true);

      // Si vienen etiquetas, validamos su estructura ({ name: string, color: [r,g,b] })
      if (payload.labels) {
        expect(typeof payload.labels).toBe('object');
        
        const firstLabelKey = Object.keys(payload.labels)[0];
        if (firstLabelKey) {
          const firstLabel = payload.labels[firstLabelKey];
          expect(firstLabel).toHaveProperty('name');
          expect(firstLabel).toHaveProperty('color');
          expect(Array.isArray(firstLabel.color)).toBe(true);
          expect(firstLabel.color.length).toBeGreaterThanOrEqual(3);
        }
      }
    }
  }, 30000); // 30 segundos de timeout para la IA
});
