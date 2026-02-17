import type { EcoEvent } from "../types/ecoEvent";

/* --------------------------------
   FETCH ECO DRIVING EVENTS
   (via backend proxy)
--------------------------------- */

export async function fetchEcoEvents(
  vehicleCode: string
): Promise<EcoEvent[]> {
  try {
    const response = await fetch(
      `http://localhost:3001/api/vehicle/${vehicleCode}/eco`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data as EcoEvent[];
  } catch {
    return [];
  }
}
