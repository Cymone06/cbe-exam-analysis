import type { PerformanceLevel } from '@/types';
import { LEVEL_COLOURS } from '@/utils/scoring';

interface ProgressBarProps {
  pct: number;
  level: PerformanceLevel;
  showLabel?: boolean;
  height?: number;
}

export function ProgressBar({ pct, level, showLabel = true, height = 8 }: ProgressBarProps) {
  const colour = LEVEL_COLOURS[level];
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: colour }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-9 text-right">
          {pct}%
        </span>
      )}
    </div>
  );
}
