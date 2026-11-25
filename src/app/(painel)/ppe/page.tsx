import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta, BotaoSecundario, Campo } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { acumulaDocencia, ehDocente, temPermissao, temPermissaoDoCargo } from '@/lib/auth/rbac';
import { AlternarEscopo } from '@/components/escopo';
import { anoDoSemestre, FORMATO_SEMESTRE, NOME_MODALIDADE, NOME_STATUS_PPE, semestreAtual } from '@/lib/ppe/regras';
import { disciplinasDoDocente } from '@/lib/ppe/servidor';

export const metadata: Metadata = { title: 'PPE / PEI — SGC-Redes' };

export default async function PaginaPpe({ searchParams }: { searchParams: Promise<{ semestre?: string; aviso?: string; escopo?: string }> }) {
  const { usuario } = await exigirPermissao('ppe:ver');
  const gerenciar = temPermissao(usuario, 'ppe:gerenciar');
  const params = await searchParams;
  // O cargo (Coordenação, CTP) vê todas; a docência, as das disciplinas que leciona. Quem acumula os dois alterna.
  const cargoVeTodas = gerenciar || temPermissaoDoCargo(usuario, 'ppe:ver');
  const alterna = cargoVeTodas && acumulaDocencia(usuario);
  const docente = (!cargoVeTodas && ehDocente(usuario)) || (alterna && params.escopo === 'minhas');
  const semestre = params.semestre && FORMATO_SEMESTRE.test(params.semestre) ? params.semestre : semestreAtual();
  const minhas = docente ? [...(await disciplinasDoDocente(usuario.id, anoDoSemestre(semestre)))] : null;

  const registros = await prisma.registroPPE.findMany({
    where: { semestre, ...(minhas ? { disciplinaId: { in: minhas } } : {}) },
    orderBy: [{ nomeEstudante: 'asc' }, { disciplina: { nome: 'asc' } }],
    include: { disciplina: { select: { nome: true } } },
  });
  const retidos = new Set(registros.filter((r) => r.alertaRetencao).map((r) => r.matricula));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PPE / PEI</h1>
          <p className="mt-1 text-slate-700">
            Progressão Parcial de Estudos (ROD, Arts. 115–128).{' '}
            {docente ? 'Você vê as PPEs das disciplinas que leciona.' : 'Visível também à CTP e ao Conselho de Classe (Art. 127).'}
          </p>
        </div>
        {gerenciar && (
          <Link href="/ppe/nova" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Registrar PPE
          </Link>
        )}
      </div>

      {alterna && (
        <AlternarEscopo
          hrefTodas={`/ppe?semestre=${semestre}`}
          hrefMinhas={`/ppe?semestre=${semestre}&escopo=minhas`}
          minhas={docente}
          rotuloTodas="Todas as PPE"
          rotuloMinhas="Minhas PPE (Docência)"
        />
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {docente && alterna && <input type="hidden" name="escopo" value="minhas" />}
        <Campo id="semestre" rotulo="Semestre" defaultValue={semestre} className="w-32" />
        <BotaoSecundario type="submit">Ver</BotaoSecundario>
      </form>

      {params.aviso === 'excluida' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">PPE excluída.</Alerta>
        </div>
      )}
      {retidos.size > 0 && (
        <div className="mt-4">
          <Alerta tipo="erro">
            Art. 115: {retidos.size} estudante(s) com 3 ou mais componentes pendentes em {semestre} — a PPE vale para até 2 componentes; o caso é de
            retenção.
          </Alerta>
        </div>
      )}

      {registros.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhuma PPE em {semestre}.</Alerta>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">PPEs do semestre {semestre}</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Estudante</th>
                <th scope="col" className="px-4 py-3 font-semibold">Componente</th>
                <th scope="col" className="px-4 py-3 font-semibold">Modalidade</th>
                <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r) => (
                <tr key={r.id} className={r.alertaRetencao ? 'bg-if-vermelho-50' : ''}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    <span className="font-semibold">{r.nomeEstudante}</span>
                    <span className="block text-slate-600">Matrícula {r.matricula}</span>
                    {r.alertaRetencao && <span className="block text-xs font-semibold text-if-vermelho-700">⚠ Retenção (Art. 115)</span>}
                  </th>
                  <td className="px-4 py-3">
                    <Link href={`/ppe/${r.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                      {r.disciplina.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{NOME_MODALIDADE[r.modalidade]}</td>
                  <td className="px-4 py-3">{NOME_STATUS_PPE[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
