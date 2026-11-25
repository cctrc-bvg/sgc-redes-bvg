-- Docência acumulada ao cargo (coordenação, direção, CTP ou AE que também lecionam).
ALTER TABLE "User" ADD COLUMN "leciona" BOOLEAN NOT NULL DEFAULT false;

-- Professores sempre lecionam. A Coordenação já era tratada como docente (podia receber disciplinas e
-- substituir aulas): mantém-se assim, e a própria Coordenação pode desmarcar quem não leciona.
-- Demais perfis com disciplina atribuída também passam a lecionar.
UPDATE "User" SET "leciona" = true
WHERE "role" IN ('PROFESSOR', 'COORDENADOR')
   OR "id" IN (SELECT DISTINCT "professorId" FROM "DisciplinaOferta");
