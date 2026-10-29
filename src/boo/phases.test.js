import { describe, it, expect } from "vitest";
import { phaseAt, easternTime, countdown } from "./phases.js";
const schedule = {
  submissionsOpenAt: "2026-10-29T00:00:00-04:00",
  submissionsCloseAt: "2026-10-30T00:00:00-04:00",
  guessesOpenAt: "2026-10-30T12:00:00-04:00",
  guessesCloseAt: "2026-10-31T23:59:00-04:00",
  resultsAt: "2026-11-01T00:00:00-04:00",
};
describe("confirmed Eastern game phases", () => {
  it.each([
    ["2026-10-28T23:59:59.999-04:00", "soon"],
    ["2026-10-29T00:00:00-04:00", "submissions"],
    ["2026-10-29T23:59:59.999-04:00", "submissions"],
    ["2026-10-30T00:00:00-04:00", "waiting"],
    ["2026-10-30T11:59:59.999-04:00", "waiting"],
    ["2026-10-30T12:00:00-04:00", "guessing"],
    ["2026-10-31T23:58:59.999-04:00", "guessing"],
    ["2026-10-31T23:59:00-04:00", "closed"],
    ["2026-11-01T00:00:00-04:00", "results"],
    ["2026-11-01T01:30:00-05:00", "results"],
  ])("uses server-aligned instant %s for %s", (instant, expected) =>
    expect(phaseAt(schedule, Date.parse(instant))).toBe(expected),
  );
  it("fails closed on missing/invalid schedule", () => {
    expect(phaseAt(null, Date.now())).toBeNull();
    expect(
      phaseAt({ ...schedule, guessesOpenAt: "broken" }, Date.now()),
    ).toBeNull();
  });
  it("uses Eastern time independently of browser timezone and keeps countdown bounded", () => {
    expect(easternTime(schedule.guessesOpenAt)).toContain("Friday");
    expect(easternTime(schedule.guessesOpenAt)).toMatch(/noon|12:00/);
    expect(easternTime(schedule.guessesOpenAt)).toContain("Eastern");
    expect(
      countdown(
        schedule.guessesOpenAt,
        Date.parse("2026-10-30T11:59:59-04:00"),
      ),
    ).toBe("0h 0m 1s");
    expect(
      countdown(
        schedule.guessesOpenAt,
        Date.parse("2026-10-30T13:00:00-04:00"),
      ),
    ).toBe("0h 0m 0s");
  });
});
