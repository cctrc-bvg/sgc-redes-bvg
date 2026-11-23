import { PrismaClient, Role, CanalWhatsapp } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { REGRAS_PPI_2022 } from '../src/lib/ppi-regras-2022';

const prisma = new PrismaClient();

async function main() {
  // 1. Coordenador inicial (trocar senha no primeiro acesso!)
  const hash = await bcrypt.hash('Ifce@Redes2026', 12);
  await prisma.user.upsert({
    where: { email: 'cctrc.boaviagem@ifce.edu.br' },
    update: {},
    create: {
      nome: 'Coordenação Redes de Computadores',
      email: 'cctrc.boaviagem@ifce.edu.br',
      passwordHash: hash,
      role: Role.COORDENADOR,
    },
  });

  // 2. Três turmas do Técnico Integrado
  const turmas = [
    { codigo: 'REDES-1', nome: 'Redes 1º Ano (Integrado)', anoLetivo: 2026 },
    { codigo: 'REDES-2', nome: 'Redes 2º Ano (Integrado)', anoLetivo: 2026 },
    { codigo: 'REDES-3', nome: 'Redes 3º Ano (Integrado)', anoLetivo: 2026 },
  ];
  for (const t of turmas) {
    await prisma.turma.upsert({
      where: { codigo: t.codigo },
      update: {},
      create: t,
    });
  }

  // 3. Canais de WhatsApp padrão
  const canais: { canal: CanalWhatsapp; nomeExibicao: string }[] = [
    { canal: 'GRUPO_PROFESSORES', nomeExibicao: 'Grupo Professores - Redes' },
    { canal: 'GRUPO_GESTAO_DIR_COORD', nomeExibicao: 'Grupo Gestão (Coord + DE + DG)' },
    { canal: 'ASSISTENCIA_ESTUDANTIL', nomeExibicao: 'Assistência Estudantil (Refeitório)' },
    { canal: 'CTP', nomeExibicao: 'CTP - Coord. Técnico-Pedagógica' },
    { canal: 'LIDERES_TURMA', nomeExibicao: 'Líderes das Turmas de Redes' },
  ];
  for (const c of canais) {
    await prisma.configuracaoCanal.upsert({
      where: { canal: c.canal },
      update: {},
      create: c,
    });
  }

  // 4. Regras PPI (evita duplicar se rodar seed novamente)
  const countPpi = await prisma.ppiRegraCategoria.count();
  if (countPpi === 0) {
    await prisma.ppiRegraCategoria.createMany({ data: REGRAS_PPI_2022 });
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });