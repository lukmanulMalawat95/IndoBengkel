export const COURIERS = [
  {
    id: "jne",
    name: "JNE",
    service: "REG",
    base: 18_000,
    includedKg: 1,
    perKg: 6_000,
    kind: "expedition",
  },
  {
    id: "jnt",
    name: "J&T Express",
    service: "EZ",
    base: 17_000,
    includedKg: 1,
    perKg: 6_000,
    kind: "expedition",
  },
  {
    id: "sicepat",
    name: "SiCepat",
    service: "REG",
    base: 16_000,
    includedKg: 1,
    perKg: 6_000,
    kind: "expedition",
  },
  {
    id: "anteraja",
    name: "AnterAja",
    service: "REG",
    base: 15_000,
    includedKg: 1,
    perKg: 6_000,
    kind: "expedition",
  },
  {
    id: "gosend",
    name: "GoSend",
    service: "Instant",
    base: 25_000,
    includedKg: 5,
    perKg: 5_000,
    kind: "instant",
  },
] as const;

export type CourierId = (typeof COURIERS)[number]["id"];
export type CourierKind = (typeof COURIERS)[number]["kind"];

export function courierById(id: string) {
  return COURIERS.find((courier) => courier.id === id) ?? COURIERS[0];
}

export function courierName(id: string) {
  const courier = courierById(id);
  return `${courier.name} ${courier.service}`;
}

export const INSTANT_COURIERS = COURIERS.filter((courier) => courier.kind === "instant");
export const EXPEDITION_COURIERS = COURIERS.filter((courier) => courier.kind === "expedition");

export function shippingCostFor(courierId: string, weightGrams: number) {
  const courier = courierById(courierId);
  const kg = Math.max(1, Math.ceil(weightGrams / 1000));
  const extraKg = Math.max(0, kg - courier.includedKg);
  return courier.base + extraKg * courier.perKg;
}

export function totalWeight(rows: { weightGrams: number; qty: number }[]) {
  return rows.reduce((sum, row) => sum + row.weightGrams * row.qty, 0);
}
