import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SGC-Redes — IFCE Boa Viagem',
  description: 'Painel da Coordenação do Curso Técnico Integrado em Redes de Computadores',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
