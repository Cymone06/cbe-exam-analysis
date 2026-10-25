/** Sync status indicator (REQ-SY3): Synced / Syncing / Offline / Sync error (retry). */
import { useState, useRef, useEffect } from 'react';
import { Cloud, CloudUpload, CloudOff, RefreshCw } from 'lucide-react';
import { useApp } from '@/store/AppContext';

const LABELS: Record<string, { text: string; cls: string; icon: typeof Cloud }> = {
  synced: { text: 'Synced', cls: 'text-green-600 dark:text-green-400', icon: Cloud },
  syncing: { text: 'Syncing…', cls: 'text-indigo-600 dark:text-indigo-400', icon: CloudUpload },
  idle: { text: '', cls: '', icon: Cloud },
  offline: { text: 'Offline — changes saved on this device', cls: 'text-amber-600 dark:text-amber-400', icon: CloudOff },
  error: { text: 'Sync error — tap to retry', cls: 'text-red-600 dark:text-red-400', icon: RefreshCw },
};

export function SyncIndicator() {
  const { sync, retrySync } = useApp();
  const [showOffline, setShowOffline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The offline note is a soft "banner chip": visible a few seconds only when
  // connectivity drops, then collapses to dot so it never nags.
  useEffect(() => {
    if (sync.status === 'offline' || sync.status === 'synced') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chip timing derived from status changes
      setShowOffline(sync.status === 'offline');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShowOffline(false), 6000);
    }
  }, [sync.status]);

  if (sync.status === 'idle') return null;

  const meta = LABELS[sync.status];
  const Icon = meta.icon;
  const dotClass = meta.cls;
  const expanded = showOffline || sync.status === 'syncing' || sync.status === 'error';

  return (
    <button
      type="button"
      onClick={sync.status === 'error' ? retrySync : undefined}
      title={sync.status === 'error' ? `${sync.error ?? 'Sync failed'} — click to retry` : meta.text}
      aria-label={meta.text || 'Sync status'}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <Icon size={15} className={dotClass} aria-hidden="true" />
      {expanded && (
        <span className={`text-xs font-medium ${dotClass}`}>
          {sync.status === 'error'
            ? 'Sync error — retry'
            : sync.status === 'syncing'
              ? 'Syncing…'
              : 'Offline — changes saved on this device'}
        </span>
      )}
      {sync.pending > 0 && (
        <span className="text-[10px] tabular-nums text-gray-400">{sync.pending}</span>
      )}
    </button>
  );
}
