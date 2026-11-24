-- CreateEnum
CREATE TYPE "TipoEventoCalendario" AS ENUM ('FERIAS_DOCENTES', 'MATRICULA', 'ENCONTRO_PEDAGOGICO', 'AVALIACOES_FINAIS', 'FERIADO', 'PONTO_FACULTATIVO', 'ACOLHIDA', 'PITS_RITS', 'REUNIAO', 'SUSPENSAO_AULAS', 'OUTRO');

-- CreateTable
CREATE TABLE "EventoCalendario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEventoCalendario" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "descricao" TEXT,
    "suspendeAulas" BOOLEAN NOT NULL DEFAULT false,
    "imprevisto" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaLetiva" (
    "id" TEXT NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,

    CONSTRAINT "EtapaLetiva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoCalendario_inicio_fim_idx" ON "EventoCalendario"("inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaLetiva_anoLetivo_numero_key" ON "EtapaLetiva"("anoLetivo", "numero");

