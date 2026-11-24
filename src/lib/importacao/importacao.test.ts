import { describe, expect, it } from 'vitest';
import { MATRIZ_REDES } from '@/lib/disciplinas/matriz-curricular';
import { COLUNAS_DISCIPLINA, linhaModeloDisciplina, planejarImportacaoDisciplinas, type DisciplinaExistente } from './disciplinas';
import { mapearColunas, lerCsv, gerarCsv } from './tabela';
import { COLUNAS_USUARIO, EXEMPLOS_USUARIOS, lerPerfil, planejarImportacaoUsuarios } from './usuarios';

const csvDisciplinas = (linhas: string[][]) =>
  mapearColunas(lerCsv(gerarCsv(COLUNAS_DISCIPLINA.map((c) => c.titulo), linhas)), COLUNAS_DISCIPLINA);

const existente = (over: Partial<DisciplinaExistente> = {}): DisciplinaExistente => ({
  id: 'd-bio',
  codigo: 'BIO.1',
  nome: 'Biologia I',
  cargaHoraria: 80,
  nucleo: 'PROPEDEUTICO',
  anoCurso: 1,
  semestreCurso: null,
  exigePratica: false,
  ementaUrl: null,
  ativa: true,
  ...over,
});

describe('planejarImportacaoDisciplinas', () => {
  it('o modelo gerado da matriz é importável inteiro, sem erros', () => {
    const m = csvDisciplinas(MATRIZ_REDES.map((d) => linhaModeloDisciplina({ ...d, exigePratica: d.nucleo === 'TECNICO', ementaUrl: null })));
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [] });
    expect(plano.temErros).toBe(false);
    expect(plano.criar).toHaveLength(MATRIZ_REDES.length);
    expect(plano.criar.find((d) => d.codigo === 'C.D')).toMatchObject({ nucleo: 'TECNICO', semestreCurso: 2, exigePratica: true });
  });

  it('reenviar o catálogo sem mudanças não altera nada', () => {
    const atual = existente();
    const m = csvDisciplinas([linhaModeloDisciplina(atual)]);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [atual] });
    expect(plano.linhas).toEqual([{ numero: 2, descricao: 'Biologia I', situacao: 'igual' }]);
  });

  it('atualiza pelo código só os campos que mudaram', () => {
    const m = csvDisciplinas([['bio.1', 'Biologia I', '60', 'Propedêutica', '1º ano', 'Anual', 'Não', '', 'Sim']]);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [existente()] });
    expect(plano.atualizar).toEqual([{ id: 'd-bio', dados: { cargaHoraria: 60 }, campos: ['cargaHoraria'] }]);
    expect(plano.linhas[0].detalhe).toBe('Altera: carga horária.');
  });

  it('sem código, casa pelo nome e mantém o código atual', () => {
    const m = csvDisciplinas([['', 'biologia i', '80', 'Propedêutica', '1', '', 'Sim', '', '']]);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [existente()] });
    expect(plano.atualizar[0]).toMatchObject({ dados: { exigePratica: true, nome: 'biologia i' } });
    expect(plano.atualizar[0].dados).not.toHaveProperty('codigo');
  });

  it('colunas ausentes não mudam nada', () => {
    const m = mapearColunas(lerCsv('Disciplina;Carga horária;Núcleo;Ano\nBiologia I;80;Propedêutica;1'), COLUNAS_DISCIPLINA);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [existente({ exigePratica: true, ementaUrl: 'https://x.br' })] });
    expect(plano.linhas[0].situacao).toBe('igual');
  });

  it('aponta erros por linha com o nome do campo', () => {
    const m = csvDisciplinas([
      ['X', 'AB', '80h', 'Outro', '4', '', 'talvez', 'ftp://x', ''],
      ['', 'Redes Novas', '80', 'Técnica', '2', '', 'Sim', '', ''],
    ]);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [] });
    expect(plano.temErros).toBe(true);
    const [l1, l2] = plano.linhas;
    expect(l1.situacao).toBe('erro');
    expect(l1.detalhe).toMatch(/Exige prática: use "Sim" ou "Não"/);
    for (const campo of ['Código:', 'Nome:', 'Núcleo:', 'Ano:', 'Ementa:']) expect(l1.detalhe).toContain(campo);
    expect(l1.detalhe).not.toContain('Carga horária'); // "80h" é aceito como 80
    expect(l2.detalhe).toMatch(/Semestre: Disciplinas técnicas são semestrais/);
  });

  it('recusa linha repetida na planilha e código novo com nome já cadastrado', () => {
    const m = csvDisciplinas([
      ['NOVA', 'Ética', '40', 'Diversificada', '1', 'Anual', 'Não', '', ''],
      ['', 'ética', '40', 'Diversificada', '1', 'Anual', 'Não', '', ''],
      ['BIO.9', 'Biologia I', '80', 'Propedêutica', '1', 'Anual', 'Não', '', ''],
    ]);
    const plano = planejarImportacaoDisciplinas({ ...m, existentes: [existente()] });
    expect(plano.linhas.map((l) => l.situacao)).toEqual(['criar', 'erro', 'erro']);
    expect(plano.linhas[1].detalhe).toMatch(/linha 2/);
    expect(plano.linhas[2].detalhe).toMatch(/código BIO\.1/);
  });
});

