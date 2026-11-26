-- SGC-Redes — retenção de dados (LGPD). Prazos decididos em 27/11/2026 (docs/estudos/REVISAO_SEGURANCA_LGPD.md):
--   • anexos de reposição (formulários com assinaturas de estudantes): apagados 1 ano após o fim do semestre da aula;
--   • IP da trilha de auditoria: anulado após 2 anos (a ação, o autor e a data ficam);
--   • usuários desativados: nome, e-mail, SIAPE e WhatsApp anonimizados 2 anos após a desativação.
-- Um único comando; devolve as quantidades (também gravadas na própria auditoria). Rode por scripts/aplicar-retencao.sh.
WITH anexos AS (
  DELETE FROM "AnexoReposicao" x
  USING "AusenciaDocente" d
  WHERE x."ausenciaId" = d.id
    AND make_date(
          EXTRACT(YEAR FROM d."dataAula")::int,
          CASE WHEN EXTRACT(MONTH FROM d."dataAula") <= 6 THEN 6 ELSE 12 END,
          CASE WHEN EXTRACT(MONTH FROM d."dataAula") <= 6 THEN 30 ELSE 31 END
        ) + INTERVAL '1 year' < CURRENT_DATE
  RETURNING x.id
), ips AS (
  UPDATE "AuditLog" SET "ipAddress" = NULL
  WHERE "ipAddress" IS NOT NULL AND "createdAt" < now() - INTERVAL '2 years'
  RETURNING id
), usuarios AS (
  UPDATE "User"
  SET nome = 'Usuário removido',
      email = 'removido-' || id || '@removido.invalid',
      siape = NULL,
      whatsapp = NULL,
      "passwordHash" = 'removido'
  WHERE ativo = false
    AND email NOT LIKE '%@removido.invalid'
    AND "updatedAt" < now() - INTERVAL '2 years'
  RETURNING id
)
INSERT INTO "AuditLog" (id, acao, entidade, "entidadeId", detalhes, "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), 'RETENCAO_APLICADA', 'Sistema', 'retencao',
       jsonb_build_object(
         'anexosApagados', (SELECT count(*) FROM anexos),
         'ipsAnulados', (SELECT count(*) FROM ips),
         'usuariosAnonimizados', (SELECT count(*) FROM usuarios)
       ),
       now()
RETURNING detalhes;
