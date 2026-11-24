/**
 * Dados de DEMONSTRAÇÃO (fictícios) para conhecer o sistema, desenvolver telas e gerar as capturas do
 * módulo Ajuda. Nunca rode em produção: cria usuários com senha conhecida.
 *
 *   npm run db:demo -- --confirmo        (depois de `npm run db:seed`)
 *
 * Todos os usuários de demonstração usam e-mail @exemplo.edu.br e a senha de DEMO_SENHA
 * (padrão: Demonstracao2026). Nomes, matrículas e processos são inventados.
 */
import { PrismaClient, type Role, type TipoEventoCalendario } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { anoLetivoAtual, semestreLetivoDaDisciplina } from '../src/lib/ofertas/regras';
import { aulasSemanaisPrevistas, semestreLetivoAtual } from '../src/lib/grade/regras';
import { calcularHorasAtividadePpi } from '../src/lib/ppi-ppe-engines';

const prisma = new PrismaClient();
const DOMINIO = 'exemplo.edu.br';

const PESSOAS: { nome: string; email: string; role: Role; whatsapp?: string }[] = [
  { nome: 'Coordenação (demonstração)', email: `coordenacao@${DOMINIO}`, role: 'COORDENADOR', whatsapp: '85999990000' },
  { nome: 'Ana Exemplo Lima', email: `ana.lima@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990001' },
  { nome: 'Bruno Exemplo Sousa', email: `bruno.sousa@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990002' },
  { nome: 'Carla Exemplo Rocha', email: `carla.rocha@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990003' },
  { nome: 'Davi Exemplo Matos', email: `davi.matos@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990004' },
  { nome: 'Elisa Exemplo Prado', email: `elisa.prado@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990005' },
  { nome: 'Fábio Exemplo Nunes', email: `fabio.nunes@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990006' },
  { nome: 'Gabriela Exemplo Dias', email: `gabriela.dias@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990007' },
  { nome: 'Heitor Exemplo Alves', email: `heitor.alves@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990008' },
  { nome: 'Iara Exemplo Costa', email: `iara.costa@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990009' },
  { nome: 'Júlio Exemplo Freitas', email: `julio.freitas@${DOMINIO}`, role: 'PROFESSOR', whatsapp: '85999990010' },
  { nome: 'CTP (demonstração)', email: `ctp@${DOMINIO}`, role: 'CTP' },
  { nome: 'Direção de Ensino (demonstração)', email: `direcao@${DOMINIO}`, role: 'DIRECAO' },
  { nome: 'Assistência Estudantil (demonstração)', email: `cae@${DOMINIO}`, role: 'ASSISTENCIA_ESTUDANTIL' },
];

const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const data = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
/** Próximo dia útil a partir de `iso` (inclusive). */
const diaUtil = (iso: string) => {
  let d = iso;
  while (diaSemana(d) === 0 || diaSemana(d) === 6) d = somarDias(d, 1);
  return d;
};

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Dados de demonstração não podem ser carregados em produção.');
  if (!process.argv.includes('--confirmo')) {
    console.log('Isto cria usuários fictícios com senha conhecida. Rode de novo com --confirmo (só em banco de desenvolvimento).');
    process.exit(1);
  }
  if (await prisma.user.findUnique({ where: { email: `coordenacao@${DOMINIO}` } })) {
    console.log('Os dados de demonstração já foram carregados neste banco. Nada a fazer.');
    return;
  }
  const turmas = await prisma.turma.findMany({ where: { ativa: true }, orderBy: { codigo: 'asc' } });
  const blocos = await prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] });
  if (turmas.length === 0 || blocos.length === 0) throw new Error('Rode antes o seed (npm run db:seed).');

  const ano = anoLetivoAtual();
  const sem = semestreLetivoAtual();
  const senha = process.env.DEMO_SENHA || 'Demonstracao2026';
  const hash = await bcrypt.hash(senha, 10);

  // 1. Pessoas
  const usuarios = new Map<string, string>();
  for (const p of PESSOAS) {
    const u = await prisma.user.create({
      data: { nome: p.nome, email: p.email, role: p.role, whatsapp: p.whatsapp ?? null, passwordHash: hash, deveTrocarSenha: false },
    });
    usuarios.set(p.email, u.id);
  }
  const professores = PESSOAS.filter((p) => p.role === 'PROFESSOR').map((p) => usuarios.get(p.email)!);
  const coordenacao = usuarios.get(`coordenacao@${DOMINIO}`)!;

  // 2. Contatos dos grupos e setores (e-mails fictícios)
  const canais: Record<string, [string, string]> = {
    GRUPO_PROFESSORES: [`professores.redes@${DOMINIO}`, 'professores e professoras'],
    GRUPO_GESTAO_DIR_COORD: [`gestao.ensino@${DOMINIO}`, 'Direção de Ensino, Direção Geral e Coordenações'],
    ASSISTENCIA_ESTUDANTIL: [`cae@${DOMINIO}`, 'equipe da CAE'],
    CTP: [`ctp@${DOMINIO}`, 'equipe técnico-pedagógica'],
    LIDERES_TURMA: [`lideres.redes@${DOMINIO}`, 'líderes de turma'],
    NUTRICIONISTA: [`nutricao@${DOMINIO}`, 'nutricionista'],
  };
  for (const [canal, [email, saudacao]] of Object.entries(canais)) {
    await prisma.configuracaoCanal.updateMany({ where: { canal: canal as never }, data: { email, saudacao } });
  }

  // 3. Ofertas do ano: todas as disciplinas da matriz de cada turma, distribuídas entre os professores
  const disciplinas = await prisma.disciplina.findMany({ where: { ativa: true, anoCurso: { not: null } }, orderBy: [{ anoCurso: 'asc' }, { nome: 'asc' }] });
  let k = 0;
  for (const t of turmas) {
    for (const d of disciplinas.filter((x) => x.anoCurso === t.anoCurso)) {
      const previstas = Math.round(d.cargaHoraria * 0.75);
      const atraso = k % 5 === 0;
      await prisma.disciplinaOferta.create({
        data: {
          anoLetivo: ano,
          semestreLetivo: semestreLetivoDaDisciplina(d.semestreCurso),
          turmaId: t.id,
          disciplinaId: d.id,
          professorId: professores[k % professores.length],
          aulasPrevistas: previstas,
          aulasMinistradas: atraso ? Math.round(previstas * 0.7) : previstas - (k % 3),
          diarioEmDia: !atraso,
        },
      });
      k++;
    }
  }

  // 4. Grade do semestre atual: preenche os blocos sem choque de professor (1º e 3º anos de manhã, 2º à tarde,
  //    com duas tardes de regime integral para o 1º ano)
  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo: ano, OR: [{ semestreLetivo: null }, { semestreLetivo: sem }] },
    include: { disciplina: true },
  });
  const ocupado = new Set<string>();
  for (const t of turmas) {
    const turno = t.anoCurso === 2 ? 'TARDE' : 'MANHA';
    const celulas: { dia: number; blocoId: string }[] = [];
    for (let dia = 1; dia <= 5; dia++) {
      for (const b of blocos.filter((x) => x.turno === turno)) celulas.push({ dia, blocoId: b.id });
      if (t.anoCurso === 1 && (dia === 2 || dia === 4)) for (const b of blocos.filter((x) => x.turno === 'TARDE')) celulas.push({ dia, blocoId: b.id });
    }
    const fila = ofertas
      .filter((o) => o.turmaId === t.id)
      .flatMap((o) => Array.from({ length: Math.max(1, aulasSemanaisPrevistas(o.disciplina.cargaHoraria, o.semestreLetivo)) }, () => o));
    for (const c of celulas) {
      // Deixa uma janela livre por turma na sexta (B) para mostrar o recurso.
      if (c.dia === 5 && blocos.find((b) => b.id === c.blocoId)?.ordem === 2) continue;
      const i = fila.findIndex((o) => !ocupado.has(`${o.professorId}|${c.dia}|${c.blocoId}`));
      if (i < 0) continue;
      const [o] = fila.splice(i, 1);
      ocupado.add(`${o.professorId}|${c.dia}|${c.blocoId}`);
      await prisma.gradeHorario.create({ data: { anoLetivo: ano, semestreLetivo: sem, turmaId: t.id, diaSemana: c.dia, blocoId: c.blocoId, ofertaId: o.id } });
    }
  }

  // 5. Calendário acadêmico do ano: etapas, semestres, eventos e um sábado letivo
  const etapas: [string, string][] = [
    [`${ano}-02-09`, `${ano}-04-17`],
    [`${ano}-04-20`, `${ano}-06-30`],
    [`${ano}-07-27`, `${ano}-09-30`],
    [`${ano}-10-01`, `${ano}-12-16`],
  ];
  for (const [i, [inicio, fim]] of etapas.entries()) {
    await prisma.etapaLetiva.upsert({
      where: { anoLetivo_numero: { anoLetivo: ano, numero: i + 1 } },
      create: { anoLetivo: ano, numero: i + 1, inicio: data(inicio), fim: data(fim) },
      update: {},
    });
  }
  for (const [s, inicio, fim] of [
    [1, etapas[0][0], etapas[1][1]],
    [2, etapas[2][0], etapas[3][1]],
  ] as const) {
    await prisma.periodoLetivo.upsert({
      where: { anoLetivo_semestreLetivo: { anoLetivo: ano, semestreLetivo: s } },
      create: { anoLetivo: ano, semestreLetivo: s, inicio: data(inicio), fim: data(fim) },
      update: {},
    });
  }
  const eventos: { tipo: TipoEventoCalendario; inicio: string; fim?: string; descricao?: string; suspende: boolean; imprevisto?: boolean; motivo?: string }[] = [
    { tipo: 'FERIAS_DOCENTES', inicio: `${ano}-01-05`, fim: `${ano}-02-03`, descricao: 'Férias docentes', suspende: true },
    { tipo: 'MATRICULA', inicio: `${ano}-01-26`, fim: `${ano}-01-30`, descricao: 'Matrícula e renovação', suspende: false },
    { tipo: 'ENCONTRO_PEDAGOGICO', inicio: `${ano}-02-04`, fim: `${ano}-02-06`, descricao: 'Encontro pedagógico', suspende: true },
    { tipo: 'ACOLHIDA', inicio: `${ano}-02-09`, descricao: 'Acolhida dos estudantes', suspende: false },
    { tipo: 'FERIADO', inicio: `${ano}-02-16`, fim: `${ano}-02-18`, descricao: 'Carnaval', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-04-03`, descricao: 'Sexta-feira Santa', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-04-21`, descricao: 'Tiradentes', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-05-01`, descricao: 'Dia do Trabalho', suspende: true },
    { tipo: 'PITS_RITS', inicio: `${ano}-03-02`, fim: `${ano}-03-13`, descricao: 'Entrega dos PITs', suspende: false },
    { tipo: 'FERIAS_DOCENTES', inicio: `${ano}-07-06`, fim: `${ano}-07-24`, descricao: 'Recesso escolar', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-09-07`, descricao: 'Independência do Brasil', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-10-12`, descricao: 'Nossa Senhora Aparecida', suspende: true },
    { tipo: 'PONTO_FACULTATIVO', inicio: `${ano}-10-28`, descricao: 'Dia do Servidor Público', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-11-02`, descricao: 'Finados', suspende: true },
    { tipo: 'FERIADO', inicio: `${ano}-11-20`, descricao: 'Dia da Consciência Negra', suspende: true },
    { tipo: 'REUNIAO', inicio: `${ano}-11-11`, descricao: 'Conselho de classe', suspende: false },
    { tipo: 'SUSPENSAO_AULAS', inicio: `${ano}-09-16`, descricao: '', suspende: true, imprevisto: true, motivo: 'Falta de energia' },
    { tipo: 'AVALIACOES_FINAIS', inicio: `${ano}-12-07`, fim: `${ano}-12-16`, descricao: 'Avaliações finais e entrega dos diários', suspende: false },
  ];
  for (const e of eventos) {
    await prisma.eventoCalendario.create({
      data: {
        tipo: e.tipo,
        inicio: data(e.inicio),
        fim: data(e.fim ?? e.inicio),
        descricao: e.descricao || null,
        suspendeAulas: e.suspende,
        imprevisto: e.imprevisto ?? false,
        motivo: e.motivo ?? null,
      },
    });
  }
  await prisma.sabadoLetivo.upsert({
    where: { data: data(`${ano}-10-03`) },
    create: { data: data(`${ano}-10-03`), diaSemanaReferente: 3, observacao: 'Reposição da falta de energia de 16/09' },
    update: {},
  });

  // 6. Ausência pendente no próximo dia útil, com um convite de substituição
  const hoje = hojeISO();
  const dia = diaUtil(somarDias(hoje, 1));
  const aula = await prisma.gradeHorario.findFirst({
    where: { anoLetivo: ano, semestreLetivo: sem, diaSemana: diaSemana(dia), ofertaId: { not: null }, bloco: { turno: 'MANHA' } },
    include: { bloco: true, oferta: true },
    orderBy: { bloco: { ordem: 'asc' } },
  });
  if (aula?.oferta) {
    const ausencia = await prisma.ausenciaDocente.create({
      data: {
        dataAula: data(dia),
        turmaId: aula.turmaId,
        ofertaId: aula.oferta.id,
        professorAusenteId: aula.oferta.professorId,
        blocosAfetados: `M${aula.bloco.ordem}`,
        motivoOperacional: 'Participação em evento',
      },
    });
    const livre = professores.find((p) => p !== aula.oferta!.professorId && !ocupado.has(`${p}|${diaSemana(dia)}|${aula.blocoId}`));
    if (livre) await prisma.conviteSubstituicao.create({ data: { ausenciaId: ausencia.id, blocoId: aula.blocoId, professorId: livre } });
  }

  // 7. Alimentação: acréscimo planejado (encontro de PEI) e um ajuste do dia seguinte
  const turma1 = turmas[0];
  await prisma.alertaAlimentacao.create({
    data: {
      turmaId: turma1.id,
      dataRefeicao: new Date(`${diaUtil(somarDias(hoje, 3))}T15:00:00Z`),
      tipoRefeicao: 'ALMOCO',
      acao: 'ADICIONAR_REFEICAO',
      qtdImpactada: 6,
      antecedenciaMin: 3 * 24 * 60,
      nivelSla: 'VERDE_24H_MAIS',
      manual: true,
      descricao: 'Encontro de PEI no contraturno',
    },
  });
  await prisma.alertaAlimentacao.create({
    data: {
      turmaId: turmas[turmas.length - 1].id,
      dataRefeicao: new Date(`${dia}T12:30:00Z`),
      tipoRefeicao: 'LANCHE_MANHA',
      acao: 'CANCELAR_REFEICAO',
      qtdImpactada: turmas[turmas.length - 1].qtdMediaLancheManha,
      antecedenciaMin: 20 * 60,
      nivelSla: 'AMARELO_4H_A_24H',
      manual: true,
      descricao: 'Visita técnica fora do campus',
    },
  });

  // 8. PPE/PEI (estudantes fictícios)
  const tecnica = disciplinas.find((d) => d.exigePratica) ?? disciplinas[0];
  const outra = disciplinas.find((d) => d.id !== tecnica.id && d.anoCurso === tecnica.anoCurso) ?? disciplinas[1];
  const semestreTexto = `${ano}.${sem}`;
  const ppe1 = await prisma.registroPPE.create({
    data: { semestre: semestreTexto, nomeEstudante: 'Estudante Exemplo Um', matricula: '20260000001', disciplinaId: tecnica.id, modalidade: 'PEI', status: 'EM_ANDAMENTO' },
  });
  await prisma.registroPPE.create({ data: { semestre: semestreTexto, nomeEstudante: 'Estudante Exemplo Dois', matricula: '20260000002', disciplinaId: outra.id } });
  const ofertaTecnica = await prisma.disciplinaOferta.findFirst({ where: { anoLetivo: ano, disciplinaId: tecnica.id } });
  const pei = await prisma.planoEstudoIndividual.create({
    data: {
      ppeId: ppe1.id,
      docenteId: ofertaTecnica?.professorId ?? professores[0],
      cargaHorariaPei: Math.floor(tecnica.cargaHoraria * 0.3),
      horasPresenciais: Math.floor(tecnica.cargaHoraria * 0.2),
      horasPraticas: tecnica.exigePratica ? 4 : 0,
      objetivos: 'Retomar os conceitos fundamentais da disciplina e aplicá-los em atividades práticas orientadas.',
      conteudos: 'Unidades 1 a 3 do programa, com ênfase nas atividades de laboratório.',
      criteriosAval: 'Lista de exercícios e prática avaliada em laboratório.',
    },
  });
  for (const [i, conteudo] of ['Revisão dos conceitos', 'Prática guiada no laboratório', 'Avaliação prática'].entries()) {
    await prisma.peiEncontro.create({ data: { peiId: pei.id, data: data(diaUtil(somarDias(hoje, 7 * (i + 1)))), conteudo, metodologiaAvaliacao: i === 2 ? 'Avaliação prática' : 'Aula expositiva e exercícios' } });
  }

  // 9. PPI: uma solicitação perto da meta
  const regras = await prisma.ppiRegraCategoria.findMany({ orderBy: [{ grupo: 'asc' }, { descricao: 'asc' }] });
  const solicitacao = await prisma.ppiSolicitacao.create({ data: { nomeEstudante: 'Estudante Exemplo Três', matricula: '20240000003', turmaAtual: 'REDES-3' } });
  let total = 0;
  for (const [i, regra] of [regras[0], regras[12], regras[20]].filter(Boolean).entries()) {
    const horas = calcularHorasAtividadePpi({ quantidadeInformada: 2, horasPorUnidade: regra.horasPorUnidade, qtdMaxima: regra.qtdMaxima, pontuacaoMaxima: regra.pontuacaoMaxima });
    total += horas;
    await prisma.ppiAtividade.create({
      data: {
        solicitacaoId: solicitacao.id,
        regraId: regra.id,
        descricaoComprovante: `Certificado fictício ${i + 1}`,
        codigoCertificado: `DEMO-${i + 1}`,
        dataRealizacao: data(`${ano - 1}-0${i + 3}-15`),
        orientadorId: professores[i],
        quantidadeInformada: 2,
        horasCalculadas: horas,
      },
    });
  }
  await prisma.ppiSolicitacao.update({ where: { id: solicitacao.id }, data: { totalValidado: total } });

  // 10. Processos SEI
  const processos: { titulo: string; tipo: 'APROVEITAMENTO_DISCIPLINA' | 'ESTAGIO' | 'GRADUADO_TRANSFERIDO' | 'ORIENTACAO_MEDIACAO'; coluna: 'NOVO' | 'COM_PROFESSOR' | 'AGUARDANDO_RETORNO' | 'CONCLUIDO'; sigiloso?: boolean }[] = [
    { titulo: 'Aproveitamento de Matemática I (exemplo)', tipo: 'APROVEITAMENTO_DISCIPLINA', coluna: 'COM_PROFESSOR' },
    { titulo: 'Termo de estágio — empresa fictícia', tipo: 'ESTAGIO', coluna: 'AGUARDANDO_RETORNO' },
    { titulo: 'Transferência recebida (exemplo)', tipo: 'GRADUADO_TRANSFERIDO', coluna: 'NOVO' },
    { titulo: 'Mediação em sala (registro sigiloso)', tipo: 'ORIENTACAO_MEDIACAO', coluna: 'NOVO', sigiloso: true },
    { titulo: 'Aproveitamento de Inglês (exemplo)', tipo: 'APROVEITAMENTO_DISCIPLINA', coluna: 'CONCLUIDO' },
  ];
  for (const [i, p] of processos.entries()) {
    await prisma.processoKanban.create({
      data: { ...p, sigiloso: p.sigiloso ?? false, numeroSei: `23000.00000${i}/${ano}-00`, prazo: data(somarDias(hoje, 5 + i * 4)), criadoPorId: coordenacao },
    });
  }

  console.log(`Dados de demonstração carregados (${ano}.${sem}).`);
  console.log(`Entre com coordenacao@${DOMINIO} (ou ana.lima@, ctp@, direcao@, cae@${DOMINIO}) e a senha: ${senha}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
