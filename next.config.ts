import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera .next/standalone com o servidor mínimo usado na imagem Docker.
  output: 'standalone',
};

export default nextConfig;
