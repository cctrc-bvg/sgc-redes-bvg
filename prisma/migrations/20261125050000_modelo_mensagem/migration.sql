-- CreateTable
CREATE TABLE "ModeloMensagem" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "destinos" "CanalWhatsapp"[],
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeloMensagem_tipo_ordem_idx" ON "ModeloMensagem"("tipo", "ordem");

