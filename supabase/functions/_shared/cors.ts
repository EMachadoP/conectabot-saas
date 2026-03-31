const DEFAULT_ALLOWED_ORIGINS = [
  "https://conectabot-saas.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, "");
}

function getConfiguredOrigins() {
  const envOrigins = [
    Deno.env.get("SITE_URL"),
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("APP_URL"),
    Deno.env.get("VITE_PUBLIC_APP_URL"),
    Deno.env.get("VITE_APP_URL"),
  ]
    .filter(Boolean)
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins].map(normalizeOrigin));
}

export function buildCorsHeaders(req: Request, methods = "POST, OPTIONS") {
  const origin = req.headers.get("Origin");
  const allowedOrigins = getConfiguredOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
  };

  if (origin && allowedOrigins.has(normalizeOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}
