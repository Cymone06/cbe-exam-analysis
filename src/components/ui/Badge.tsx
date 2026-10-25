import type { PerformanceLevel, SubLevel } from '@/types';
import { LEVEL_BG_CLASSES, LEVEL_LABELS } from '@/utils/scoring';

interface BadgeProps {
  level: PerformanceLevel;
  subLevel?: SubLevel;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = { sm: 'text-xs px-1.5 py-0.5', md: 'text-sm px-2 py-0.5', lg: 'text-base px-3 py-1' };

export function Badge({ level, subLevel, showLabel = false, size = 'md', className = '' }: BadgeProps) {
  const label = subLevel ?? level;
  const title = LEVEL_LABELS[level];
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${LEVEL_BG_CLASSES[level]} ${sizeClasses[size]} ${className}`}
      title={title}
      aria-label={`${title}${subLevel ? ` (${subLevel})` : ''}`}
    >
      {label}
      {showLabel && <span className="ml-1 font-normal">{LEVEL_LABELS[level]}</span>}
    </span>
  );
}
