-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COORDENADOR', 'PROFESSOR', 'CTP', 'DIRECAO', 'ASSISTENCIA_ESTUDANTIL');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "TipoRefeicao" AS ENUM ('LANCHE_MANHA', 'ALMOCO', 'LANCHE_TARDE');

-- CreateEnum
CREATE TYPE "StatusAusencia" AS ENUM ('PENDENTE_DECISAO', 'COBERTA_POR_SUBSTITUICAO', 'AULA_ADIANTADA', 'TURMA_DISPENSADA', 'REPOSICAO_AGENDADA');

-- CreateEnum
CREATE TYPE "NivelUrgenciaSla" AS ENUM ('VERDE_24H_MAIS', 'AMARELO_4H_A_24H', 'VERMELHO_MENOS_4H');

-- CreateEnum
CREATE TYPE "AcaoAlimentacao" AS ENUM ('CANCELAR_REFEICAO', 'ADICIONAR_REFEICAO');

-- CreateEnum
CREATE TYPE "CanalWhatsapp" AS ENUM ('GRUPO_PROFESSORES', 'GRUPO_GESTAO_DIR_COORD', 'ASSISTENCIA_ESTUDANTIL', 'CTP', 'LIDERES_TURMA');

-- CreateEnum
CREATE TYPE "StatusPpi" AS ENUM ('RASCUNHO', 'EM_ANALISE', 'DEFERIDA', 'INDEFERIDA');

-- CreateEnum
CREATE TYPE "ModalidadePPE" AS ENUM ('A_DEFINIR', 'PEI', 'DEPENDENCIA', 'DEPENDENCIA_EAD');

-- CreateEnum
CREATE TYPE "StatusPPE" AS ENUM ('AGUARDANDO_PROFESSOR', 'EM_ANDAMENTO', 'PRORROGADO', 'APROVADO', 'REPROVADO', 'LANCADO_ACADEMICO');

-- CreateEnum
CREATE TYPE "TipoProcesso" AS ENUM ('APROVEITAMENTO_DISCIPLINA', 'GRADUADO_TRANSFERIDO', 'ESTAGIO', 'ORIENTACAO_MEDIACAO', 'OUTRO_SEI');

