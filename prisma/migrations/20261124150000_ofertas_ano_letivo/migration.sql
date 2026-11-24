-- Turma passa a saber o ano do curso (1º, 2º, 3º); o seed preenche as turmas padrão.
ALTER TABLE "Turma" ADD COLUMN "anoCurso" INTEGER;

-- Oferta: "semestre" texto ("2026.1") vira ano letivo + semestre letivo (null = anual).
-- Converte ofertas existentes antes de remover a coluna antiga.
ALTER TABLE "DisciplinaOferta" ADD COLUMN "anoLetivo" INTEGER,
ADD COLUMN "semestreLetivo" INTEGER;

UPDATE "DisciplinaOferta"
SET "anoLetivo" = split_part("semestre", '.', 1)::INTEGER,
    "semestreLetivo" = NULLIF(split_part("semestre", '.', 2), '')::INTEGER;

ALTER TABLE "DisciplinaOferta" ALTER COLUMN "anoLetivo" SET NOT NULL,
DROP COLUMN "semestre";

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaOferta_anoLetivo_turmaId_disciplinaId_key" ON "DisciplinaOferta"("anoLetivo", "turmaId", "disciplinaId");
