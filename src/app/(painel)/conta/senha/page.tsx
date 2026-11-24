import type { Metadata } from 'next';
import { Alerta } from '@/components/campo';
import { exigirUsuario } from '@/lib/auth/dal';
import { FormularioSenha } from './formulario-senha';

export const metadata: Metadata = { title: 'Alterar senha — SGC-Redes' };

export default async function PaginaSenha() {
  const { usuario } = await exigirUsuario({ permitirSenhaProvisoria: true });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Alterar senha</h1>
      {usuario.deveTrocarSenha && (
        <div className="mt-4">
          <Alerta tipo="info">Você está usando uma senha provisória. Defina uma senha pessoal para continuar.</Alerta>
        </div>
      )}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioSenha />
      </div>
    </div>
  );
}
