import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { exigirPermissao } from '@/lib/auth/dal';
import { hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { diaDaSemanaISO } from '@/lib/calendario/regras';
import { proximaSegunda } from '@/lib/comunicacao/periodicas';
import { resumosDaSemana } from '@/lib/comunicacao/periodicas-servidor';
import { FormularioResumo } from './formulario';

export const metadata: Metadata = { title: 'Mensagens periódicas — SGC-Redes' };

const br = (iso: string) => iso.split('-').reverse().join('/');

function segundaValida(v: string | undefined): string | null {
  if (!v) return null;
  try {
    validarDataISO(v);
  } catch {
    return null;
  }
  return diaDaSemanaISO(v) === 1 ? v : null;
}

export default async function PaginaPeriodicas({ searchParams }: { searchParams: Promise<{ segunda?: string }> }) {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const params = await searchParams;
  const hoje = hojeEmFortaleza();
  const segunda = segundaValida(params.segunda) ?? proximaSegunda(hoje);
  const resumos = await resumosDaSemana(segunda, hoje);
  const pendentes = resumos.filter((r) => !r.enviado).length;

  return (
    <>
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/comunicacao" className="text-if-verde-700 underline underline-offset-2">Comunicação</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Mensagens periódicas</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Resumo semanal dos docentes</h1>
      <p className="mt-1 max-w-3xl text-slate-700">
        Uma mensagem por docente, com as aulas da semana de {br(segunda)} a {br(somarDias(segunda, 4))}, as mudanças e os prazos calculados pelo calendário
        (reposição, frequência e entrega da etapa). O melhor dia para enviar é a sexta-feira. Revise o texto, envie e registre: cada docente recebe um
        resumo por semana.
      </p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link href={`/comunicacao/periodicas?segunda=${somarDias(segunda, -7)}`} className="text-if-verde-700 underline underline-offset-2">Semana anterior</Link>
        <Link href={`/comunicacao/periodicas?segunda=${somarDias(segunda, 7)}`} className="text-if-verde-700 underline underline-offset-2">Semana seguinte</Link>
      </p>

      {resumos.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhum docente com aulas ofertadas neste período.</Alerta>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-slate-800" role="status">
            {pendentes === 0 ? 'Todos os resumos desta semana foram registrados.' : `${pendentes} de ${resumos.length} resumos ainda não registrados.`}
          </p>
          <ul className="mt-3 space-y-4">
            {resumos.map((r) => (
              <li key={r.mensagem.chave} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm text-slate-700">
                  {r.enviado ? '✔ Envio registrado.' : r.temAvisos ? 'Tem mudanças ou prazos nesta semana.' : 'Só a grade da semana.'}
                </p>
                <CaixaMensagem mensagem={r.mensagem} mostrarWhatsapp={usuario.usaWhatsapp}>
                  <FormularioResumo segunda={segunda} docenteId={r.mensagem.chave.split(':')[2]!} mostrarWhatsapp={usuario.usaWhatsapp} enviado={r.enviado} />
                </CaixaMensagem>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
