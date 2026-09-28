import type { Metadata } from 'next';
import Link from 'next/link';
import { Space_Grotesk, Inter } from 'next/font/google';
import './globals.css';

// Personalize aqui: o nome que aparece na barra de cima e na aba do navegador.
const MARCA = 'Prospecção';

// Space Grotesk nos títulos (geométrica, técnica) e Inter no corpo. Para trocar, escolha outra em
// fonts.google.com e mude o import acima — o globals.css usa as duas pelas variáveis.
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });
const body = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['300', '400', '500', '700'] });

export const metadata: Metadata = {
  title: `${MARCA} · leads`,
  description: 'Os leads achados e qualificados pelo prospectar.mjs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="border-b border-borda">
          <div className="max-w-[1500px] px-6 lg:px-9 h-14 flex items-center gap-3">
            <span className="acento" style={{ width: 18 }} />
            <Link href="/" className="titulo text-sm">{MARCA}</Link>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
