import { describe, expect, it } from 'vitest';
import { mensagemAssistencia, mensagemCtp, mensagemGestao, mensagemLideres, mensagemProfessores, mensagensDaAusencia, type DadosMensagem, type ExtrasMensagem, type PessoaMensagem } from './mensagens';

const base: DadosMensagem = {
  turma: 'Redes 2º Ano (Integrado)',
  codigoTurma: 'REDES-2',
  dataISO: '2026-11-26',
  diaSemana: 'quinta-feira',
  disciplina: 'Redes de Computadores',
  professor: 'Ana Souza',
  motivoOperacional: 'Participação em evento',
  status: 'PENDENTE_DECISAO',
  horarios: [
    { bloco: 'Manhã A (07:30–08:30)', situacao: 'pendente' },
    { bloco: 'Manhã B (08:30–09:30)', situacao: 'pendente' },
  ],
  refeicoes: [],
};

describe('mensagens da ausência', () => {
  it('professores: convite só enquanto há horário sem cobertura', () => {
    const msg = mensagemProfessores(base)!;
    expect(msg).toContain('26/11/2026 (quinta-feira)');
    expect(msg).toContain('- Manhã A (07:30–08:30)');
    expect(mensagemProfessores({ ...base, horarios: [{ bloco: 'Manhã A', situacao: 'dispensa' }] })).toBeNull();
  });

  it('líderes: sem nomes de docentes nem motivo', () => {
    const msg = mensagemLideres({
      ...base,
      status: 'AULA_ADIANTADA',
      horarios: [
        { bloco: 'Manhã A', situacao: 'substituicao', detalhe: 'Bruno Lima' },
        { bloco: 'Manhã B', situacao: 'adiantamento', detalhe: 'Banco de Dados (de Tarde A)' },
        { bloco: 'Tarde A', situacao: 'dispensa' },
      ],
    })!;
    expect(msg).toContain('AVISO À TURMA REDES-2');
    expect(msg).toContain('Manhã A: aula normal, com professor(a) substituto(a)');
    expect(msg).toContain('Manhã B: aula adiantada: Banco de Dados (de Tarde A)');
    expect(msg).toContain('Tarde A: sem aula');
    expect(msg).not.toMatch(/Bruno|Ana|evento/);
    expect(mensagemLideres(base)).toBeNull();
  });

  it('gestão (G08): não avisa substituição sem impacto; avisa dispensa e pendência', () => {
    const coberta = { ...base, status: 'COBERTA_POR_SUBSTITUICAO' as const, horarios: [{ bloco: 'Manhã A', situacao: 'substituicao' as const, detalhe: 'Bruno' }] };
    expect(mensagemGestao(coberta)).toBeNull();
    expect(mensagemGestao(base)).toContain('Situação: Aguardando decisão');
    expect(mensagemGestao({ ...base, status: 'TURMA_DISPENSADA' })).toContain('Motivo operacional: Participação em evento');
  });

  it('assistência estudantil: refeições com quantidade e etiqueta de urgência, sem docente', () => {
    const msg = mensagemAssistencia({
      ...base,
      status: 'TURMA_DISPENSADA',
      refeicoes: [
        { tipo: 'ALMOCO', acao: 'CANCELAR_REFEICAO', quantidade: 30, nivel: 'AMARELO_4H_A_24H' },
        { tipo: 'LANCHE_TARDE', acao: 'CANCELAR_REFEICAO', quantidade: 28, nivel: 'VERMELHO_MENOS_4H' },
      ],
    })!;
    expect(msg).toContain('[EMERGÊNCIA]');
    expect(msg).toContain('- CANCELAR *Almoço (12:00)*: 30 estudante(s) — 🟡');
    expect(msg).toContain('Lanche da tarde (15:00)*: 28 estudante(s) — 🔴');
    expect(msg).not.toMatch(/Ana|Redes de Computadores\n/);
    expect(mensagemAssistencia(base)).toBeNull();
  });

  it('CTP: só quando há dispensa, com a situação da reposição', () => {
    expect(mensagemCtp(base)).toBeNull();
    const dispensa = { ...base, status: 'TURMA_DISPENSADA' as const, horarios: [{ bloco: 'Manhã A', situacao: 'dispensa' as const }] };
    expect(mensagemCtp(dispensa)).toContain('Reposição: a combinar');
    expect(mensagemCtp({ ...dispensa, status: 'REPOSICAO_AGENDADA' })).toContain('Reposição: já agendada.');
  });
});

