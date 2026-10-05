import { COMMITTEES } from "../committee/data.js";

export const DEFAULT_PAYMENT_COMMITTEES = [
  ...COMMITTEES.map((item) => item.name),
  "General RCAP",
  "Other RCAP expense",
];

export function mergePaymentCommittees(names = []) {
  const known = new Set(DEFAULT_PAYMENT_COMMITTEES.map((name) => name.toLowerCase()));
  const added = names.filter((name) => typeof name === "string" && !known.has(name.toLowerCase()));
  return [...new Set(added)].sort((a, b) => a.localeCompare(b))
    .concat(DEFAULT_PAYMENT_COMMITTEES);
}
