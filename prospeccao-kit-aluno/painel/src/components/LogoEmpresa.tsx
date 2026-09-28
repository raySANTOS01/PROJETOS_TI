'use client';

import { useState } from 'react';

/**
 * O icone do site da empresa num quadrado. Sem site, ou se o icone nao carregar, mostra as iniciais
 * na cor da classe — a linha nunca fica com um buraco.
 */
export function LogoEmpresa({ src, nome, cor, tamanho = 64 }: { src: string | null; nome: string; cor: string; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  const iniciais = nome
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || nome.slice(0, 2).toUpperCase();

  return (
    <div
      className="shrink-0 rounded-xl flex items-center justify-center overflow-hidden border"
      style={{ width: tamanho, height: tamanho, borderColor: `${cor}55`, background: src && !falhou ? '#fff' : `${cor}22` }}
    >
      {src && !falhou ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-3/5 h-3/5 object-contain" onError={() => setFalhou(true)} />
      ) : (
        <span className="titulo" style={{ color: cor, fontSize: tamanho * 0.34 }}>{iniciais}</span>
      )}
    </div>
  );
}
