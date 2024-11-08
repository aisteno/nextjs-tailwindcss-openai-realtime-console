export interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

export interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
  };
  current_units: {
    temperature_2m: string; // e.g. "°C"
    wind_speed_10m: string; // e.g. "km/h"
  };
}

/**
 * Type for all event logs
 */
export interface RealtimeEvent {
  time: string;
  source: "client" | "server";
  count?: number;
  event: Record<string, unknown>;
}
