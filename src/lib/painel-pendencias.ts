import 'server-only';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { temPermissao } from '@/lib/auth/rbac';
import { dataParaBanco, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { anoLetivoAtual } from '@/lib/ofertas/regras';

/**
 * Pendências mostradas nos cards do painel, por id de módulo. Só conta o que o perfil pode ver;
 * nunca expõe nomes (os cards só mostram números).
 */
export async function pendenciasDoPainel(usuario: { id: string; role: Role }): Promise<Record<string, string[]>> {
  const pode = (p: Parameters<typeof temPermissao>[1]) => temPermissao(usuario.role, p);
  const hoje = dataParaBanco(hojeEmFortaleza());
  const agora = new Date();
  const contar = async (condicao: boolean, consulta: () => Promise<number>) => (condicao ? consulta() : 0);
  const [ausencias, convites, avisos, emergencias, diarios, processos, retencao] = await Promise.all([
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje } } })),
    contar(pode('substituicao:responder'), () => prisma.conviteSubstituicao.count({ where: { professorId: usuario.id, status: 'PENDENTE', ausencia: { dataAula: { gte: hoje } } } })),
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { canceladoEm: null, confirmadoAE: false, dataRefeicao: { gte: agora } } })),
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { canceladoEm: null, confirmadoAE: false, dataRefeicao: { gte: agora }, nivelSla: 'VERMELHO_MENOS_4H' } })),
    contar(pode('diarios:ver-todos'), () => prisma.disciplinaOferta.count({ where: { anoLetivo: anoLetivoAtual(), diarioEmDia: false } })),
    contar(pode('kanban:ver'), () =>
      prisma.processoKanban.count({ where: { coluna: { not: 'CONCLUIDO' }, prazo: { lt: hoje }, ...(pode('kanban:ver-sigiloso') ? {} : { sigiloso: false }) } }),
    ),
    contar(pode('ppe:gerenciar'), () => prisma.registroPPE.count({ where: { alertaRetencao: true, status: { not: 'LANCADO_ACADEMICO' } } })),
  ]);
  const r: Record<string, string[]> = {};
  const add = (id: string, n: number, texto: string) => {
    if (n > 0) (r[id] ??= []).push(`${n} ${texto}`);
  };
  add('grade', ausencias, 'ausência(s) aguardando decisão');
  add('grade', convites, 'convite(s) de substituição para você');
  add('alimentacao', emergencias, 'emergência(s) sem ciência');
  add('alimentacao', avisos - emergencias, 'aviso(s) aguardando ciência');
  add('diarios', diarios, 'diário(s) atrasado(s)');
  add('processos', processos, 'processo(s) com prazo vencido');
  add('ppe', retencao, 'registro(s) com alerta de retenção');
  return r;
}
