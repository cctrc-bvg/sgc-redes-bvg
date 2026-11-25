import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  CircleHelp,
  Clock,
  GraduationCap,
  House,
  Kanban,
  KeyRound,
  LayoutGrid,
  Library,
  MessageSquareText,
  NotebookPen,
  Phone,
  ShieldCheck,
  Shuffle,
  Table2,
  TriangleAlert,
  Users,
  UserX,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { NomeIcone } from '@/lib/navegacao';

const ICONES: Record<NomeIcone, LucideIcon> = {
  inicio: House,
  calendario: CalendarDays,
  grade: Table2,
  'minha-grade': CalendarCheck,
  ausencias: UserX,
  alimentacao: Utensils,
  comunicacao: MessageSquareText,
  ppe: BookOpenCheck,
  ppi: Award,
  diarios: NotebookPen,
  processos: Kanban,
  relatorios: ChartColumn,
  usuarios: Users,
  turmas: GraduationCap,
  disciplinas: Library,
  ofertas: Shuffle,
  auditoria: ShieldCheck,
  ajuda: CircleHelp,
  contato: Phone,
  senha: KeyRound,
  alerta: TriangleAlert,
  funcoes: LayoutGrid,
  relogio: Clock,
  ok: CircleCheck,
};

/**
 * Ícone de uma função (Lucide, desenhado no servidor como SVG). Decorativo: o texto ao lado diz o que é,
 * então o ícone fica fora da leitura de tela.
 */
export function Icone({ nome, className = 'size-5' }: { nome: NomeIcone; className?: string }) {
  const Componente = ICONES[nome];
  return <Componente aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} strokeWidth={1.75} />;
}
