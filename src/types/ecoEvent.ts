export interface EcoEvent {
  EventType: number;
  EventValue: number;
  Timestamp: string;
  Position: {
    Latitude: number;
    Longitude: number;
  };
  EventSeverity: number;
  Speed: number;
}
