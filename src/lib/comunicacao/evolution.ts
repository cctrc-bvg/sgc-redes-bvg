/**
 * Envio automático pela Evolution API (G07: preparado, desligado por padrão).
 * Ativa quando EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCIA estão definidas e o canal tem
 * `destinoId` (JID do grupo, ex.: 120363000000000000@g.us). Sem isso, o sistema fica no modo semiautomático.
 */

export interface ConfigEvolution {
  url: string;
  chave: string;
  instancia: string;
}

export function configuracaoEvolution(env: Record<string, string | undefined> = process.env): ConfigEvolution | null {
  const url = env.EVOLUTION_API_URL?.trim();
  const chave = env.EVOLUTION_API_KEY?.trim();
  const instancia = env.EVOLUTION_INSTANCIA?.trim();
  if (!url || !chave || !instancia) return null;
  if (!/^https?:\/\//.test(url)) return null;
  return { url: url.replace(/\/+$/, ''), chave, instancia };
}

/** JID de grupo (…@g.us) ou número com DDI (só dígitos, 12–13). */
export function destinoValido(destino: string): boolean {
  return /^\d{10,20}@g\.us$/.test(destino) || /^\d{12,13}$/.test(destino);
}

/** Requisição de texto da Evolution API v2: POST /message/sendText/{instancia}. */
export function montarRequisicao(config: ConfigEvolution, destino: string, texto: string) {
  return {
    url: `${config.url}/message/sendText/${encodeURIComponent(config.instancia)}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.chave },
      body: JSON.stringify({ number: destino, text: texto }),
    } satisfies RequestInit,
  };
}

/** Envia e devolve se deu certo. Nunca lança: a falha vira registro no histórico. */
export async function enviarPorEvolution(config: ConfigEvolution, destino: string, texto: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const { url, init } = montarRequisicao(config, destino, texto);
  try {
    const resposta = await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) });
    return resposta.ok;
  } catch {
    return false;
  }
}
