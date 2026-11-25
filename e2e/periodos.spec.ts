import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('período especial: cria, monta a grade da turma, informa presentes e vê o resumo de refeições', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/periodos');
  await expect(page.getByRole('heading', { level: 1, name: 'Períodos especiais' })).toBeVisible();

  // Datas dentro do semestre de demonstração (segunda a sexta, no futuro próximo).
  const hoje = new Date();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + ((8 - hoje.getDay()) % 7 || 7));
  const sexta = new Date(segunda);
  sexta.setDate(segunda.getDate() + 4);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  await page.getByLabel('Nome do período').fill('Jogos internos E2E');
  await page.getByLabel('Início').fill(iso(segunda));
  await page.getByLabel('Fim').fill(iso(sexta));
  await page.getByRole('button', { name: 'Criar período' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Jogos internos E2E' })).toBeVisible();

  // Edita o nome e o tipo.
  await page.locator('summary', { hasText: 'Editar nome, tipo e datas' }).click();
  await page.getByLabel('Nome do período').fill('Universo IFCE E2E');
  await page.getByLabel('Tipo').selectOption('UNIVERSO_IFCE');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.locator('main')).toContainText('Período atualizado.');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Universo IFCE E2E' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Universo IFCE');

  // Grade especial da primeira turma: copia a normal e salva.
  const turma = page.locator('section[aria-labelledby="grades"] li').first();
  await turma.locator('summary').click();
  await turma.getByRole('button', { name: /Copiar a grade normal/ }).click();
  await expect(turma).toContainText('Com grade especial');
  // O bloco pode ou não continuar aberto depois da cópia.
  if ((await turma.locator('details[open]').count()) === 0) await turma.locator('summary').click();
  await turma.getByRole('button', { name: 'Salvar grade especial' }).click();
  await expect(turma).toContainText('Grade especial salva.');

  // Presentes: valor acima dos ativos é recusado; valor válido salva.
  const presentes = page.locator('section[aria-labelledby="presentes"]');
  if (await presentes.count()) {
    const campo = presentes.getByRole('textbox').first();
    await campo.fill('999');
    await presentes.getByRole('button', { name: 'Salvar presentes' }).click();
    await expect(presentes).toContainText('estudantes ativos');
    await campo.fill('5');
    await presentes.getByRole('button', { name: 'Salvar presentes' }).click();
    await expect(presentes).toContainText('Estudantes presentes salvos.');
  }

  await page.reload();
  await expect(page.locator('section[aria-labelledby="refeicoes"]')).toContainText(/Lanche da manhã|O resumo aparece/);

  // Limpa: exclui o período.
  await page.getByRole('button', { name: /Excluir este período/ }).click();
  await expect(page).toHaveURL(/\/periodos$/);
});
