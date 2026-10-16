/**
 * Helpers for rendering a tenant's logo. The logo is stored exactly as the
 * user uploaded it (a data: URL in practice today, but a relative path or
 * absolute http(s) URL are also supported) and must never be rewritten with
 * a host prefix. Cache-busting query strings only make sense for normal
 * http(s)/path URLs — appending one to a data: URL corrupts the base64
 * payload and breaks the image.
 */
export function appendCacheBust(url: string, version: number | string): string {
  if (url.startsWith("data:")) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}
