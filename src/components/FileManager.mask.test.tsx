import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MaskLegend } from './MaskLegend';

describe('Máscaras UI - MaskLegend', () => {
  it('debe mostrar los nombres de las clases cuando recibe la máscara con labels', () => {
    const entries = [
      { id: '0', name: 'Ferrita', color: [0, 255, 0] as [number, number, number] },
      { id: '1', name: 'Perlita', color: [255, 0, 0] as [number, number, number] }
    ];

    render(
      <MaskLegend 
        maskLegendEntries={entries}
        isMaskLoading={false}
        currentMaskUrl="http://test/mask.png"
        isMaskVisible={true}
      />
    );

    expect(screen.getByText('Ferrita')).toBeInTheDocument();
    expect(screen.getByText('Perlita')).toBeInTheDocument();
    expect(screen.getByText(/Estado: máscara visible/i)).toBeInTheDocument();
  });

  it('debe mostrar el estado "generando máscara" cuando está cargando', () => {
    render(
      <MaskLegend 
        maskLegendEntries={[]}
        isMaskLoading={true}
        currentMaskUrl=""
        isMaskVisible={false}
      />
    );

    expect(screen.getByText(/Estado: generando máscara/i)).toBeInTheDocument();
  });

  it('debe indicar "sin máscara generada" cuando no hay URL ni está cargando', () => {
    render(
      <MaskLegend 
        maskLegendEntries={[]}
        isMaskLoading={false}
        currentMaskUrl=""
        isMaskVisible={false}
      />
    );

    expect(screen.getByText(/Estado: sin máscara generada/i)).toBeInTheDocument();
  });
});
