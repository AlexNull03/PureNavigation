import type { ChatMessage, Evidence, Health, Software } from "@/types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await response.text();
  const data = text ? safeParse(text) : null;

  if (!response.ok) {
    const detail = data && typeof data.detail === "string" ? data.detail : `请求失败（${response.status}）`;
    throw new ApiError(response.status, detail);
  }
  if (!data) {
    throw new ApiError(response.status, "服务返回了无法解析的内容");
  }
  return data as T;
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function fetchHealth(): Promise<Health> {
  return request<Health>("/health");
}

export function fetchSoftware(query: string): Promise<{ items: Software[]; disclaimer: string }> {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request(`/software${suffix}`);
}

export function sendAdvise(messages: ChatMessage[]): Promise<{ reply: string; disclaimer: string }> {
  return request("/advise", { method: "POST", body: JSON.stringify({ messages }) });
}

export function runInspect(
  url: string,
  question: string
): Promise<{ reply: string; evidence: Evidence; disclaimer: string }> {
  return request("/inspect", { method: "POST", body: JSON.stringify({ url, question }) });
}
