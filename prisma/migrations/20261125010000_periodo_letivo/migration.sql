-- CreateTable
CREATE TABLE "PeriodoLetivo" (
    "id" TEXT NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "semestreLetivo" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,

    CONSTRAINT "PeriodoLetivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodoLetivo_anoLetivo_semestreLetivo_key" ON "PeriodoLetivo"("anoLetivo", "semestreLetivo");

