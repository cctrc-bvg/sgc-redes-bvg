-- Ausências só eram criadas pelo seed/código de exemplo (não havia tela): a conversão para DATE e o índice único
-- (data, oferta) não encontram dados reais. Uma ausência por oferta e dia; vários blocos ficam em CoberturaBloco.

-- CreateEnum
CREATE TYPE "TipoCobertura" AS ENUM ('SUBSTITUICAO', 'ADIANTAMENTO', 'DISPENSA');

-- AlterTable
ALTER TABLE "AusenciaDocente" ADD COLUMN     "decididaEm" TIMESTAMP(3),
ADD COLUMN     "justificativa" TEXT,
ALTER COLUMN "dataAula" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "AlertaAlimentacao" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "manual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CoberturaBloco" (
    "id" TEXT NOT NULL,
    "ausenciaId" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "tipo" "TipoCobertura" NOT NULL,
    "substitutoId" TEXT,
    "blocoOrigemId" TEXT,

    CONSTRAINT "CoberturaBloco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoberturaBloco_ausenciaId_blocoId_key" ON "CoberturaBloco"("ausenciaId", "blocoId");

-- CreateIndex
CREATE INDEX "AusenciaDocente_dataAula_idx" ON "AusenciaDocente"("dataAula");

-- CreateIndex
CREATE UNIQUE INDEX "AusenciaDocente_dataAula_ofertaId_key" ON "AusenciaDocente"("dataAula", "ofertaId");

-- CreateIndex
CREATE INDEX "AlertaAlimentacao_dataRefeicao_idx" ON "AlertaAlimentacao"("dataRefeicao");

-- AddForeignKey
ALTER TABLE "CoberturaBloco" ADD CONSTRAINT "CoberturaBloco_ausenciaId_fkey" FOREIGN KEY ("ausenciaId") REFERENCES "AusenciaDocente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaBloco" ADD CONSTRAINT "CoberturaBloco_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "BlocoHorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaBloco" ADD CONSTRAINT "CoberturaBloco_substitutoId_fkey" FOREIGN KEY ("substitutoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaBloco" ADD CONSTRAINT "CoberturaBloco_blocoOrigemId_fkey" FOREIGN KEY ("blocoOrigemId") REFERENCES "BlocoHorario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

