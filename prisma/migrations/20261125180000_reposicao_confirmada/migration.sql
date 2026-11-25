-- Reposição de aulas confirmada (ROD, Art. 37): o docente informa, a Coordenação dá ciência ou registra direto.
-- Só acréscimo: colunas opcionais e uma tabela nova; nenhum dado existente muda.
CREATE TYPE "OrigemReposicao" AS ENUM ('DOCENTE', 'COORDENACAO');

ALTER TABLE "AusenciaDocente"
  ADD COLUMN "reposicaoEm" DATE,
  ADD COLUMN "reposicaoOrigem" "OrigemReposicao",
  ADD COLUMN "reposicaoObservacao" TEXT,
  ADD COLUMN "reposicaoInformadaEm" TIMESTAMP(3),
  ADD COLUMN "reposicaoCienteEm" TIMESTAMP(3),
  ADD COLUMN "reposicaoCientePorId" TEXT;

CREATE TABLE "AnexoReposicao" (
  "id" TEXT NOT NULL,
  "ausenciaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipoMime" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "conteudo" BYTEA NOT NULL,
  "enviadoPorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnexoReposicao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnexoReposicao_ausenciaId_idx" ON "AnexoReposicao"("ausenciaId");

ALTER TABLE "AnexoReposicao" ADD CONSTRAINT "AnexoReposicao_ausenciaId_fkey" FOREIGN KEY ("ausenciaId") REFERENCES "AusenciaDocente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
