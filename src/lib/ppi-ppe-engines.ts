/**
 * Calcula pontuação de uma atividade de PPI respeitando:
 * - Limite máximo de quantidade
 * - Teto máximo de horas da categoria no Manual 2022
 */
export function calcularHorasAtividadePpi(params: {
  quantidadeInformada: number;
  horasPorUnidade: number;
  qtdMaxima: number;
  pontuacaoMaxima: number;
}): number {
  const qtdValida = Math.max(0, Math.min(params.quantidadeInformada, params.qtdMaxima));
  const horasBrutas = qtdValida * params.horasPorUnidade;
  return Math.min(horasBrutas, params.pontuacaoMaxima);
}

export function avaliarProgressoPpi(totalValidado: number, meta = 40) {
  const percentual = Math.min(100, Math.round((totalValidado / meta) * 100));
  const restante = Math.max(0, meta - totalValidado);
  return {
    meta,
    totalValidado,
    restante,
    percentual,
    concluido: totalValidado >= meta,
  };
}

/**
 * Regras do ROD - Seção VI (PPE):
 * - Art. 115: até 2 componentes em PPE; 3 ou mais => retenção.
 * - Art. 117 §1º: PEI possui no máximo 30% da carga horária total da disciplina.
 * - Art. 121: se disciplina exige prática, horasPraticas no PEI deve ser > 0.
 */
export function validarLimitePei(params: {
  cargaHorariaDisciplina: number;
  cargaHorariaPeiInformada: number;
  horasPresenciais: number;
  horasPraticas: number;
  exigePratica: boolean;
}): { valido: boolean; teto30Porcento: number; erros: string[] } {
  const teto30Porcento = Math.floor(params.cargaHorariaDisciplina * 0.3);
  const erros: string[] = [];

  if (params.cargaHorariaPeiInformada <= 0) {
    erros.push('A carga horária do PEI deve ser maior que zero.');
  }
  if (params.cargaHorariaPeiInformada > teto30Porcento) {
    erros.push(
      `Art. 117 §1º ROD: A carga horária do PEI (${params.cargaHorariaPeiInformada}h) excede 30% da disciplina (máximo ${teto30Porcento}h).`
    );
  }
  if (params.horasPresenciais > params.cargaHorariaPeiInformada) {
    erros.push('As horas presenciais não podem ultrapassar a carga horária total do PEI.');
  }
  if (params.exigePratica && params.horasPraticas <= 0) {
    erros.push(
      'Art. 121 ROD: Esta disciplina exige conteúdo prático; informe a carga horária destinada às aulas práticas no PEI.'
    );
  }

  return {
    valido: erros.length === 0,
    teto30Porcento,
    erros,
  };
}