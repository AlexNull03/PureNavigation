const URL_RE = /https?:\/\/[^\s，。、；）)】\]]+/i;
const BARE_RE = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+\b/i;
const TRAILING = /[.,;:!?、。，；：！？]+$/;

/** 从用户自由文本里取出第一个像域名的片段；取不到返回 null。 */
export function extractSite(text: string): string | null {
  const explicit = URL_RE.exec(text);
  if (explicit) {
    return explicit[0].replace(TRAILING, "");
  }
  const bare = BARE_RE.exec(text);
  if (!bare) {
    return null;
  }
  const candidate = bare[0].replace(TRAILING, "");
  const tld = candidate.split(".").pop() ?? "";
  return /^[a-z]{2,24}$/i.test(tld) ? candidate : null;
}
