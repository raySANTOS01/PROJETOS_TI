export function Titulo({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-7">
      <div className="acento mb-4" />
      <h1 className="text-3xl">{children}</h1>
      {sub && <p className="text-apagado text-sm mt-2 font-light">{sub}</p>}
    </div>
  );
}

/** `larga` tira o teto de largura, para uma tela que precise de mais colunas. */
export function Pagina({ children, larga }: { children: React.ReactNode; larga?: boolean }) {
  return <div className={`p-6 lg:p-9 ${larga ? '' : 'max-w-[1500px]'}`}>{children}</div>;
}

export function Metrica({
  rotulo, valor, nota, destaque,
}: { rotulo: string; valor: string | number; nota?: string; destaque?: boolean }) {
  return (
    <div className="cartao p-5">
      <p className="rotulo mb-2">{rotulo}</p>
      <p className={`titulo text-3xl leading-none ${destaque ? 'text-destaque' : 'text-texto'}`}>{valor}</p>
      {nota && <p className="text-xs text-apagado mt-2 font-light">{nota}</p>}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-apagado/70 font-light py-8 text-center">{children}</p>;
}

export function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="rotulo">{rotulo}</p>
      <p className="text-sm">{valor ?? '—'}</p>
    </div>
  );
}
