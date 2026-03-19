const normalizeUrl = (value: string | undefined) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/+$/, '');
};

export const getAppUrl = () => {
  return normalizeUrl(import.meta.env.VITE_APP_URL)
    ?? normalizeUrl(import.meta.env.VITE_PUBLIC_APP_URL)
    ?? window.location.origin;
};
