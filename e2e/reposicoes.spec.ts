import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

test('reposição: a Coordenação e o docente veem a orientação do formulário (anexo opcional ou e-mail institucional)', async ({ page }) => {
  for (const perfil of ['coordenacao', 'professor'] as const) {
    await entrar(page, perfil);
    await page.goto('/reposicoes');
    await expect(page.getByRole('heading', { level: 1, name: perfil === 'coordenacao' ? 'Reposição de aulas' : 'Minhas reposições' })).toBeVisible();
    await expect(page.locator('main')).toContainText('cctrc.boaviagem@ifce.edu.br');
    await expect(page.locator('main')).toContainText('o anexo não é obrigatório');
    await page.context().clearCookies();
  }
});

test('reposição: arquivo que não é PDF, JPG ou PNG é recusado', async ({ page }) => {
  await entrar(page, 'coordenacao');
  await page.goto('/reposicoes');
  const resumo = page.locator('summary', { hasText: 'Registrar reposição' }).first();
  test.skip((await resumo.count()) === 0, 'Sem aula dispensada nos dados de demonstração.');
  await resumo.click();
  const form = resumo.locator('xpath=..').locator('form').first();
  await form.getByLabel('Data em que a aula foi reposta').fill(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date()));
  await form.getByLabel(/^Formulário de reposição/).setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>não é pdf</html>') });
  await form.getByRole('button', { name: 'Registrar reposição' }).click();
  await expect(page.locator('main')).toContainText('Envie um arquivo PDF, JPG ou PNG.');
});
