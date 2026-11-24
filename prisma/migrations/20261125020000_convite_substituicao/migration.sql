-- CreateEnum
CREATE TYPE "StatusConvite" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "ConviteSubstituicao" (
    "id" TEXT NOT NULL,
    "ausenciaId" TEXT NOT NULL,
    "blocoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "status" "StatusConvite" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "ConviteSubstituicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConviteSubstituicao_professorId_status_idx" ON "ConviteSubstituicao"("professorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConviteSubstituicao_ausenciaId_blocoId_professorId_key" ON "ConviteSubstituicao"("ausenciaId", "blocoId", "professorId");

-- AddForeignKey
ALTER TABLE "ConviteSubstituicao" ADD CONSTRAINT "ConviteSubstituicao_ausenciaId_fkey" FOREIGN KEY ("ausenciaId") REFERENCES "AusenciaDocente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteSubstituicao" ADD CONSTRAINT "ConviteSubstituicao_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "BlocoHorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteSubstituicao" ADD CONSTRAINT "ConviteSubstituicao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

