-- RF02-A (decisão G15, 25/11/2026): ausência informada pelo próprio docente.
ALTER TABLE "AusenciaDocente" ADD COLUMN "informadaPeloDocente" BOOLEAN NOT NULL DEFAULT false;
