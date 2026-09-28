'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

/** `rotuloTodos` troca o "Todos" do chip sem filtro — na prospeccao, sem filtro e "so os aptos". */
type Grupo = { chave: string; rotulo: string; rotuloTodos?: string; opcoes: { id: string; rotulo: string }[] };

export function FiltroLeads({
  filtro,
  grupos,
  rota = '/leads',
  placeholder = 'Nome, telefone, empresa ou nicho',
}: {
  filtro: Record<string, string | undefined>;
  grupos: Grupo[];
  rota?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [texto, setTexto] = useState(filtro.busca ?? '');

  // Busca com atraso: sem isso cada tecla vira uma consulta ao banco.
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      texto ? p.set('busca', texto) : p.delete('busca');
      router.replace(`${rota}?${p.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function filtrar(chave: string, id: string | null) {
    const p = new URLSearchParams(params.toString());
    id ? p.set(chave, id) : p.delete(chave);
    router.replace(`${rota}?${p.toString()}`);
  }

  const chip = (ativo: boolean) =>
    `text-[12px] px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
      ativo
        ? 'border-destaque text-destaque bg-destaque/10'
        : 'border-borda-forte text-apagado hover:text-texto'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-fit">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="campo"
          // O .campo do globals.css ganha das classes do Tailwind (fica fora das camadas): recuo e largura vao no style.
          style={{ paddingLeft: 36, width: 340 }}
          aria-label="Buscar lead"
        />
      </div>

      {grupos.map((g) => (
        <div key={g.chave} className="flex flex-wrap items-center gap-2">
          <span className="rotulo w-24 mb-0">{g.rotulo}</span>
          <button onClick={() => filtrar(g.chave, null)} className={chip(!filtro[g.chave])}>
            {g.rotuloTodos ?? 'Todos'}
          </button>
          {g.opcoes.map((o) => (
            <button key={o.id} onClick={() => filtrar(g.chave, o.id)} className={chip(filtro[g.chave] === o.id)}>
              {o.rotulo}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
