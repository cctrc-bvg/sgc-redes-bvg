import { exigirPermissao } from '@/lib/auth/dal';
import { carregarAno } from '@/lib/calendario/servidor';
import { COLUNAS_CALENDARIO, INSTRUCOES_CALENDARIO, OPCOES_CALENDARIO, linhasDoCalendario } from '@/lib/importacao/calendario';
import { respostaModelo } from '@/lib/importacao/planilha';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';

/** Modelo pré-preenchido com o calendário do ano (?ano=); vazio, traz um exemplo de cada tipo de linha. */
export async function GET(request: Request) {
  await exigirPermissao('calendario:gerenciar');
  const sp = new URL(request.url).searchParams;
  const ano = lerAnoLetivo(sp.get('ano')) ?? anoLetivoAtual();
  const linhas = linhasDoCalendario(await carregarAno(ano));
  const exemplo = [
    ['Etapa N1', `01/02/${ano}`, `16/04/${ano}`, '', '', '', '', ''],
    ['Feriado', `21/04/${ano}`, '', 'Tiradentes', '', 'Sem aula', 'Não', ''],
    ['Reunião', `10/03/${ano}`, '', 'Reunião pedagógica', '', 'Mantidas', 'Não', ''],
    ['Sábado letivo', `14/03/${ano}`, '', 'Reposição', '', '', '', 'Segunda'],
  ];
  return respostaModelo({
    formato: sp.get('formato'),
    nomeArquivo: `calendario-${ano}-sgc-redes`,
    colunas: COLUNAS_CALENDARIO.map((c) => ({ titulo: c.titulo, largura: c.largura, opcoes: OPCOES_CALENDARIO[c.campo] })),
    linhas: linhas.length ? linhas : exemplo,
    instrucoes: [
      ...INSTRUCOES_CALENDARIO,
      ...(linhas.length ? [] : ['As linhas da aba "Dados" são só exemplos: substitua pelas datas do calendário aprovado.']),
    ],
  });
}
