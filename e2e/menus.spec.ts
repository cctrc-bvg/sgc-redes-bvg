import { expect, test } from '@playwright/test';
import { entrar } from './apoio';

// Menus <details> do cabeçalho da Coordenação, com o complemento em JS (FecharMenus).
test.describe('Menus do cabeçalho', () => {
  test.beforeEach(async ({ page }) => entrar(page, 'coordenacao'));

  const menu = (page: import('@playwright/test').Page, titulo: string) =>
    page.getByRole('navigation', { name: 'Conta' }).locator('details', { has: page.locator('summary', { hasText: titulo }) });

  test('escolher um item navega e fecha o menu', async ({ page }) => {
    const operacao = menu(page, 'Operação');
    await operacao.locator('summary').click();
    await expect(operacao).toHaveAttribute('open', '');
    await operacao.getByRole('link', { name: 'Grade' }).click();
    await expect(page).toHaveURL(/\/grade$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Grade horária' })).toBeVisible();
    await expect(operacao).not.toHaveAttribute('open');
  });

  test('só um menu aberto por vez; Esc e clique fora fecham', async ({ page }) => {
    const operacao = menu(page, 'Operação');
    const cadastros = menu(page, 'Cadastros');
    await operacao.locator('summary').click();
    await cadastros.locator('summary').click();
    await expect(cadastros).toHaveAttribute('open', '');
    await expect(operacao).not.toHaveAttribute('open');

    await page.keyboard.press('Escape');
    await expect(cadastros).not.toHaveAttribute('open');
    await expect(cadastros.locator('summary')).toBeFocused();

    await operacao.locator('summary').click();
    await expect(operacao).toHaveAttribute('open', '');
    // Clique numa área livre, abaixo do menu aberto.
    await page.mouse.click(5, 700);
    await expect(operacao).not.toHaveAttribute('open');
  });
});

test.describe('Acesso por perfil', () => {
  test('professor não vê Usuários e é barrado ao abrir o endereço', async ({ page }) => {
    await entrar(page, 'professor');
    const nav = page.getByRole('navigation', { name: 'Conta' });
    await expect(nav.getByRole('link', { name: 'Grade' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/painel\?aviso=sem-permissao/);
    await expect(page.getByText('Seu perfil não tem acesso à página solicitada')).toBeVisible();
  });
});
