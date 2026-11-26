-- Histórico versionado do calendário acadêmico. Aditivo.
CREATE TABLE "CalendarioRevisao" (
    "id" TEXT NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "autorId" TEXT,
    "motivo" TEXT,
    "resumo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarioRevisao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarioRevisao_anoLetivo_numero_key" ON "CalendarioRevisao"("anoLetivo", "numero");
CREATE INDEX "CalendarioRevisao_anoLetivo_createdAt_idx" ON "CalendarioRevisao"("anoLetivo", "createdAt");

ALTER TABLE "CalendarioRevisao" ADD CONSTRAINT "CalendarioRevisao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
