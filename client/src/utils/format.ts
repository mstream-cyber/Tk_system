export function formatPrice(paisas: number) {
  return `PKR ${(paisas / 100).toLocaleString('en-PK')}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
