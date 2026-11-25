-- Avaliações finais não contam como dias letivos (ROD, Art. 32; decisão de 25/11/2026): eventos já cadastrados
-- passam a tirar os dias da contagem e da grade. Só atualiza a marcação; nenhum dado é apagado.
UPDATE "EventoCalendario" SET "suspendeAulas" = true WHERE "tipo" = 'AVALIACOES_FINAIS';
