import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analisarMigracao, MARCA_APROVADA } from './migracoes';

const NOVA = '20991231000000_exemplo';

describe('política de migrações seguras', () => {
  it('acréscimos passam', () => {
    expect(analisarMigracao(NOVA, 'ALTER TABLE "User" ADD COLUMN "x" BOOLEAN NOT NULL DEFAULT false;\nCREATE INDEX "i" ON "User"("x");')).toEqual([]);
  });

  it('comandos destrutivos numa migração nova são barrados', () => {
    const r = analisarMigracao(NOVA, 'ALTER TABLE "User" DROP COLUMN "x";\nALTER TABLE "T" RENAME COLUMN "a" TO "b";\nALTER TABLE "T" ALTER COLUMN "c" SET NOT NULL;');
    expect(r.map((p) => p.motivo)).toEqual([
      'apaga uma coluna',
      'renomeia (a versão anterior do app deixa de achar o nome antigo)',
      'torna obrigatória uma coluna (falha se houver linha vazia)',
    ]);
  });

  it('coluna nova obrigatória sem padrão é barrada; com padrão, passa', () => {
    expect(analisarMigracao(NOVA, 'ALTER TABLE "User" ADD COLUMN "cpf" TEXT NOT NULL;')[0]?.motivo).toContain('sem valor padrão');
    expect(analisarMigracao(NOVA, 'ALTER TABLE "User" ADD COLUMN "a" TEXT,\nADD COLUMN "b" INTEGER NOT NULL DEFAULT 0;')).toEqual([]);
  });

  it('a marca de aprovação libera (contração planejada, com backup e ensaio)', () => {
    expect(analisarMigracao(NOVA, `${MARCA_APROVADA} remove coluna sem uso desde a v1.4; ensaio 2027-03-01\nALTER TABLE "User" DROP COLUMN "x";`)).toEqual([]);
  });

  it('comentários não contam e migrações anteriores à política ficam de fora', () => {
    expect(analisarMigracao(NOVA, '-- antes: DROP COLUMN "x"\nSELECT 1;')).toEqual([]);
    expect(analisarMigracao('20261124150000_ofertas_ano_letivo', 'ALTER TABLE "T" DROP COLUMN "x";')).toEqual([]);
  });

  it('as migrações do repositório seguem a política', () => {
    const pasta = join(process.cwd(), 'prisma', 'migrations');
    const problemas = readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => analisarMigracao(d.name, readFileSync(join(pasta, d.name, 'migration.sql'), 'utf8')));
    expect(problemas, 'migração destrutiva sem aprovação: veja docs/IMPLANTACAO.md, seção 8').toEqual([]);
  });
});
