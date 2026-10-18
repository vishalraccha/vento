import { format } from 'date-fns';

/**
 * Safely format dates without crashing on invalid or null timestamps.
 */
export function formatSafeDate(dateStr: string | null | undefined, formatPattern = 'dd MMM yyyy'): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, formatPattern);
  } catch {
    return '—';
  }
}
