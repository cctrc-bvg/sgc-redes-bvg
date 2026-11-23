-- Grade: "semestre" texto ("2026.1") vira ano letivo + semestre letivo, como nas ofertas.
-- Converte linhas existentes antes de remover a coluna antiga (sem semestre → 1º semestre).
DROP INDEX "GradeHorario_semestre_turmaId_diaSemana_blocoId_key";

ALTER TABLE "GradeHorario" ADD COLUMN "anoLetivo" INTEGER,
ADD COLUMN "semestreLetivo" INTEGER;

UPDATE "GradeHorario"
SET "anoLetivo" = split_part("semestre", '.', 1)::INTEGER,
    "semestreLetivo" = COALESCE(NULLIF(split_part("semestre", '.', 2), '')::INTEGER, 1);

ALTER TABLE "GradeHorario" ALTER COLUMN "anoLetivo" SET NOT NULL,
ALTER COLUMN "semestreLetivo" SET NOT NULL,
DROP COLUMN "semestre";

CREATE UNIQUE INDEX "GradeHorario_anoLetivo_semestreLetivo_turmaId_diaSemana_blo_key" ON "GradeHorario"("anoLetivo", "semestreLetivo", "turmaId", "diaSemana", "blocoId");

-- Sábados letivos (G14): cada um segue a grade de um dia da semana.
CREATE TABLE "SabadoLetivo" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "diaSemanaReferente" INTEGER NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SabadoLetivo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SabadoLetivo_data_key" ON "SabadoLetivo"("data");
