import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera .next/standalone com o servidor mínimo usado na imagem Docker.
  output: 'standalone',
  // ExcelJS (importação de planilhas) roda só no servidor e não precisa ser empacotado.
  serverExternalPackages: ['exceljs'],
  experimental: {
    serverActions: {
      // Upload de planilhas: arquivos de até 1 MB + sobra para o multipart.
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
