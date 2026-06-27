let base = import.meta.env.VITE_API_BASE_URL || '';

if (!base) {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      base = `http://${host}:8000`;
    } else {
      // In production, fallback to relative path so requests match current origin
      base = '';
    }
  }
}

export const API_BASE = base.replace(/\/$/, '');

