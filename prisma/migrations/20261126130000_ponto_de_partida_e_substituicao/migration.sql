-- Lançamento manual do diário vale como ponto de partida (data do lançamento) e o substituto registra a disciplina que ministrou. Aditivo.
ALTER TABLE "DisciplinaOferta" ADD COLUMN "ministradasEm" DATE;
ALTER TABLE "CoberturaBloco" ADD COLUMN "ofertaSubstitutaId" TEXT;
