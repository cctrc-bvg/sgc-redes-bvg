import { exigirPermissao } from '@/lib/auth/dal';
import { respostaModelo } from '@/lib/importacao/planilha';
import { COLUNAS_USUARIO, EXEMPLOS_USUARIOS, INSTRUCOES_USUARIOS, OPCOES_PERFIL_PLANILHA } from '@/lib/importacao/usuarios';

/** Modelo com linhas de exemplo fictícias (e-mails @exemplo.com, recusados na importação). */
export async function GET(request: Request) {
  await exigirPermissao('usuarios:gerenciar');
  return respostaModelo({
    formato: new URL(request.url).searchParams.get('formato'),
    nomeArquivo: 'usuarios-sgc-redes',
    colunas: COLUNAS_USUARIO.map((c) => ({ titulo: c.titulo, largura: c.largura, opcoes: c.campo === 'role' ? OPCOES_PERFIL_PLANILHA : undefined })),
    linhas: EXEMPLOS_USUARIOS,
    instrucoes: INSTRUCOES_USUARIOS,
  });
}
