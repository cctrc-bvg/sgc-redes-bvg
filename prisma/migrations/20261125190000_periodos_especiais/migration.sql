-- Períodos especiais (jogos internos, encontro dos servidores, eventos externos): grade temporária por turma e
-- quantidade de estudantes presentes por dia, para replanejar aulas e alimentação. Só tabelas novas.
CREATE TYPE "TipoPeriodoEspecial" AS ENUM ('JOGOS_INTERNOS', 'ENCONTRO_SERVIDORES', 'UNIVERSO_FCE', 'SEMANA_DO_CURSO', 'SEMANA_OUTROS_CURSOS', 'ENCONTRO_EXTENSAO', 'ENCONTRO_PESQUISA', 'EVENTO_EXTERNO', 'OUTRO');

CREATE TABLE "PeriodoEspecial" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoPeriodoEspecial" NOT NULL,
  "inicio" DATE NOT NULL,
  "fim" DATE NOT NULL,
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodoEspecial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PeriodoEspecial_inicio_fim_idx" ON "PeriodoEspecial"("inicio", "fim");

CREATE TABLE "GradeEspecial" (
  "id" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "turmaId" TEXT NOT NULL,
  "diaSemana" INTEGER NOT NULL,
  "blocoId" TEXT NOT NULL,
  "ofertaId" TEXT,
  "sala" TEXT,
  CONSTRAINT "GradeEspecial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GradeEspecial_periodoId_turmaId_diaSemana_blocoId_key" ON "GradeEspecial"("periodoId", "turmaId", "diaSemana", "blocoId");

CREATE TABLE "PresencaEspecial" (
  "id" TEXT NOT NULL,
  "periodoId" TEXT NOT NULL,
  "turmaId" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "qtdAlunos" INTEGER NOT NULL,
  CONSTRAINT "PresencaEspecial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PresencaEspecial_periodoId_turmaId_data_key" ON "PresencaEspecial"("periodoId", "turmaId", "data");

ALTER TABLE "GradeEspecial" ADD CONSTRAINT "GradeEspecial_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEspecial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeEspecial" ADD CONSTRAINT "GradeEspecial_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradeEspecial" ADD CONSTRAINT "GradeEspecial_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "BlocoHorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradeEspecial" ADD CONSTRAINT "GradeEspecial_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "DisciplinaOferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PresencaEspecial" ADD CONSTRAINT "PresencaEspecial_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEspecial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresencaEspecial" ADD CONSTRAINT "PresencaEspecial_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
