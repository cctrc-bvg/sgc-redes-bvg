/**
 * Limitador de tentativas de login em memória (proteção contra força bruta).
 *
 * Suficiente para a implantação prevista (uma única instância no campus). Se o sistema
 * passar a rodar com várias instâncias, mover este estado para o banco.
 */
export class LimitadorTentativas {
  private readonly falhas = new Map<string, number[]>();

  constructor(
    private readonly maxFalhas = 5,
    private readonly janelaMs = 15 * 60 * 1000,
    private readonly agora: () => number = Date.now,
  ) {}

  private recentes(chave: string): number[] {
    const limite = this.agora() - this.janelaMs;
    const lista = (this.falhas.get(chave) ?? []).filter((t) => t > limite);
    if (lista.length) this.falhas.set(chave, lista);
    else this.falhas.delete(chave);
    return lista;
  }

  /** Retorna os minutos restantes de bloqueio, ou 0 se a chave pode tentar. */
  minutosBloqueado(chave: string): number {
    const lista = this.recentes(chave);
    if (lista.length < this.maxFalhas) return 0;
    const liberaEm = lista[lista.length - this.maxFalhas] + this.janelaMs;
    return Math.max(1, Math.ceil((liberaEm - this.agora()) / 60000));
  }

  registrarFalha(chave: string): void {
    const lista = this.recentes(chave);
    lista.push(this.agora());
    this.falhas.set(chave, lista);
  }

  limpar(chave: string): void {
    this.falhas.delete(chave);
  }
}
