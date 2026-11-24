import 'server-only';
import { prisma } from '@/lib/db';
import { NOME_PERFIL, type Permissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData, NOME_STATUS } from '@/lib/ausencias/regras';
import { NOME_TIPO_EVENTO } from '@/lib/calendario/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { NOME_DIA, NOME_DIA_EXTENSO, periodoDaUrl } from '@/lib/grade/regras';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { formatarWhatsapp } from '@/lib/usuarios/regras';

export interface Listagem {
  titulo: string;
  permissao: Permissao;
  /** Contém dados pessoais (nome, e-mail, telefone): a exportação é registrada na auditoria. */
  dadosPessoais: boolean;
  gerar: (sp: URLSearchParams) => Promise<{ nomeArquivo: string; colunas: [string, number][]; linhas: string[][]; notas?: string[] }>;
}

const simNao = (v: boolean) => (v ? 'Sim' : 'Não');
const anoDaUrl = (sp: URLSearchParams) => lerAnoLetivo(sp.get('ano')) ?? anoLetivoAtual();

/** Listagens que podem ser exportadas em planilha (.xlsx ou .csv). */
export const LISTAGENS: Record<string, Listagem> = {
  usuarios: {
    titulo: 'Usuários',
    permissao: 'usuarios:gerenciar',
    dadosPessoais: true,
    gerar: async () => {
      const us = await prisma.user.findMany({ orderBy: { nome: 'asc' } });
      return {
        nomeArquivo: 'usuarios-sgc-redes',
        colunas: [['Nome completo', 36], ['E-mail', 34], ['Perfil', 24], ['SIAPE', 12], ['WhatsApp', 18], ['Usa WhatsApp no sistema', 14], ['Ativo', 8], ['Último acesso', 18]],
        linhas: us.map((u) => [
          u.nome,
          u.email,
          NOME_PERFIL[u.role],
          u.siape ?? '',
          formatarWhatsapp(u.whatsapp),
          simNao(u.usaWhatsapp),
          simNao(u.ativo),
          u.ultimoLoginEm ? u.ultimoLoginEm.toISOString().slice(0, 10).split('-').reverse().join('/') : '',
        ]),
      };
    },
  },
  turmas: {
    titulo: 'Turmas',
    permissao: 'turmas:gerenciar',
    dadosPessoais: false,
    gerar: async () => {
      const ts = await prisma.turma.findMany({ orderBy: { codigo: 'asc' } });
      return {
        nomeArquivo: 'turmas-sgc-redes',
        colunas: [['Código', 12], ['Nome', 30], ['Ano do curso', 12], ['Estudantes ativos', 12], ['Média lanche manhã', 12], ['Média almoço', 12], ['Média lanche tarde', 12], ['Ativa', 8]],
        linhas: ts.map((t) => [t.codigo, t.nome, t.anoCurso ? `${t.anoCurso}º` : '', String(t.qtdAlunosAtivos), String(t.qtdMediaLancheManha), String(t.qtdMediaAlmoco), String(t.qtdMediaLancheTarde), simNao(t.ativa)]),
      };
    },
  },
  disciplinas: {
    titulo: 'Disciplinas (catálogo)',
    permissao: 'disciplinas:ver',
    dadosPessoais: false,
    gerar: async () => {
      const ds = await prisma.disciplina.findMany({ orderBy: [{ anoCurso: 'asc' }, { semestreCurso: 'asc' }, { nome: 'asc' }] });
      return {
        nomeArquivo: 'disciplinas-sgc-redes',
        colunas: [['Código', 14], ['Nome', 40], ['Ano do curso', 12], ['Semestre do curso', 12], ['Carga horária', 12], ['Núcleo', 16], ['Ativa', 8]],
        linhas: ds.map((d) => [d.codigo ?? '', d.nome, d.anoCurso ? `${d.anoCurso}º` : '', d.semestreCurso ? String(d.semestreCurso) : 'Anual', String(d.cargaHoraria), d.nucleo ?? '', simNao(d.ativa)]),
      };
    },
  },
  ofertas: {
    titulo: 'Ofertas (distribuição de disciplinas)',
    permissao: 'ofertas:gerenciar',
    dadosPessoais: true,
    gerar: async (sp) => {
      const ano = anoDaUrl(sp);
      const os = await prisma.disciplinaOferta.findMany({
        where: { anoLetivo: ano },
        orderBy: [{ turma: { codigo: 'asc' } }, { disciplina: { nome: 'asc' } }],
        include: { turma: { select: { codigo: true } }, disciplina: { select: { nome: true, codigo: true } }, professor: { select: { nome: true, email: true } } },
      });
      return {
        nomeArquivo: `ofertas-${ano}-exportadas`,
        colunas: [['Ano letivo', 10], ['Semestre', 10], ['Turma', 12], ['Código', 14], ['Disciplina', 40], ['Professor', 30], ['E-mail do professor', 32], ['Aulas previstas', 10], ['Aulas ministradas', 10], ['Diário em dia', 10]],
        linhas: os.map((o) => [
          String(o.anoLetivo),
          o.semestreLetivo ? `${o.semestreLetivo}º` : 'Anual',
          o.turma.codigo,
          o.disciplina.codigo ?? '',
          o.disciplina.nome,
          o.professor.nome,
          o.professor.email,
          String(o.aulasPrevistas),
          String(o.aulasMinistradas),
          simNao(o.diarioEmDia),
        ]),
      };
    },
  },
  grade: {
    titulo: 'Grade horária (todas as turmas)',
    permissao: 'grade:ver',
    dadosPessoais: false,
    gerar: async (sp) => {
      const { anoLetivo, semestreLetivo } = periodoDaUrl({ ano: sp.get('ano') ?? undefined, sem: sp.get('sem') ?? undefined });
      const cs = await prisma.gradeHorario.findMany({
        where: { anoLetivo, semestreLetivo, ofertaId: { not: null } },
        orderBy: [{ turma: { codigo: 'asc' } }, { diaSemana: 'asc' }, { bloco: { turno: 'asc' } }, { bloco: { ordem: 'asc' } }],
        include: {
          turma: { select: { codigo: true } },
          bloco: true,
          oferta: { select: { disciplina: { select: { nome: true } }, professor: { select: { nome: true } } } },
        },
      });
      return {
        nomeArquivo: `grade-${anoLetivo}-${semestreLetivo}`,
        colunas: [['Turma', 12], ['Dia', 12], ['Turno', 10], ['Bloco', 8], ['Início', 8], ['Fim', 8], ['Disciplina', 40], ['Professor', 30]],
        linhas: cs.map((c) => [
          c.turma.codigo,
          NOME_DIA[c.diaSemana] ?? String(c.diaSemana),
          c.bloco.turno === 'MANHA' ? 'Manhã' : 'Tarde',
          'ABCDEFGH'[c.bloco.ordem - 1] ?? String(c.bloco.ordem),
          c.bloco.horaInicio,
          c.bloco.horaFim,
          c.oferta?.disciplina.nome ?? '',
          c.oferta?.professor.nome ?? '',
        ]),
        notas: [`Período ${anoLetivo}.${semestreLetivo}.`],
      };
    },
  },
  calendario: {
    titulo: 'Calendário acadêmico',
    permissao: 'calendario:ver',
    dadosPessoais: false,
    gerar: async (sp) => {
      const cal = await carregarAno(anoDaUrl(sp));
      const linhas = [
        ...cal.eventos.map((e) => ({
          inicio: e.inicio,
          l: [formatarData(e.inicio), formatarData(e.fim), NOME_TIPO_EVENTO[e.tipo], e.descricao ?? '', e.motivo ?? '', e.suspendeAulas ? 'Sem aula' : 'Mantidas', simNao(e.imprevisto)],
        })),
        ...cal.sabados.map((s) => ({
          inicio: s.data,
          l: [formatarData(s.data), formatarData(s.data), 'Sábado letivo', `Grade de ${NOME_DIA_EXTENSO[s.diaSemanaReferente]}${s.observacao ? ` — ${s.observacao}` : ''}`, '', 'Letivo', 'Não'],
        })),
      ].sort((a, b) => a.inicio.localeCompare(b.inicio));
      return {
        nomeArquivo: `calendario-${cal.ano}`,
        colunas: [['Início', 12], ['Término', 12], ['Tipo', 30], ['Descrição', 40], ['Motivo', 26], ['Aulas', 10], ['Imprevisto', 10]],
        linhas: linhas.map((x) => x.l),
        notas: [
          `Dias letivos no ano: ${cal.contagem.letivos.length} (meta 200).`,
          ...cal.etapas.map((e, i) => `Etapa N${i + 1}: ${e ? `${formatarData(e.inicio)} a ${formatarData(e.fim)} — ${cal.porEtapa[i]} dia(s) letivo(s)` : 'não cadastrada'}.`),
        ],
      };
    },
  },
  ausencias: {
    titulo: 'Ausências docentes',
    permissao: 'ausencias:registrar',
    dadosPessoais: true,
    gerar: async (sp) => {
      const ano = anoDaUrl(sp);
      const as = await prisma.ausenciaDocente.findMany({
        where: { dataAula: { gte: new Date(`${ano}-01-01T00:00:00Z`), lte: new Date(`${ano}-12-31T00:00:00Z`) } },
        orderBy: { dataAula: 'asc' },
        include: { turma: { select: { codigo: true } }, professorAusente: { select: { nome: true } }, oferta: { select: { disciplina: { select: { nome: true } } } } },
      });
      return {
        nomeArquivo: `ausencias-${ano}`,
        colunas: [['Data', 12], ['Turma', 12], ['Disciplina', 36], ['Docente', 30], ['Motivo operacional', 30], ['Situação', 26]],
        linhas: as.map((a) => [formatarData(dataDoBanco(a.dataAula)), a.turma.codigo, a.oferta.disciplina.nome, a.professorAusente.nome, a.motivoOperacional, NOME_STATUS[a.status]]),
      };
    },
  },
};
