export type Software = {
  name: string;
  homepage: string;
  download: string;
  description: string;
  domain: string;
  host: string;
};

export type FlagLevel = "ok" | "high" | "medium" | "low";

export type Flag = { level: FlagLevel; text: string };

export type WhoisFacts = {
  ok: boolean;
  queried_domain: string;
  server: string;
  registrar: string;
  created: string;
  updated: string;
  expires: string;
  country: string;
  status: string[];
  nameservers: string[];
  error: string;
};

export type CertFacts = {
  https: boolean;
  host: string;
  subject_cn: string;
  issuer_cn: string;
  issuer_org: string;
  not_before: string;
  not_after: string;
  days_left: number;
  valid_now: boolean;
  self_signed: boolean;
  trusted: boolean;
  san_dns: string[];
  san_covers_host: boolean;
  tls_version: string;
  chain: string[];
  chain_complete: boolean;
  error: string;
};

export type Evidence = {
  origin: string;
  host: string;
  registrable: string;
  tld: string;
  addresses: string[];
  whois: WhoisFacts;
  cert: CertFacts;
  official: { name: string; domain: string } | null;
  suspect_brand: { name: string; similarity: number } | null;
  flags: Flag[];
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type Health = { status: string; items: number; llm_configured: boolean };
