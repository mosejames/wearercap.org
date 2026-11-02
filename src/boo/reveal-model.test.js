import { it, expect } from "vitest";
import { placementLabel, entryLabel, ordinal } from "./reveal-model.js";
it("uses real eligible participant denominator and competition ties", () => {
  expect(
    placementLabel({
      eligible: true,
      placement: 3,
      totalPlayers: 47,
      tiedPlayers: 2,
    }),
  ).toBe("Tied for 3rd of 47 players");
  expect(
    placementLabel({
      eligible: true,
      placement: 1,
      totalPlayers: 52,
      tiedPlayers: 1,
    }),
  ).toBe("1st of 52 players");
  expect(placementLabel({ eligible: false })).toBe("No ranked entry");
  expect([11, 12, 13, 21].map(ordinal)).toEqual([
    "11th",
    "12th",
    "13th",
    "21st",
  ]);
});
it("does not call own-child, unguessed or unfinished attempts incorrect", () => {
  expect(entryLabel({ status: "correct", points: 3 })).toBe(
    "Correct · +3 points",
  );
  expect(entryLabel({ status: "own_child" })).toBe("Your child or submission");
  expect(entryLabel({ status: "not_guessed" })).toBe("Not guessed");
  expect(entryLabel({ status: "unavailable" })).toBe("Guess not completed");
});
