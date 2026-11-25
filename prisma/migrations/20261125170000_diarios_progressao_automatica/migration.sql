-- RF08-A (G25): progressão automática dos diários. Só acréscimo: as ofertas que já tinham aulas lançadas
-- passam a valer como lançamento manual, para não perder o que foi digitado.
ALTER TABLE "DisciplinaOferta" ADD COLUMN "ministradasManual" BOOLEAN NOT NULL DEFAULT false;
UPDATE "DisciplinaOferta" SET "ministradasManual" = true WHERE "aulasMinistradas" > 0;
