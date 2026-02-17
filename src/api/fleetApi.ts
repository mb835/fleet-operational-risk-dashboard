const BASE_URL = "/api";

/* --------------------------------
   SHARED RESPONSE HANDLER
--------------------------------- */

async function handleResponse<T>(
  response: Response
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `API Error ${response.status}: ${response.statusText} - ${text}`
    );
  }

  return response.json() as Promise<T>;
}

/* --------------------------------
   FETCH GROUPS
--------------------------------- */

export async function fetchGroups(): Promise<any> {
  const response = await fetch(`${BASE_URL}/groups`);
  return handleResponse(response);
}

/* --------------------------------
   FETCH VEHICLES BY GROUP
--------------------------------- */

export async function fetchVehiclesByGroup(
  groupCode: string
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/vehicles/${groupCode}`
  );

  return handleResponse(response);
}
