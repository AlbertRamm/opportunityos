import "server-only";

export interface ZipInfo {
  state: string; // 2-letter
  lat: number; // rounded to 2 decimals (~1 km): coarse on purpose
  lng: number;
}

/**
 * Best-effort ZIP → centroid lookup via the free zippopotam.us API.
 * Returns null on any failure; callers must treat that as "unknown", never as an error.
 * Swap this function to change providers.
 */
export async function lookupZip(zip: string): Promise<ZipInfo | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { places?: { latitude: string; longitude: string; "state abbreviation": string }[] };
    const p = json.places?.[0];
    if (!p) return null;
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { state: p["state abbreviation"], lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
  } catch {
    return null;
  }
}
