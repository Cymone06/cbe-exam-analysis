/**
 * Password field with show/hide toggle and strength meter (REQ-A1).
 * Strength scoring: length ≥ 8, mixed case, digit, symbol.
 */
import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';

export function PasswordField({
  label,
  value,
  onChange,
  id = 'password',
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const strength = useMemo(() => scorePassword(value), [value]);
  const errors = strength.hints;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={hint === 'current' ? 'current-password' : 'new-password'}
          autoFocus={autoFocus}
          aria-describedby={`${id}-strength`}
          className="pr-10"
          placeholder="••••••••"
          required
          minLength={8}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {/* strength meter */}
      <div id={`${id}-strength`} className="mt-1.5">
        <div className="flex gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < strength.score
                  ? strength.score <= 1 ? 'bg-red-400' : strength.score === 2 ? 'bg-amber-400' : strength.score === 3 ? 'bg-lime-500' : 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
        <p className={`text-xs mt-1 ${strength.score <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} aria-live="polite">
          {value.length === 0
            ? 'Use at least 8 characters.'
            : strength.label}
        </p>
        {strength.score < 4 && value.length > 0 && (
          <p className="text-xs text-gray-400">{errors.join(' ')}</p>
        )}
      </div>
    </div>
  );
}

function scorePassword(pw: string): { score: number; label: string; hints: string[] } {
  const hints: string[] = [];
  let score = 0;
  if (pw.length >= 8) score += 1; else hints.push('At least 8 characters.');
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1; else hints.push('Mix UPPER and lower case.');
  if (/\d/.test(pw)) score += 1; else hints.push('Add a number.');
  if (/[^A-Za-z0-9]/.test(pw)) score += 1; else hints.push('Add a symbol (!@#…).');
  const clamped = Math.min(4, score - (score === 4 && pw.length < 10 ? 1 : 0));
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score: Math.max(0, clamped), label: labels[Math.max(0, clamped)], hints };
}
