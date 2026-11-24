import { describe, expect, it, vi } from 'vitest';
import { configuracaoEvolution, destinoValido, enviarPorEvolution, montarRequisicao } from './evolution';

const config = { url: 'https://zap.ifce.edu.br', chave: 'segredo', instancia: 'coord redes' };

describe('Evolution API (G07, preparada)', () => {
  it('só ativa com as três variáveis e URL http(s)', () => {
    expect(configuracaoEvolution({})).toBeNull();
    expect(configuracaoEvolution({ EVOLUTION_API_URL: 'https://x/', EVOLUTION_API_KEY: 'k' })).toBeNull();
    expect(configuracaoEvolution({ EVOLUTION_API_URL: 'ftp://x', EVOLUTION_API_KEY: 'k', EVOLUTION_INSTANCIA: 'i' })).toBeNull();
    expect(configuracaoEvolution({ EVOLUTION_API_URL: 'https://x//', EVOLUTION_API_KEY: ' k ', EVOLUTION_INSTANCIA: 'i' })).toEqual({ url: 'https://x', chave: 'k', instancia: 'i' });
  });

  it('valida destino: JID de grupo ou número com DDI', () => {
    expect(destinoValido('120363012345678901@g.us')).toBe(true);
    expect(destinoValido('5588999990000')).toBe(true);
    expect(destinoValido('88 99999-0000')).toBe(false);
    expect(destinoValido('grupo@g.us')).toBe(false);
  });

  it('monta a requisição sendText da v2', () => {
    const r = montarRequisicao(config, '120363012345678901@g.us', 'Olá');
    expect(r.url).toBe('https://zap.ifce.edu.br/message/sendText/coord%20redes');
    expect(r.init.headers).toEqual({ 'Content-Type': 'application/json', apikey: 'segredo' });
    expect(JSON.parse(r.init.body)).toEqual({ number: '120363012345678901@g.us', text: 'Olá' });
  });

  it('envio devolve sucesso ou falha sem lançar', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true });
    expect(await enviarPorEvolution(config, '5588999990000', 'x', ok as unknown as typeof fetch)).toBe(true);
    const erro = vi.fn().mockRejectedValue(new Error('rede'));
    expect(await enviarPorEvolution(config, '5588999990000', 'x', erro as unknown as typeof fetch)).toBe(false);
    const recusa = vi.fn().mockResolvedValue({ ok: false });
    expect(await enviarPorEvolution(config, '5588999990000', 'x', recusa as unknown as typeof fetch)).toBe(false);
  });
});
