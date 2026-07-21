import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Integración de Modelos - Servidor VPS (Metalografía)', () => {
  // Le sacamos el '.skip' para que siempre se pruebe en el CI y desarrollo local.
  it('el endpoint de máscaras debe devolver el formato de contrato esperado', async () => {
    // 1. Leer la imagen real de acero desde el disco local
    const fixturePath = path.join(__dirname, '../tests/__fixtures__/acero.jpg');
    
    if (!fs.existsSync(fixturePath)) {
      throw new Error("Por favor guarda la imagen adjunta como 'acero.jpg' dentro de src/tests/__fixtures__/ para ejecutar el test.");
    }

    const fileBuffer = fs.readFileSync(fixturePath);
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'acero.jpg');

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
