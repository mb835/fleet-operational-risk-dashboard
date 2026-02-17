export type VehicleType = "car" | "van" | "truck";

export function getVehicleType(vehicleName: string): VehicleType {
  const name = vehicleName.toLowerCase();

  // Truck detection
  if (
    name.includes("man") ||
    name.includes("truck") ||
    name.includes("daf") ||
    name.includes("scania") ||
    name.includes("volvo fh")
  ) {
    return "truck";
  }

  // Van detection
  if (
    name.includes("transit") ||
    name.includes("sprinter") ||
    name.includes("daily")
  ) {
    return "van";
  }

  // Default to car
  return "car";
}

export function getVehicleTypeCzech(vehicleName: string): string {
  const name = vehicleName.toLowerCase();

  // Kamion detection
  if (
    name.includes("man") ||
    name.includes("daf") ||
    name.includes("scania") ||
    name.includes("volvo fh") ||
    name.includes("truck")
  ) {
    return "kamion";
  }

  // Dodávka detection
  if (
    name.includes("transit") ||
    name.includes("sprinter") ||
    name.includes("daily")
  ) {
    return "dodávka";
  }

  // Default to osobní
  return "osobní";
}
