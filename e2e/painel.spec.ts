import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

const funcoes = (page: import('@playwright/test').Page) => page.locator('details#funcoes');

test('Coordenação: pendências primeiro, funções num menu de um clique e o mês ao lado', async ({ page }) => {
  await entrar(page, 'coordenacao');
  // Os dados de demonstração têm ausência pendente e avisos de refeição.
  const atencao = page.locator('section[aria-labelledby="atencao"]');
  await expect(atencao.getByRole('heading', { name: 'Precisa da sua atenção' })).toBeVisible();
  await expect(atencao.getByRole('link', { name: /Decidir.*Ausências aguardando decisão/ })).toBeVisible();
  // Com pendências, o menu de funções começa fechado e abre com um clique.
  await expect(funcoes(page)).not.toHaveAttribute('open');
  await funcoes(page).locator('summary').click();
  await expect(funcoes(page)).toHaveAttribute('open', '');
  await expect(funcoes(page).getByRole('link', { name: /Auditoria/ })).toBeVisible();
  // Agenda da Coordenação que também leciona (dados de demonstração): Hoje, Minha semana e o mês recolhido.
  const agenda = page.locator('aside[aria-labelledby="agenda"]');
  const hoje = agenda.locator('section[aria-labelledby="hoje"]');
  await expect(hoje.getByRole('heading', { name: 'Hoje' })).toBeVisible();
  await expect(hoje.getByRole('link', { name: 'Todas as ausências' })).toHaveAttribute('href', '/ausencias');
  await expect(agenda.getByRole('heading', { name: /Minha semana/ })).toContainText('Docência');
  const mes = agenda.locator('details', { has: page.locator('summary', { hasText: 'Calendário do mês' }) });
  await expect(mes).not.toHaveAttribute('open');
  await mes.locator('summary').click();
  await expect(mes.getByRole('link', { name: 'Abrir calendário' })).toBeVisible();
});

test('Coordenação que leciona: o que é da docência aparece em azul e com o nome "Docência"', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await expect(page.getByText(/Coordenação e Docência/).first()).toBeVisible();
  // Menu do cabeçalho próprio da docência, com o recorte "meu" das telas.
  const docencia = page.getByRole('navigation', { name: 'Menu principal' }).locator('details', { has: page.locator('summary', { hasText: 'Docência' }) });
  await docencia.locator('summary').click();
  await expect(docencia.getByRole('link', { name: 'Minha grade' })).toHaveAttribute('href', '/grade/minha');
  await docencia.getByRole('link', { name: 'Meus diários' }).click();
  await expect(page).toHaveURL(/\/diarios\?escopo=meus$/);
  // A tela alterna entre todos (cargo) e os seus (docência), e só lista as disciplinas dela.
  const escopo = page.getByRole('navigation', { name: 'Escopo da lista' });
  await expect(escopo.getByRole('link', { name: 'Meus diários (Docência)' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('columnheader', { name: 'Docente' })).toHaveCount(0);
  await escopo.getByRole('link', { name: 'Todos os diários' }).click();
  await expect(page.getByRole('columnheader', { name: 'Docente' })).toBeVisible();
  // No painel, as funções da docência ficam num grupo à parte.
  await page.goto('/painel');
  await funcoes(page).locator('summary').click();
  await expect(funcoes(page).getByRole('region', { name: 'Docência' }).getByRole('link', { name: /Minhas PPE/ })).toHaveAttribute('href', '/ppe?escopo=minhas');
});


test('Assistência Estudantil: refeições previstas para hoje e amanhã', async ({ page }) => {
  await entrar(page, 'cae');
  const agenda = page.locator('aside[aria-labelledby="agenda"]');
  await expect(agenda.getByRole('heading', { name: 'Refeições previstas' })).toBeVisible();
  await expect(agenda.locator('ol > li')).toHaveCount(2);
  await expect(agenda.locator('ol > li[aria-current="date"]')).toContainText('Hoje');
  await expect(agenda.getByRole('link', { name: 'Detalhar amanhã' })).toHaveAttribute('href', /\/alimentacao\?data=\d{4}-\d{2}-\d{2}$/);
  await expect(agenda.getByRole('heading', { name: 'Próximos 30 dias' })).toBeVisible();
});

test('Professor: a semana dele na agenda', async ({ page }) => {
  await entrar(page, 'professor');
  const agenda = page.locator('aside[aria-labelledby="agenda"]');
  await expect(agenda.getByRole('heading', { name: 'Minha semana' })).toBeVisible();
  await expect(agenda.locator('ol > li')).not.toHaveCount(0);
  await expect(agenda.getByRole('link', { name: 'Grade completa' })).toHaveAttribute('href', '/grade/minha');
});

test('Direção: sem pendências, o menu de funções já vem aberto', async ({ page }) => {
  await entrar(page, 'direcao');
  await expect(page.getByRole('heading', { name: 'Tudo em dia' })).toBeVisible();
  await expect(funcoes(page)).toHaveAttribute('open', '');
  await expect(funcoes(page).getByRole('link', { name: /Relatórios/ })).toBeVisible();
});

test('Início no cabeçalho volta ao painel de qualquer página', async ({ page }) => {
  await entrar(page, 'cae');
  await page.goto('/alimentacao');
  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Início' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { level: 1, name: /Olá/ })).toBeVisible();
});

test('menu da conta reúne Meu contato e Alterar senha', async ({ page }) => {
  await entrar(page, 'professor');
  const conta = page.getByRole('navigation', { name: 'Conta' }).locator('details');
  await conta.locator('summary').click();
  await conta.getByRole('link', { name: 'Meu contato' }).click();
  await expect(page).toHaveURL(/\/conta\/contato$/);
});
