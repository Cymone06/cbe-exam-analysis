import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, BarChart2, AlertTriangle,
  ClipboardList, ArrowLeftRight, FileText, Settings, Users,
} from 'lucide-react';

const nav = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/learners',icon: Users,           label: 'My Learners' },
  { to: '/exams',   icon: BookOpen,        label: 'Exams' },
  { to: '/analysis',icon: BarChart2,       label: 'Analysis' },
  { to: '/gaps',    icon: AlertTriangle,   label: 'Gaps' },
  { to: '/plan',    icon: ClipboardList,   label: 'Action Plan' },
  { to: '/compare', icon: ArrowLeftRight,  label: 'Compare' },
  { to: '/report',  icon: FileText,        label: 'Report' },
  { to: '/settings',icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  return (
    <nav
      aria-label="Main navigation"
      className="hidden md:flex flex-col w-60 min-h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 py-6 px-3 gap-1 shrink-0"
    >
      <div className="px-3 mb-6">
        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">CBE Analysis</span>
      </div>
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            ${isActive
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'}`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
