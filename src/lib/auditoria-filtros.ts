/**
 * Filtros da tela de auditoria (puros, testáveis). Parâmetros de URL inválidos são ignorados.
 */
import { validarDataISO } from '@/lib/alimentacao-engine';

export const POR_PAGINA = 50;

export interface FiltrosAuditoria {
  acao?: string;
  usuarioId?: string;
  de?: string; // AAAA-MM-DD
  ate?: string;
  pagina: number;
}

const dataOk = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  try {
    validarDataISO(v);
    return true;
  } catch {
    return false;
  }
};

export function lerFiltrosAuditoria(params: Record<string, string | undefined>): FiltrosAuditoria {
  const acao = params.acao && /^[A-Z_]{3,60}$/.test(params.acao) ? params.acao : undefined;
  const usuarioId = params.usuario && /^[a-z0-9-]{1,40}$/i.test(params.usuario) ? params.usuario : undefined;
  let de = dataOk(params.de) ? params.de : undefined;
  let ate = dataOk(params.ate) ? params.ate : undefined;
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const n = Number(params.pagina);
  const pagina = Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
  return { acao, usuarioId, de, ate, pagina };
}

/** Condição `where` do Prisma para AuditLog. Datas no fuso de Fortaleza, "até" inclusivo. */
export function condicaoAuditoria(f: FiltrosAuditoria) {
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (f.de) createdAt.gte = new Date(`${f.de}T00:00:00-03:00`);
  if (f.ate) {
    const fim = new Date(`${f.ate}T00:00:00-03:00`);
    fim.setUTCDate(fim.getUTCDate() + 1);
    createdAt.lt = fim;
  }
  return {
    ...(f.acao ? { acao: f.acao } : {}),
    ...(f.usuarioId ? { userId: f.usuarioId } : {}),
    ...(f.de || f.ate ? { createdAt } : {}),
  };
}

/** Query string para trocar de página mantendo os filtros. */
export function urlDaPagina(f: FiltrosAuditoria, pagina: number): string {
  const q = new URLSearchParams();
  if (f.acao) q.set('acao', f.acao);
  if (f.usuarioId) q.set('usuario', f.usuarioId);
  if (f.de) q.set('de', f.de);
  if (f.ate) q.set('ate', f.ate);
  if (pagina > 1) q.set('pagina', String(pagina));
  const s = q.toString();
  return `/auditoria${s ? `?${s}` : ''}`;
}

/** Nomes das ações registradas pelo sistema (as desconhecidas aparecem pelo código). */
export const NOME_ACAO: Record<string, string> = {
  LOGIN: 'Entrou no sistema',
  LOGIN_FALHOU: 'Tentativa de login falhou',
  LOGOUT: 'Saiu do sistema',
  TROCOU_SENHA: 'Trocou a própria senha',
  REDEFINIU_SENHA: 'Redefiniu senha de usuário',
  CRIOU_USUARIO: 'Cadastrou usuário',
  EDITOU_USUARIO: 'Editou usuário',
  DESATIVOU_USUARIO: 'Desativou usuário',
  REATIVOU_USUARIO: 'Reativou usuário',
  IMPORTOU_USUARIOS: 'Importou usuários por planilha',
  CRIOU_DISCIPLINA: 'Cadastrou disciplina',
  EDITOU_DISCIPLINA: 'Editou disciplina',
  DESATIVOU_DISCIPLINA: 'Desativou disciplina',
  REATIVOU_DISCIPLINA: 'Reativou disciplina',
  EXCLUIU_DISCIPLINA: 'Excluiu disciplina',
  IMPORTOU_DISCIPLINAS: 'Importou disciplinas por planilha',
  CRIOU_TURMA: 'Cadastrou turma',
  EDITOU_TURMA: 'Editou turma',
  DESATIVOU_TURMA: 'Desativou turma',
  REATIVOU_TURMA: 'Reativou turma',
  EXCLUIU_TURMA: 'Excluiu turma',
  DISTRIBUIU_DISCIPLINAS: 'Distribuiu disciplinas (ofertas)',
  EDITOU_GRADE: 'Editou a grade',
  COPIOU_GRADE_ANUAIS: 'Copiou anuais para o outro semestre',
  CADASTROU_SABADO_LETIVO: 'Cadastrou sábado letivo',
  EXCLUIU_SABADO_LETIVO: 'Excluiu sábado letivo',
  REGISTROU_AUSENCIA: 'Registrou ausência docente',
  DECIDIU_AUSENCIA: 'Decidiu cobertura de ausência',
  CANCELOU_AUSENCIA: 'Cancelou registro de ausência',
  DEU_CIENCIA_ALIMENTACAO: 'Deu ciência de aviso de refeição',
  AJUSTOU_QUANTIDADE_ALIMENTACAO: 'Ajustou quantidade de refeição',
  ADICIONOU_REFEICAO: 'Acrescentou refeição',
  CANCELOU_ACRESCIMO_REFEICAO: 'Cancelou acréscimo de refeição',
  REGISTROU_ENVIO_WHATSAPP: 'Registrou envio de WhatsApp',
  ENVIOU_WHATSAPP_AUTOMATICO: 'Enviou WhatsApp automático',
  EDITOU_CANAL_WHATSAPP: 'Editou canal de WhatsApp',
};

export function descreverAcao(acao: string): string {
  return NOME_ACAO[acao] ?? acao;
}
