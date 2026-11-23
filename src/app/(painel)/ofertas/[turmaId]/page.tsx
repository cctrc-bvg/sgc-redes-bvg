import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { disciplinasDaDistribuicao, professoresAptos } from '@/lib/ofertas/consultas';
import { anoLetivoAtual, lerAnoLetivo, semestreLetivoDaDisciplina } from '@/lib/ofertas/regras';
import { FormularioDistribuicao, type GrupoDistribuicao } from './formulario-distribuicao';

export const metadata: Metadata = { title: 'Distribuir disciplinas — SGC-Redes' };

export default async function PaginaDistribuicao({
  params,
  searchParams,
}: {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ ano?: string }>;
}) {
  await exigirPermissao('ofertas:gerenciar');
  const { turmaId } = await params;
  const anoLetivo = lerAnoLetivo((await searchParams).ano) ?? anoLetivoAtual();
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) notFound();

  const trilha = (
    <nav aria-label="Trilha" className="text-sm">
      <Link href={`/ofertas?ano=${anoLetivo}`} className="text-if-verde-700 underline underline-offset-2">
        Ofertas {anoLetivo}
      </Link>
      <span aria-hidden="true" className="text-slate-500"> / </span>
      <span aria-current="page" className="text-slate-700">{turma.nome}</span>
    </nav>
  );

  if (!turma.anoCurso) {
    return (
      <div className="max-w-3xl">
        {trilha}
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{turma.nome}</h1>
        <div className="mt-6">
          <Alerta tipo="erro">Esta turma não tem o ano do curso definido, então não é possível listar as disciplinas da matriz.</Alerta>
        </div>
      </div>
    );
  }

  const [disciplinas, professores] = await Promise.all([
    disciplinasDaDistribuicao({ id: turma.id, anoCurso: turma.anoCurso }, anoLetivo),
    professoresAptos(),
  ]);
  const aptos = new Set(professores.map((p) => p.id));

  // Professores desativados que ainda constam em alguma oferta: nome para exibir na própria linha.
  const idsInativos = disciplinas.flatMap((d) => d.ofertas.map((o) => o.professorId)).filter((id) => !aptos.has(id));
  const inativos = new Map(
    (await prisma.user.findMany({ where: { id: { in: idsInativos } }, select: { id: true, nome: true } })).map((u) => [u.id, u]),
  );

  const titulos = { anual: 'Anuais (propedêuticas e diversificadas)', 1: `Técnicas — ${anoLetivo}.1`, 2: `Técnicas — ${anoLetivo}.2` };
  const grupos = new Map<keyof typeof titulos, GrupoDistribuicao>();
  for (const d of disciplinas) {
    const chave = semestreLetivoDaDisciplina(d.semestreCurso) ?? 'anual';
    if (!grupos.has(chave)) grupos.set(chave, { titulo: titulos[chave], linhas: [] });
    const oferta = d.ofertas[0];
    const detalhe = [d.codigo, `${d.cargaHoraria}h`, !d.ativa && 'disciplina desativada'].filter(Boolean).join(' · ');
    grupos.get(chave)!.linhas.push({
      disciplinaId: d.id,
      nome: d.nome,
      detalhe,
      professorId: oferta?.professorId ?? '',
      professorInativo: oferta && !aptos.has(oferta.professorId) ? inativos.get(oferta.professorId) : undefined,
      bloqueioRemocao: Boolean(oferta && (oferta._count.horarios > 0 || oferta._count.ausencias > 0)),
    });
  }
  const ordenados = (['anual', 1, 2] as const).flatMap((k) => (grupos.has(k) ? [grupos.get(k)!] : []));
  const comProfessor = disciplinas.filter((d) => d.ofertas.length > 0).length;

  return (
    <div className="max-w-3xl">
      {trilha}
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {turma.nome} — {anoLetivo}
      </h1>
      <p className="mt-1 text-slate-700">
        {comProfessor} de {disciplinas.length} disciplina(s) com professor. Escolha o professor de cada disciplina e salve no fim da página.
      </p>

      {professores.length === 0 && (
        <div className="mt-4">
          <Alerta tipo="info">
            Nenhum professor ativo cadastrado. <Link href="/usuarios/novo" className="underline">Cadastre os professores</Link> antes de distribuir as disciplinas.
          </Alerta>
        </div>
      )}
      {disciplinas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">
            Nenhuma disciplina ativa do {turma.anoCurso}º ano no catálogo. <Link href="/disciplinas" className="underline">Ver catálogo</Link>.
          </Alerta>
        </div>
      ) : (
        <div className="mt-6">
          <FormularioDistribuicao turmaId={turma.id} anoLetivo={anoLetivo} grupos={ordenados} professores={professores} />
        </div>
      )}
    </div>
  );
}
