import 'server-only';
import { prisma } from '@/lib/db';
import { NOME_PERFIL, type Permissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData, NOME_STATUS } from '@/lib/ausencias/regras';
import { COLUNAS_GRADE, linhaDaGrade } from '@/lib/importacao/grade';
import { COLUNAS_CALENDARIO, INSTRUCOES_CALENDARIO, linhasDoCalendario } from '@/lib/importacao/calendario';
import { carregarAno } from '@/lib/calendario/servidor';
import { periodoDaUrl } from '@/lib/grade/regras';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { formatarWhatsapp } from '@/lib/usuarios/regras';
import { NOME_CANAL } from '@/lib/ausencias/mensagens';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { linhasDoRelatorio } from '@/lib/relatorios/agregacoes';
import { carregarRelatorio } from '@/lib/relatorios/servidor';

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
        colunas: COLUNAS_GRADE.map((c) => [c.titulo, c.largura]),
        linhas: cs.map((c) =>
          linhaDaGrade({ turma: c.turma.codigo, diaSemana: c.diaSemana, bloco: c.bloco, disciplina: c.oferta?.disciplina.nome ?? '', professor: c.oferta?.professor.nome ?? '' }),
        ),
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
      return {
        nomeArquivo: `calendario-${cal.ano}`,
        colunas: COLUNAS_CALENDARIO.map((c) => [c.titulo, c.largura]),
        linhas: linhasDoCalendario(cal),
        notas: [
          `Dias letivos no ano: ${cal.contagem.letivos.length} (meta 200).`,
          ...cal.etapas.map((e, i) => `Etapa N${i + 1}: ${e ? `${formatarData(e.inicio)} a ${formatarData(e.fim)} — ${cal.porEtapa[i]} dia(s) letivo(s)` : 'não cadastrada'}.`),
          '',
          ...INSTRUCOES_CALENDARIO.slice(1),
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
  },  relatorios: {
    titulo: 'Relatório consolidado',
    permissao: 'relatorios:ver',
    dadosPessoais: false,
    gerar: async (sp) => {
      const ano = anoDaUrl(sp);
      return {
        nomeArquivo: `relatorio-${ano}`,
        colunas: [['Seção', 22], ['Período', 16], ['Indicador', 44], ['Valor', 10]],
        linhas: linhasDoRelatorio(await carregarRelatorio(ano)),
        notas: ['Só números, sem nomes de estudantes nem motivos (LGPD). Use filtro ou tabela dinâmica por Seção e Indicador.'],
      };
    },
  },
  comunicacao: {
    titulo: 'Histórico de comunicação',
    permissao: 'comunicacao:enviar',
    dadosPessoais: true,
    gerar: async (sp) => {
      const ano = anoDaUrl(sp);
      const logs = await prisma.logComunicacao.findMany({
        where: { enviadoEm: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) } },
        orderBy: { enviadoEm: 'desc' },
        take: 5000,
      });
      const ids = [...new Set(logs.map((l) => l.userId).filter((x): x is string => !!x))];
      const nomes = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]));
      const dataHora = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' });
      return {
        nomeArquivo: `comunicacao-${ano}`,
        colunas: [['Data e hora', 18], ['Destino', 34], ['Assunto', 40], ['Forma de envio', 22], ['Registrado por', 30], ['Situação', 10], ['Mensagem', 80]],
        linhas: logs.map((l) => [
          dataHora(l.enviadoEm),
          l.canal ? NOME_CANAL[l.canal] : (l.destino ?? ''),
          l.assunto ?? '',
          NOME_MODO[l.modoEnvio] ?? l.modoEnvio,
          l.userId ? (nomes.get(l.userId) ?? '') : '',
          l.sucesso ? 'Enviado' : 'Falhou',
          l.mensagem,
        ]),
        notas: [`Envios registrados em ${ano} (até 5.000, os mais recentes primeiro).`],
      };
    },
  },
};
