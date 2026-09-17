'use client';

import type { CSSProperties, ReactNode } from 'react';

export interface Marca {
  id: string;
  offsetInicio: number;
  offsetFim: number;
  estilo: CSSProperties;
  /** Rótulo do botão exibido no lugar de um trecho vazio (ponto de inserção, ex.: cláusula ausente). */
  rotuloInsercao?: string;
}

/**
 * Renderiza um texto plano com trechos marcados (cor de fundo clicável),
 * calculados a partir de offsets — usado nas Telas 2 e 3 para destacar
 * sinalizações e correções diretamente no corpo da minuta. Preserva quebras
 * de linha do texto original via white-space: pre-wrap, então não precisa
 * segmentar em parágrafos manualmente.
 */
export function TextoComMarcas({
  texto,
  marcas,
  aoSelecionar,
}: {
  texto: string;
  marcas: Marca[];
  aoSelecionar?: (id: string) => void;
}) {
  const ordenadas = [...marcas].sort((a, b) => a.offsetInicio - b.offsetInicio);
  const partes: ReactNode[] = [];
  let cursor = 0;

  for (const marca of ordenadas) {
    if (marca.offsetInicio < cursor) continue; // sobreposição inesperada: ignora a segunda
    if (marca.offsetInicio > cursor) {
      partes.push(texto.slice(cursor, marca.offsetInicio));
    }

    if (marca.offsetFim > marca.offsetInicio) {
      partes.push(
        <span
          key={marca.id}
          onClick={aoSelecionar ? () => aoSelecionar(marca.id) : undefined}
          style={{ cursor: aoSelecionar ? 'pointer' : undefined, padding: '1px 2px', ...marca.estilo }}
        >
          {texto.slice(marca.offsetInicio, marca.offsetFim)}
        </span>
      );
    } else {
      partes.push(
        <button
          key={marca.id}
          type="button"
          onClick={aoSelecionar ? () => aoSelecionar(marca.id) : undefined}
          className="tag"
          style={{ margin: '0 4px', cursor: aoSelecionar ? 'pointer' : undefined, ...marca.estilo }}
        >
          {marca.rotuloInsercao ?? '+ trecho ausente'}
        </button>
      );
    }
    cursor = Math.max(cursor, marca.offsetFim);
  }

  if (cursor < texto.length) partes.push(texto.slice(cursor));

  return <div style={{ whiteSpace: 'pre-wrap' }}>{partes}</div>;
}
