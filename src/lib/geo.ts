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

/** Best-effort ZIP → coordinates for an opportunity row when the admin didn't type them. */
export async function fillCoordinates(row: Record<string, unknown>): Promise<void> {
  const zip = row.location_zip as string | null;
  if (zip && (row.location_lat === null || row.location_lat === undefined || row.location_lng === null || row.location_lng === undefined)) {
    const geo = await lookupZip(zip);
    if (geo) {
      row.location_lat = geo.lat;
      row.location_lng = geo.lng;
    }
  }
}
