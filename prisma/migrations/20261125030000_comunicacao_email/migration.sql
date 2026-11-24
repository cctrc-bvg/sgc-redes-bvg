-- AlterTable
ALTER TABLE "User" ADD COLUMN     "usaWhatsapp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ConfiguracaoCanal" ADD COLUMN     "email" TEXT,
ADD COLUMN     "saudacao" TEXT;

-- AlterTable
ALTER TABLE "LogComunicacao" ADD COLUMN     "assunto" TEXT,
ADD COLUMN     "ausenciaId" TEXT,
ADD COLUMN     "chave" TEXT,
ADD COLUMN     "destino" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "canal" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LogComunicacao_ausenciaId_idx" ON "LogComunicacao"("ausenciaId");