const pessoa = (id: string, nome: string, extra: Partial<PessoaMensagem> = {}): PessoaMensagem => ({
  id,
  nome,
  email: `${id}@ifce.edu.br`,
  whatsapp: '5588999990000',
  usaWhatsapp: true,
  ...extra,
});

const extras = (mudar: Partial<ExtrasMensagem> = {}): ExtrasMensagem => ({
  canais: [
    { canal: 'GRUPO_PROFESSORES', email: 'professores@ifce.edu.br', saudacao: 'professores(as)', ativo: true },
    { canal: 'GRUPO_GESTAO_DIR_COORD', email: null, saudacao: null, ativo: true },
    { canal: 'ASSISTENCIA_ESTUDANTIL', email: 'cae@ifce.edu.br', saudacao: null, ativo: true },
    { canal: 'CTP', email: null, saudacao: 'equipe da CTP', ativo: false },
    { canal: 'LIDERES_TURMA', email: null, saudacao: 'líderes de turma', ativo: true },
    { canal: 'NUTRICIONISTA', email: 'nutri@ifce.edu.br', saudacao: null, ativo: true },
  ],
  pessoas: new Map([
    ['ana', pessoa('ana', 'Ana Souza')],
    ['bruno', pessoa('bruno', 'Bruno Lima', { usaWhatsapp: false })],
    ['carla', pessoa('carla', 'Carla Dias', { whatsapp: null })],
  ]),
  ausenteId: 'ana',
  convites: [],
  linkMinhaGrade: 'https://sgc.exemplo/grade/minha',
  ...mudar,
});

describe('mensagensDaAusencia (e-mail e WhatsApp)', () => {
  it('grupos: saudação cadastrada, e-mail do canal e assunto com turma e data', () => {
    const [prof, gestao] = mensagensDaAusencia(base, extras());
    expect(prof.chave).toBe('canal:GRUPO_PROFESSORES');
    expect(prof.para).toBe('professores@ifce.edu.br');
    expect(prof.texto.startsWith('Olá, professores(as)!\n\n*CONVITE')).toBe(true);
    expect(prof.assunto).toBe('[SGC-Redes] Convite de substituição — REDES-2 — 26/11/2026');
    expect(gestao.chave).toBe('canal:GRUPO_GESTAO_DIR_COORD');
    expect(gestao.para).toBeNull();
    expect(gestao.texto).toContain('Olá, {{destinatários (Gestão)}}!');
  });

  it('convite individual com link para Minha grade; sem convite, nenhuma mensagem individual pendente', () => {
    const msgs = mensagensDaAusencia(base, extras({ convites: [{ id: 'c1', professorId: 'carla', bloco: 'Manhã A (07:30–08:30)' }] }));
    const convite = msgs.find((m) => m.chave === 'convite:c1')!;
    expect(convite.titulo).toBe('Docente convidado(a): Carla Dias');
    expect(convite.para).toBe('carla@ifce.edu.br');
    expect(convite.whatsapp).toBeNull();
    expect(convite.aceitaWhatsapp).toBe(true);
    expect(convite.texto).toContain('Olá, Carla!');
    expect(convite.texto).toContain('https://sgc.exemplo/grade/minha');
    expect(msgs.some((m) => m.chave.startsWith('ausente:'))).toBe(false);
  });

  it('substituto, professor da aula adiantada e docente ausente recebem mensagens individuais', () => {
    const d: DadosMensagem = {
      ...base,
      status: 'TURMA_DISPENSADA',
      horarios: [
        { bloco: 'Manhã A', situacao: 'substituicao', detalhe: 'Bruno Lima', substitutoId: 'bruno' },
        { bloco: 'Manhã B', situacao: 'adiantamento', detalhe: 'BD (de Tarde A)', professorOrigemId: 'carla', disciplinaOrigem: 'BD', blocoOrigem: 'Tarde A' },
        { bloco: 'Tarde B', situacao: 'dispensa' },
      ],
    };
    const msgs = mensagensDaAusencia(d, extras());
    const chaves = msgs.map((m) => m.chave);
    expect(chaves).toEqual(['substituto:bruno', 'adiantamento:carla', 'canal:LIDERES_TURMA', 'canal:GRUPO_GESTAO_DIR_COORD', 'ausente:ana']);
    const sub = msgs[0];
    expect(sub.aceitaWhatsapp).toBe(false);
    expect(sub.whatsapp).toBeNull();
    expect(sub.texto).toContain('- Manhã A (no lugar de Redes de Computadores)');
    expect(sub.texto).not.toContain('evento');
    expect(msgs[1].texto).toContain('sua aula de BD (Tarde A) passa para Manhã B.');
    expect(msgs[4].texto).toContain('Combine com a Coordenação a reposição');
    expect(msgs[4].whatsapp).toBe('5588999990000');
  });

  it('canal desativado não gera mensagem; CTP ativa recebe aviso de dispensa', () => {
    const d = { ...base, status: 'TURMA_DISPENSADA' as const, horarios: [{ bloco: 'Manhã A', situacao: 'dispensa' as const }] };
    expect(mensagensDaAusencia(d, extras()).some((m) => m.canal === 'CTP')).toBe(false);
    const ativa = extras();
    const canais = ativa.canais.map((c) => (c.canal === 'CTP' ? { ...c, ativo: true } : c));
    const ctp = mensagensDaAusencia(d, { ...ativa, canais }).find((m) => m.canal === 'CTP')!;
    expect(ctp.texto.startsWith('Olá, equipe da CTP!')).toBe(true);
  });
});

