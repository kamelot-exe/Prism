export function confirmDelete(subject: string, count = 1): boolean {
  if (typeof window === 'undefined') return false;

  const label = count > 1 ? `${count} ${subject}` : subject;
  return window.confirm(`Delete ${label}? This cannot be undone.`);
}
