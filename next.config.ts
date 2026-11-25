import type { NextConfig } from 'next';

const emDesenvolvimento = process.env.NODE_ENV === 'development';

// Política de conteúdo: tudo vem do próprio sistema (a fonte é servida pelo next/font). Os scripts inline do Next
// exigem 'unsafe-inline' sem nonce; o `eval` só no `next dev`. O HTTPS (HSTS, upgrade) fica no proxy reverso,
// porque o mesmo build roda por http nos testes.
const politicaDeConteudo = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const cabecalhosDeSeguranca = [
  { key: 'Content-Security-Policy', value: politicaDeConteudo },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  // Gera .next/standalone com o servidor mínimo usado na imagem Docker.
  output: 'standalone',
  // ExcelJS (importação de planilhas) roda só no servidor e não precisa ser empacotado.
  serverExternalPackages: ['exceljs'],
  // Não anuncia o framework no cabeçalho X-Powered-By.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:caminho*', headers: cabecalhosDeSeguranca }];
  },
  experimental: {
    serverActions: {
      // Upload de planilhas (até 1 MB) e de formulários de reposição (até 5 MB, conferidos no servidor) + sobra para o multipart.
      bodySizeLimit: '7mb',
    },
  },
};

export default nextConfig;