describe('textos-padrão aplicados às mensagens da ausência', () => {
  it('cada mensagem tem tipo e variáveis suficientes para os modelos do seu tipo', async () => {
    const { modelosDoTipo } = await import('@/lib/comunicacao/modelos');
    const { camposPendentes, preencherCampos } = await import('@/lib/comunicacao/mensagem');
    const d: DadosMensagem = {
      ...base,
      status: 'TURMA_DISPENSADA',
      horarios: [
        { bloco: 'Manhã A', situacao: 'substituicao', detalhe: 'Bruno Lima', substitutoId: 'bruno' },
        { bloco: 'Manhã B', situacao: 'pendente' },
        { bloco: 'Tarde B', situacao: 'dispensa' },
      ],
      refeicoes: [{ tipo: 'ALMOCO', acao: 'CANCELAR_REFEICAO', quantidade: 30, nivel: 'AMARELO_4H_A_24H' }],
    };
    const canais = extras().canais.map((c) => ({ ...c, ativo: true, saudacao: c.saudacao ?? 'equipe' }));
    const msgs = mensagensDaAusencia(d, extras({ canais, convites: [{ id: 'c1', professorId: 'carla', bloco: 'Manhã B' }] }));
    expect(msgs.every((m) => m.tipo)).toBe(true);
    for (const m of msgs)
      for (const modelo of modelosDoTipo(m.tipo!)) {
        const texto = preencherCampos(`${modelo.assunto}\n${modelo.texto}`, m.variaveis ?? {});
        expect(camposPendentes(texto), `${m.chave} / ${modelo.id}`).toEqual([]);
      }
    const sub = msgs.find((m) => m.chave === 'substituto:bruno')!;
    expect(sub.variaveis).toMatchObject({ nome: 'Bruno', horarios: '- Manhã A (no lugar de Redes de Computadores)', 'codigo da turma': 'REDES-2' });
  });
});

describe('nutricionista do campus', () => {
  it('recebe as alterações de refeição junto com a CAE, sem docente', () => {
    const d: DadosMensagem = {
      ...base,
      status: 'TURMA_DISPENSADA',
      horarios: [{ bloco: 'Tarde A', situacao: 'dispensa' }],
      refeicoes: [{ tipo: 'LANCHE_TARDE', acao: 'CANCELAR_REFEICAO', quantidade: 28, nivel: 'VERDE_24H_MAIS' }],
    };
    const msgs = mensagensDaAusencia(d, extras());
    const chaves = msgs.map((m) => m.chave);
    expect(chaves.indexOf('canal:NUTRICIONISTA')).toBe(chaves.indexOf('canal:ASSISTENCIA_ESTUDANTIL') + 1);
    const nutri = msgs.find((m) => m.canal === 'NUTRICIONISTA')!;
    expect(nutri.para).toBe('nutri@ifce.edu.br');
    expect(nutri.texto).toContain('Olá, {{nome da nutricionista}}!');
    expect(nutri.texto).toContain('AVISO À NUTRICIONISTA');
    expect(nutri.texto).toContain('CANCELAR *Lanche da tarde (15:00)*: 28 estudante(s)');
    expect(nutri.texto).not.toMatch(/Ana|painel de Alimentação/);
    expect(nutri.tipo).toBe('alimentacao');
  });
});
