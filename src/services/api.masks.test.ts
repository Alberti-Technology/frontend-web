import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMask, saveMask, generateMaskWithHf } from './api';

// Mock simple de fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API - Máscaras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Proveer un token dummy para que getHeaders no falle
    localStorage.setItem("access_token", "test-token");
  });

  describe('getMask', () => {
    it('debe retornar null si la respuesta es 404', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      const result = await getMask(1);
      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('metalografia/mask/1/'),
        expect.any(Object)
      );
    });

    it('debe retornar la máscara y parsear las labels si el request es exitoso', async () => {
      const mockResponse = {
        mask_type: 'hf_segmentation',
        mask_url: 'http://test.url/mask.png',
        labels: {
          '0': { name: 'Fase A', color: [255, 0, 0] }
        }
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await getMask(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('saveMask', () => {
    it('debe enviar la máscara procesada como blob y retornar la url resultante', async () => {
      // 1. Mock de la lectura del Data URL
      mockFetch.mockResolvedValueOnce({
        blob: async () => new Blob(['dummy'], { type: 'image/png' })
      });

      // 2. Mock de la petición a la API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ image_url: 'http://test.url/new-mask.png' })
      });

      const result = await saveMask(1, 'data:image/png;base64,123', { '0': { name: 'A', color: [255,0,0] } });
      
      expect(result).toBe('http://test.url/new-mask.png');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const lastCallArgs = mockFetch.mock.calls[1];
      expect(lastCallArgs[0]).toContain('metalografia/predict/1/');
      expect(lastCallArgs[1].method).toBe('POST');
      expect(lastCallArgs[1].body).toBeInstanceOf(FormData);
    });
  });

  describe('generateMaskWithHf', () => {
    it('debe enviar una imagen al endpoint de HF y retornar una data url para la máscara generada', async () => {
      // 1. Lectura de la imagen original
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['dummy'], { type: 'image/jpeg' }),
      });

      // 2. Envío a HF y recepción
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          mask_url: 'http://test.hf/mask.png',
          labels: {}
        })
      });

      const result = await generateMaskWithHf('http://mi-imagen.com/img.jpg');
      
      expect(result).toHaveProperty('url');
      expect(result.url).toBe('http://test.hf/mask.png');
      
      const hfCallArgs = mockFetch.mock.calls[1];
      expect(hfCallArgs[0]).toContain('https://dlalberti.duckdns.org:7860/segment/45951/rgb/');
      expect(hfCallArgs[1].method).toBe('POST');
    });
  });
});
