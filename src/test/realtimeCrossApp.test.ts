import { describe, expect, it } from "vitest";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";
type RealtimeConfig = {
  event: RealtimeEvent;
  schema: "public";
  table: string;
  filter?: string;
};
type RealtimePayload = {
  eventType: RealtimeEvent;
  schema: "public";
  table: string;
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
};

class RealtimeBus {
  private subscriptions: Array<{
    channel: string;
    config: RealtimeConfig;
    callback: (payload: RealtimePayload) => void;
  }> = [];

  channel(name: string) {
    return {
      on: (_type: "postgres_changes", config: RealtimeConfig, callback: (payload: RealtimePayload) => void) => {
        this.subscriptions.push({ channel: name, config, callback });
        return this.channel(name);
      },
      subscribe: () => ({ name }),
    };
  }

  emit(payload: RealtimePayload) {
    this.subscriptions
      .filter(({ config }) => this.matches(config, payload))
      .forEach(({ callback }) => callback(payload));
  }

  private matches(config: RealtimeConfig, payload: RealtimePayload) {
    if (config.schema !== payload.schema || config.table !== payload.table) return false;
    if (config.event !== "*" && config.event !== payload.eventType) return false;
    if (!config.filter) return true;

    const [field, expression] = config.filter.split("=");
    const [operator, expected] = expression?.split(".") ?? [];
    if (operator !== "eq" || !expected) return false;
    const row = payload.new ?? payload.old ?? {};
    return String(row[field]) === expected;
  }
}

describe("realtime cruzado de corridas", () => {
  it("notifica passageiro, motorista e admin em criação, aceite e cancelamento", () => {
    const bus = new RealtimeBus();
    const passengerId = "passenger-1";
    const driverId = "driver-1";
    const rideId = "ride-1";
    const offerId = "offer-1";
    const passengerStates: string[] = [];
    const driverStates: string[] = [];
    const adminStates: string[] = [];

    bus
      .channel("passenger-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `passenger_id=eq.${passengerId}` }, ({ new: ride }) => {
        passengerStates.push(String(ride?.status));
      })
      .subscribe();

    bus
      .channel("driver-offers")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_offers", filter: `driver_id=eq.${driverId}` }, ({ new: offer }) => {
        driverStates.push(`offer:${offer?.status}`);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${driverId}` }, ({ new: ride }) => {
        driverStates.push(String(ride?.status));
      })
      .subscribe();

    bus
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, ({ eventType, new: ride }) => {
        adminStates.push(`${eventType}:${ride?.status}`);
      })
      .subscribe();

    bus.emit({
      eventType: "INSERT",
      schema: "public",
      table: "rides",
      new: { id: rideId, passenger_id: passengerId, driver_id: null, status: "requested" },
    });

    bus.emit({
      eventType: "INSERT",
      schema: "public",
      table: "ride_offers",
      new: { id: offerId, ride_id: rideId, driver_id: driverId, status: "pending" },
    });

    bus.emit({
      eventType: "UPDATE",
      schema: "public",
      table: "rides",
      old: { id: rideId, passenger_id: passengerId, driver_id: null, status: "requested" },
      new: { id: rideId, passenger_id: passengerId, driver_id: driverId, status: "accepted" },
    });

    bus.emit({
      eventType: "UPDATE",
      schema: "public",
      table: "rides",
      old: { id: rideId, passenger_id: passengerId, driver_id: driverId, status: "accepted" },
      new: { id: rideId, passenger_id: passengerId, driver_id: driverId, status: "cancelled" },
    });

    expect(passengerStates).toEqual(["accepted", "cancelled"]);
    expect(driverStates).toEqual(["offer:pending", "accepted", "cancelled"]);
    expect(adminStates).toEqual(["INSERT:requested", "UPDATE:accepted", "UPDATE:cancelled"]);
  });
});