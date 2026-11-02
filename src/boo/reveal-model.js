export const REVEAL_STATUS = {
  correct: "Correct",
  incorrect: "Incorrect",
  not_guessed: "Not guessed",
  own_child: "Your child or submission",
  unavailable: "Guess not completed",
};
export function ordinal(n) {
  const m = n % 100;
  return `${n}${m >= 11 && m <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
}
export function placementLabel(me) {
  if (!me?.eligible || !Number.isInteger(me.placement) || me.totalPlayers < 1)
    return "No ranked entry";
  return `${me.tiedPlayers > 1 ? "Tied for " : ""}${ordinal(me.placement)} of ${me.totalPlayers} players`;
}
export function entryLabel(entry) {
  const base = REVEAL_STATUS[entry.status] || REVEAL_STATUS.unavailable;
  return entry.status === "correct"
    ? `${base} · +${entry.points} ${entry.points === 1 ? "point" : "points"}`
    : base;
}
