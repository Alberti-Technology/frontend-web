import React from 'react';
import { HfMaskLabels } from '../services/api';

interface MaskLegendProps {
  maskLegendEntries: { id: string; name: string; color: [number, number, number] }[];
  isMaskLoading: boolean;
  currentMaskUrl: string;
  isMaskVisible: boolean;
}

export function MaskLegend({ maskLegendEntries, isMaskLoading, currentMaskUrl, isMaskVisible }: MaskLegendProps) {
  return (
    <>
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
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={entry.name}
              >
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ opacity: 0.7, fontSize: "0.8rem", fontStyle: "italic" }}>
          No hay etiquetas para esta máscara.
        </div>
      )}
    </>
  );
}
