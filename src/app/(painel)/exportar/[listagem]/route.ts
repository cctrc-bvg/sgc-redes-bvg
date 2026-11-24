import { notFound } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { LISTAGENS } from '@/lib/exportacao/listagens';
import { respostaModelo } from '@/lib/importacao/planilha';

/** Exporta uma listagem em planilha: /exportar/<listagem>?formato=xlsx|csv (&ano=, &sem= quando couber). */
export async function GET(request: Request, { params }: { params: Promise<{ listagem: string }> }) {
  const { listagem } = await params;
  const def = Object.hasOwn(LISTAGENS, listagem) ? LISTAGENS[listagem] : null;
  if (!def) notFound();
  const { usuario } = await exigirPermissao(def.permissao);
  const url = new URL(request.url);
  const dados = await def.gerar(url.searchParams);
  if (def.dadosPessoais) {
    await registrarAuditoria({ userId: usuario.id, acao: 'EXPORTOU_LISTAGEM', entidade: 'Exportacao', entidadeId: listagem, detalhes: { linhas: dados.linhas.length } });
  }
  const hoje = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
  return respostaModelo({
    formato: url.searchParams.get('formato'),
    nomeArquivo: dados.nomeArquivo,
    colunas: dados.colunas.map(([titulo, largura]) => ({ titulo, largura })),
    linhas: dados.linhas,
    instrucoes: [
      `${def.titulo} — SGC-Redes`,
      `Exportado em ${hoje}. ${dados.linhas.length} linha(s).`,
      ...(dados.notas ?? []),
      ...(def.dadosPessoais ? ['Contém dados pessoais (LGPD): use só para o trabalho da Coordenação, não compartilhe e apague quando não precisar mais.'] : []),
    ],
  });
}
