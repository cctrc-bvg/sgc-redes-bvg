import { PrismaClient, Role, CanalWhatsapp } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { REGRAS_PPI_2022 } from '../src/lib/ppi-regras-2022';
import { MATRIZ_REDES } from '../src/lib/disciplinas/matriz-curricular';
import { BLOCOS_HORARIO } from '../src/lib/grade/blocos-horario';

const prisma = new PrismaClient();

async function main() {
  // 1. Coordenador inicial — senha provisória, troca obrigatória no primeiro acesso.
  //    Vem de SEED_COORDENADOR_SENHA (.env) ou é gerada aleatoriamente e exibida uma única vez.
  const emailCoordenador = (process.env.SEED_COORDENADOR_EMAIL || 'cctrc.boaviagem@ifce.edu.br').trim().toLowerCase();
  const existente = await prisma.user.findUnique({ where: { email: emailCoordenador } });
  if (!existente) {
    const senhaInformada = process.env.SEED_COORDENADOR_SENHA;
    const senha = senhaInformada || randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        nome: 'Coordenação Redes de Computadores',
        email: emailCoordenador,
        passwordHash: await bcrypt.hash(senha, 12),
        role: Role.COORDENADOR,
        deveTrocarSenha: true,
      },
    });
    console.log(`Usuário coordenador criado: ${emailCoordenador}`);
    if (!senhaInformada) {
      console.log(`Senha provisória (anote agora, não será exibida novamente): ${senha}`);
    }
  }

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

  // 5. Blocos de aula (G01). Atualiza os horários se mudarem; a grade referencia o bloco pelo id.
  for (const b of BLOCOS_HORARIO) {
    await prisma.blocoHorario.upsert({
      where: { turno_ordem: { turno: b.turno, ordem: b.ordem } },
      update: { horaInicio: b.horaInicio, horaFim: b.horaFim },
      create: { turno: b.turno, ordem: b.ordem, horaInicio: b.horaInicio, horaFim: b.horaFim },
    });
  }

  // 6. Catálogo de disciplinas (matriz do PPC). Só cria as que faltam, procurando por código ou
  //    nome: nunca sobrescreve o que a Coordenação já ajustou no sistema.
  let novas = 0;
  for (const d of MATRIZ_REDES) {
    const existe = await prisma.disciplina.findFirst({
      where: { OR: [...(d.codigo ? [{ codigo: d.codigo }] : []), { nome: { equals: d.nome, mode: 'insensitive' as const } }] },
      select: { id: true },
    });
    if (!existe) {
      await prisma.disciplina.create({ data: { codigo: d.codigo, nome: d.nome, cargaHoraria: d.cargaHoraria } });
      novas++;
    }
  }
  if (novas > 0) console.log(`Disciplinas da matriz cadastradas: ${novas}`);

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