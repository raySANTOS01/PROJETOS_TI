import { classeInfo } from '@/lib/prospeccao';

/** A classe da prospeccao (A/B/C/D) com a nota. Mesmo desenho do selo de etapa do funil. */
export function SeloClasse({ classe, score }: { classe: string | null; score: number | null }) {
  const c = classeInfo(classe);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: c.cor, borderColor: `${c.cor}55`, background: `${c.cor}14` }}
      title={c.rotulo}
    >
      <span className="font-bold">{c.id}</span>
      {score ?? 0}
    </span>
  );
}
