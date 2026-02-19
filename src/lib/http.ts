import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";

export async function httpGet(url: string, headers: Record<string, string> = {}) {
  if (Capacitor.isNativePlatform()) {
    return CapacitorHttp.request({ method: "GET", url, headers });
  }

  const res = await fetch(url, { headers });
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, headers: {} as any };
}

export async function httpPost(url: string, body: any, headers: Record<string, string> = {}) {
  if (Capacitor.isNativePlatform()) {
    return CapacitorHttp.request({
      method: "POST",
      url,
      headers: { "Content-Type": "application/json", ...headers },
      data: body,
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, headers: {} as any };
}
