import { MODULOS, NOME_PERFIL, PERFIS } from '@/lib/auth/rbac';
import { matrizDeAcesso } from './acesso';
import { TOPICOS } from './topicos';
import { tipoDeAtor } from './atores';

/** Cores dos diagramas por quem faz a etapa (as mesmas da Ajuda no sistema). */
export const CLASSES_MERMAID = [
  '  classDef gestao fill:#e8f5ea,stroke:#237a32,color:#1b5e27',
  '  classDef docencia fill:#e8f0fb,stroke:#1d5fb8,color:#174a8f',
  '  classDef setor fill:#fffbeb,stroke:#d97706,color:#78350f',
  '  classDef sistema fill:#f8fafc,stroke:#64748b,color:#1e293b',
  '  classDef todos fill:#ffffff,stroke:#64748b,color:#1e293b',
];
export const LEGENDA_CORES = '*Cores: verde, Coordenação e gestão; azul, docência; âmbar, setores; cinza, o próprio sistema.*';

/** Manual do usuário em Markdown (docs/MANUAL_DO_USUARIO.md), com as imagens de public/manual. */
export function montarManual(): string {
  const l: string[] = [
    '# SGC-Redes — Manual do usuário',
    '',
    '> Gerado de `src/lib/ajuda/topicos.ts` por `npm run manual` — não edite à mão. O mesmo conteúdo está no sistema, em **Ajuda**',
    '> (com versão para imprimir/PDF em `/ajuda/manual`). As telas usam dados fictícios de demonstração.',
    '',
    'O SGC-Redes apoia a rotina da Coordenação do Curso Técnico Integrado em Redes de Computadores do IFCE Campus Boa Viagem:',
    'calendário, grade, ausências e substituições, refeições, comunicação por e-mail ou WhatsApp, PPE/PEI, PPI, diários,',
    'processos e relatórios. Ele complementa os sistemas oficiais (SUAP/Q-Acadêmico, SEI), sem substituí-los.',
    '',
    '## Sumário',
    '',
    ...TOPICOS.map((t, i) => `${i + 1}. [${t.titulo}](#${ancora(`${i + 1}. ${t.titulo}`)})`),
    `${TOPICOS.length + 1}. [Quem vê o quê](#${ancora(`${TOPICOS.length + 1}. Quem vê o quê`)})`,
    '',
  ];
  TOPICOS.forEach((t, i) => {
    l.push(`## ${i + 1}. ${t.titulo}`, '', t.resumo, '');
    if (t.rota) l.push(`No sistema: \`${t.rota}\`${t.permissao ? '' : ' · disponível para todos os perfis'}.`, '');
    l.push('### O que você pode fazer', '', ...t.capacidades.map((c) => `- ${c}`), '');
    if (t.diagrama) {
      l.push(`### Fluxo: ${t.diagrama.titulo}`, '', '```mermaid', 'flowchart LR', ...CLASSES_MERMAID);
      t.diagrama.etapas.forEach((e, k) => {
        const texto = [`<b>${k + 1}. ${e.rotulo}</b>`, `<i>${e.ator}</i>`, e.detalhe, e.onde && `Onde: ${e.onde.tela}`].filter(Boolean).join('<br/>').replace(/"/g, "'");
        l.push(`  E${k}["${texto}"]:::${tipoDeAtor(e.ator)}`);
        if (k > 0) l.push(`  E${k - 1} --> E${k}`);
      });
      l.push('```', '', LEGENDA_CORES, '');
    }
    l.push('### Passo a passo', '');
    for (const f of t.fluxos) l.push(`**${f.titulo}** (${f.quem})`, '', ...f.passos.map((p, k) => `${k + 1}. ${p}`), '');
    if (t.imagens.length) {
      l.push('### Telas', '');
      for (const img of t.imagens) l.push(`![${img.alt}](../public/manual/${img.arquivo})`, '', `*${img.legenda}*`, '');
    }
    if (t.duvidas.length) {
      l.push('### Dúvidas frequentes', '');
      for (const d of t.duvidas) l.push(`- **${d.pergunta}** ${d.resposta}`);
      l.push('');
    }
  });
  l.push(`## ${TOPICOS.length + 1}. Quem vê o quê`, '', `| Módulo | ${PERFIS.map((p) => NOME_PERFIL[p]).join(' | ')} |`, `| :--- | ${PERFIS.map(() => ':---:').join(' | ')} |`);
  for (const { modulo, perfis } of matrizDeAcesso()) l.push(`| ${modulo.titulo} | ${perfis.map((ok) => (ok ? '✔' : '—')).join(' | ')} |`);
  l.push('', `Cadastros (usuários, turmas, disciplinas, ofertas), auditoria e mensagens são da Coordenação. Módulos: ${MODULOS.length}.`, '');
  return l.join('\n');
}

/** Âncora no estilo do GitHub: minúsculas, sem pontuação, espaços viram hífen. */
export function ancora(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}