-- CreateEnum
CREATE TYPE "ColunaKanban" AS ENUM ('NOVO', 'COM_PROFESSOR', 'AGUARDANDO_RETORNO', 'CONCLUIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siape" TEXT,
    "whatsapp" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PROFESSOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "detalhes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "qtdAlunosAtivos" INTEGER NOT NULL DEFAULT 30,
    "qtdMediaLancheManha" INTEGER NOT NULL DEFAULT 30,
    "qtdMediaAlmoco" INTEGER NOT NULL DEFAULT 30,
    "qtdMediaLancheTarde" INTEGER NOT NULL DEFAULT 30,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disciplina" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "exigePratica" BOOLEAN NOT NULL DEFAULT false,
    "ementaUrl" TEXT,
    "programaTexto" TEXT,

    CONSTRAINT "Disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaOferta" (
    "id" TEXT NOT NULL,
    "semestre" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "disciplinaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "aulasPrevistas" INTEGER NOT NULL DEFAULT 0,
    "aulasMinistradas" INTEGER NOT NULL DEFAULT 0,
    "diarioEmDia" BOOLEAN NOT NULL DEFAULT true,
    "ultimaCobranca" TIMESTAMP(3),
    "observacaoDiario" TEXT,

    CONSTRAINT "DisciplinaOferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlocoHorario" (
    "id" TEXT NOT NULL,
    "turno" "Turno" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,

    CONSTRAINT "BlocoHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHorario" (
    "id" TEXT NOT NULL,
    "semestre" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "blocoId" TEXT NOT NULL,
    "ofertaId" TEXT,
    "sala" TEXT,

    CONSTRAINT "GradeHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AusenciaDocente" (
    "id" TEXT NOT NULL,
    "dataAula" TIMESTAMP(3) NOT NULL,
    "turmaId" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "professorAusenteId" TEXT NOT NULL,
    "professorSubstitutoId" TEXT,
    "blocosAfetados" TEXT NOT NULL,
    "motivoOperacional" TEXT NOT NULL,
    "status" "StatusAusencia" NOT NULL DEFAULT 'PENDENTE_DECISAO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AusenciaDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaAlimentacao" (
    "id" TEXT NOT NULL,
    "ausenciaId" TEXT,
    "turmaId" TEXT NOT NULL,
    "dataRefeicao" TIMESTAMP(3) NOT NULL,
    "tipoRefeicao" "TipoRefeicao" NOT NULL,
    "acao" "AcaoAlimentacao" NOT NULL DEFAULT 'CANCELAR_REFEICAO',
    "qtdImpactada" INTEGER NOT NULL,
    "antecedenciaMin" INTEGER NOT NULL,
    "nivelSla" "NivelUrgenciaSla" NOT NULL,
    "justificativa" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "confirmadoAE" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaAlimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoCanal" (
    "id" TEXT NOT NULL,
    "canal" "CanalWhatsapp" NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "destinoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConfiguracaoCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogComunicacao" (
    "id" TEXT NOT NULL,
    "canal" "CanalWhatsapp" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "modoEnvio" TEXT NOT NULL,
    "sucesso" BOOLEAN NOT NULL DEFAULT true,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogComunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpiRegraCategoria" (
    "id" TEXT NOT NULL,
    "grupo" INTEGER NOT NULL,
    "nomeGrupo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ponderacaoTexto" TEXT NOT NULL,
    "horasPorUnidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "qtdMaxima" INTEGER NOT NULL,
    "pontuacaoMaxima" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PpiRegraCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpiSolicitacao" (
    "id" TEXT NOT NULL,
    "nomeEstudante" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "turmaAtual" TEXT NOT NULL,
    "metaHoras" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "totalValidado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "StatusPpi" NOT NULL DEFAULT 'EM_ANALISE',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpiSolicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpiAtividade" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "descricaoComprovante" TEXT NOT NULL,
    "codigoCertificado" TEXT NOT NULL,
    "dataRealizacao" TIMESTAMP(3) NOT NULL,
    "orientadorId" TEXT,
    "orientadorExterno" TEXT,
    "quantidadeInformada" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "horasCalculadas" DOUBLE PRECISION NOT NULL,
    "aprovada" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PpiAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPPE" (
    "id" TEXT NOT NULL,
    "semestre" TEXT NOT NULL,
    "nomeEstudante" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "disciplinaId" TEXT NOT NULL,
    "modalidade" "ModalidadePPE" NOT NULL DEFAULT 'A_DEFINIR',
    "status" "StatusPPE" NOT NULL DEFAULT 'AGUARDANDO_PROFESSOR',
    "alertaRetencao" BOOLEAN NOT NULL DEFAULT false,
    "notaFinal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroPPE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoEstudoIndividual" (
    "id" TEXT NOT NULL,
    "ppeId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "cargaHorariaPei" INTEGER NOT NULL,
    "horasPresenciais" INTEGER NOT NULL,
    "horasPraticas" INTEGER NOT NULL DEFAULT 0,
    "objetivos" TEXT NOT NULL,
    "conteudos" TEXT NOT NULL,
    "criteriosAval" TEXT,
    "prorrogadoAte" TIMESTAMP(3),
    "justificativaProrrogacao" TEXT,
    "assinadoDocente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoEstudoIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeiEncontro" (
    "id" TEXT NOT NULL,
    "peiId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "metodologiaAvaliacao" TEXT NOT NULL,
    "realizado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PeiEncontro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessoKanban" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoProcesso" NOT NULL,
    "coluna" "ColunaKanban" NOT NULL DEFAULT 'NOVO',
    "numeroSei" TEXT,
    "prazo" TIMESTAMP(3),
    "sigiloso" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessoKanban_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_siape_key" ON "User"("siape");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_codigo_key" ON "Turma"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Disciplina_codigo_key" ON "Disciplina"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "BlocoHorario_turno_ordem_key" ON "BlocoHorario"("turno", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "GradeHorario_semestre_turmaId_diaSemana_blocoId_key" ON "GradeHorario"("semestre", "turmaId", "diaSemana", "blocoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoCanal_canal_key" ON "ConfiguracaoCanal"("canal");

-- CreateIndex
CREATE INDEX "PpiSolicitacao_matricula_idx" ON "PpiSolicitacao"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "PpiAtividade_solicitacaoId_codigoCertificado_key" ON "PpiAtividade"("solicitacaoId", "codigoCertificado");

-- CreateIndex
CREATE INDEX "RegistroPPE_semestre_matricula_idx" ON "RegistroPPE"("semestre", "matricula");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoEstudoIndividual_ppeId_key" ON "PlanoEstudoIndividual"("ppeId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaOferta" ADD CONSTRAINT "DisciplinaOferta_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaOferta" ADD CONSTRAINT "DisciplinaOferta_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaOferta" ADD CONSTRAINT "DisciplinaOferta_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHorario" ADD CONSTRAINT "GradeHorario_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHorario" ADD CONSTRAINT "GradeHorario_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "BlocoHorario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHorario" ADD CONSTRAINT "GradeHorario_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "DisciplinaOferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDocente" ADD CONSTRAINT "AusenciaDocente_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDocente" ADD CONSTRAINT "AusenciaDocente_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "DisciplinaOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDocente" ADD CONSTRAINT "AusenciaDocente_professorAusenteId_fkey" FOREIGN KEY ("professorAusenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDocente" ADD CONSTRAINT "AusenciaDocente_professorSubstitutoId_fkey" FOREIGN KEY ("professorSubstitutoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAlimentacao" ADD CONSTRAINT "AlertaAlimentacao_ausenciaId_fkey" FOREIGN KEY ("ausenciaId") REFERENCES "AusenciaDocente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAlimentacao" ADD CONSTRAINT "AlertaAlimentacao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpiAtividade" ADD CONSTRAINT "PpiAtividade_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "PpiSolicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpiAtividade" ADD CONSTRAINT "PpiAtividade_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "PpiRegraCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpiAtividade" ADD CONSTRAINT "PpiAtividade_orientadorId_fkey" FOREIGN KEY ("orientadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPPE" ADD CONSTRAINT "RegistroPPE_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoEstudoIndividual" ADD CONSTRAINT "PlanoEstudoIndividual_ppeId_fkey" FOREIGN KEY ("ppeId") REFERENCES "RegistroPPE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoEstudoIndividual" ADD CONSTRAINT "PlanoEstudoIndividual_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiEncontro" ADD CONSTRAINT "PeiEncontro_peiId_fkey" FOREIGN KEY ("peiId") REFERENCES "PlanoEstudoIndividual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoKanban" ADD CONSTRAINT "ProcessoKanban_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

