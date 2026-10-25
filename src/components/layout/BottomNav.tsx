import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, BarChart2, ClipboardList, Settings, Users,
} from 'lucide-react';

const nav = [
  { to: '/',         icon: LayoutDashboard, label: 'Home' },
  { to: '/learners', icon: Users,           label: 'Learners' },
  { to: '/exams',    icon: BookOpen,         label: 'Exams' },
  { to: '/analysis', icon: BarChart2,        label: 'Analysis' },
  { to: '/plan',     icon: ClipboardList,    label: 'Plan' },
  { to: '/settings', icon: Settings,         label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom"
    >
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
