import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import './globals.css';

// Tipografia institucional da Marca IF (manual 2015, p. 16).
// next/font baixa a fonte no build e a serve localmente (sem requisições externas em runtime).
const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
});

export const metadata: Metadata = {
  title: 'SGC-Redes — IFCE Boa Viagem',
  description: 'Painel da Coordenação do Curso Técnico Integrado em Redes de Computadores',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={openSans.variable}>
      <body className="min-h-screen bg-white font-sans text-base leading-relaxed text-slate-900 antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
