import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirUsuario } from '@/lib/auth/dal';
import { formatarWhatsapp } from '@/lib/usuarios/regras';
import { FormularioContato } from './formulario-contato';

export const metadata: Metadata = { title: 'Meu contato — SGC-Redes' };

export default async function PaginaContato() {
  const { usuario } = await exigirUsuario();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id }, select: { email: true, whatsapp: true, usaWhatsapp: true } });
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Meu contato</h1>
      <p className="mt-1 text-slate-700">
        As comunicações do sistema sempre podem ser feitas pelo seu e-mail institucional, <strong>{u.email}</strong>. O WhatsApp é opcional.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioContato whatsapp={formatarWhatsapp(u.whatsapp)} usaWhatsapp={u.usaWhatsapp} />
      </div>
      <p className="mt-4 text-sm">
        <Link href="/conta/senha" className="text-if-verde-700 underline underline-offset-2">
          Alterar senha
        </Link>
      </p>
    </div>
  );
}