describe('planejarImportacaoUsuarios', () => {
  const mapear = (linhas: string[][]) =>
    mapearColunas(lerCsv(gerarCsv(COLUNAS_USUARIO.map((c) => c.titulo), linhas)), COLUNAS_USUARIO);

  it.each([
    ['Professor(a)', 'PROFESSOR'],
    ['professora', 'PROFESSOR'],
    ['Coordenação', 'COORDENADOR'],
    ['DIRECAO', 'DIRECAO'],
    ['Assistência Estudantil', 'ASSISTENCIA_ESTUDANTIL'],
    ['aluno', null],
  ])('perfil "%s" → %s', (v, r) => {
    expect(lerPerfil(v)).toBe(r);
  });

  it('as linhas de exemplo do modelo são recusadas', () => {
    const plano = planejarImportacaoUsuarios({ registros: mapear(EXEMPLOS_USUARIOS).registros, emailsExistentes: new Set(), siapesExistentes: new Set() });
    expect(plano.linhas.every((l) => l.situacao === 'erro' && /exemplo/.test(l.detalhe!))).toBe(true);
  });

  it('cria novos, ignora e-mails já cadastrados e aponta erros', () => {
    const plano = planejarImportacaoUsuarios({
      registros: mapear([
        ['Carla Nova', 'Carla.Nova@IFCE.edu.br', 'Professor(a)', '7654321', '88 99999-1111'],
        ['Já Existe', 'ja@ifce.edu.br', 'CTP', '', ''],
        ['Carla Dupla', 'carla.nova@ifce.edu.br', 'CTP', '', ''],
        ['Siape Dono', 'outro@ifce.edu.br', 'CTP', '1111111', ''],
        ['X', 'invalido', 'aluno', '12', ''],
      ]).registros,
      emailsExistentes: new Set(['ja@ifce.edu.br']),
      siapesExistentes: new Set(['1111111']),
    });
    expect(plano.linhas.map((l) => l.situacao)).toEqual(['criar', 'ignorar', 'erro', 'erro', 'erro']);
    expect(plano.criar).toEqual([{ nome: 'Carla Nova', email: 'carla.nova@ifce.edu.br', role: 'PROFESSOR', siape: '7654321', whatsapp: '5588999991111' }]);
    expect(plano.linhas[2].detalhe).toMatch(/linha 2/);
    expect(plano.linhas[3].detalhe).toMatch(/SIAPE já pertence/);
    expect(plano.linhas[4].detalhe).toMatch(/Nome:.*E-mail:.*Perfil: use Coordenação, Professor\(a\)/);
  });
});
