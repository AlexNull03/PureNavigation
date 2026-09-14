export function detailPath(name: string): string {
  return `/app/${encodeURIComponent(name)}`;
}

export function hostLabel(homepage: string): string {
  const match = homepage.match(/^https?:\/\/([^/]+)/i);
  return match ? match[1].replace(/^www\./, "") : homepage;
}

export function linkKind(download: string): "direct" | "page" {
  return /\.(exe|msi|zip|dmg|deb|rpm|tar\.gz)($|\?)/i.test(download) ? "direct" : "page";
}
