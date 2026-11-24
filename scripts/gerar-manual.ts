/**
 * Gera docs/MANUAL_DO_USUARIO.md a partir de src/lib/ajuda/topicos.ts (mesmo conteúdo do módulo Ajuda).
 *   npm run manual
 * Rode depois de mudar os tópicos; o teste "manual atualizado" falha se o arquivo estiver desatualizado.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { montarManual } from '../src/lib/ajuda/markdown';

const destino = path.resolve(__dirname, '../docs/MANUAL_DO_USUARIO.md');
writeFileSync(destino, montarManual());
console.log(`Manual gerado em ${path.relative(process.cwd(), destino)}.`);
