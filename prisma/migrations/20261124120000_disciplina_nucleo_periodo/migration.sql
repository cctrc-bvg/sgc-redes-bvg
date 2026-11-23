-- CreateEnum
CREATE TYPE "NucleoDisciplina" AS ENUM ('PROPEDEUTICO', 'DIVERSIFICADO', 'TECNICO');

-- AlterTable
ALTER TABLE "Disciplina" ADD COLUMN     "anoCurso" INTEGER,
ADD COLUMN     "nucleo" "NucleoDisciplina",
ADD COLUMN     "semestreCurso" INTEGER;

