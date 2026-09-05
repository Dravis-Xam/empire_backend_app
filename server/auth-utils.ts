function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getSafeOrigin(value: unknown): string | undefined {
  const candidate = getString(value);
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function getFrontendUrl(req: any): string {
  const redirectUri = getSafeOrigin(
    req.query?.redirect_uri ?? req.body?.redirect_uri ?? req.session?.redirectUri,
  );
  if (redirectUri) return redirectUri;

  const referer = getSafeOrigin(req.headers.referer ?? req.headers.referrer);
  if (referer) return referer;

  const origin = getSafeOrigin(req.headers.origin);
  if (origin) return origin;

  const host = getString(req.headers["x-forwarded-host"] ?? req.headers.host);
  if (host && !host.includes("/")) {
    const proto = getString(req.headers["x-forwarded-proto"]) ?? (req.secure ? "https" : "http");
    if (proto === "http" || proto === "https") return `${proto}://${host}`;
  }

  return getSafeOrigin(process.env.LIVE_FRONTEND_URI) ?? "http://localhost:3000";
}

export function captureRedirectUri(req: any, _res: any, next: any): void {
  const redirectUri = getSafeOrigin(req.query?.redirect_uri);
  if (redirectUri && req.session) req.session.redirectUri = redirectUri;
  next();
}