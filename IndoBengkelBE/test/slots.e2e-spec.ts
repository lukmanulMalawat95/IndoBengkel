import { resolveSlot, slotStartInZone } from "../src/common/slots";

describe("Slot math", () => {
  it("resolves late evening wall-clock slots on the requested Jakarta date", () => {
    const start = slotStartInZone("2026-10-28", 22, "Asia/Jakarta");
    expect(start.toISOString()).toBe("2026-10-28T15:00:00.000Z");

    const resolved = resolveSlot(
      {
        hours: [{ dayOfWeek: 3, openTime: "00:00", closeTime: "24:00", isClosed: false }],
        closures: [],
        timezone: "Asia/Jakarta",
      },
      start,
    );

    expect(resolved).toEqual({
      slot: {
        dateKey: "2026-10-28",
        hour: 22,
        start,
        end: new Date("2026-10-28T16:00:00.000Z"),
      },
    });
  });
});
