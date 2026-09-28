export const ratingLabels = [
  "Not for me",
  "A little",
  "It was okay",
  "Really enjoyed it",
  "Loved it",
];
export function validateQuestion(q, value) {
  if (!q.required && (value == null || value === "")) return true;
  if (q.type === "text")
    return (
      typeof value === "string" &&
      value.length <= 2000 &&
      (!q.required || value.trim().length > 0)
    );
  if (q.type === "rating")
    return Number.isInteger(value) && value >= 1 && value <= 5;
  if (q.type === "matrix")
    return (
      value &&
      q.items.every(
        (i) =>
          value[i.id] === "na" ||
          (Number.isInteger(value[i.id]) &&
            value[i.id] >= 1 &&
            value[i.id] <= 5),
      )
    );
  if (q.type === "choice") return q.options.some((o) => o.id === value);
  if (q.type === "multi")
    return (
      Array.isArray(value?.choices) &&
      value.choices.length >= 1 &&
      value.choices.length <= q.max &&
      new Set(value.choices).size === value.choices.length &&
      value.choices.every((v) => q.options.some((o) => o.id === v)) &&
      (!value.choices.includes("other") ||
        (typeof value.other === "string" &&
          value.other.trim().length > 0 &&
          value.other.length <= 160))
    );
  return false;
}
export function distribution(values) {
  const ratings = values.filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);
  return {
    count: ratings.length,
    average: ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
      : null,
    bins: [1, 2, 3, 4, 5].map((n) => ratings.filter((v) => v === n).length),
    na: values.filter((v) => v === "na").length,
  };
}
const cell = (v) =>
  '"' +
  String(v ?? "")
    .replace(/^[\s]*[=+@-]/, (m) => "'" + m)
    .replaceAll('"', '""') +
  '"';
export function toCsv(survey, rows) {
  return (
    "\ufeff" +
    [
      [
        "Response ID",
        "Survey",
        "Submitted",
        ...survey.questions.map((q) => q.title),
      ],
      ...rows.map((r) => [
        r.id,
        survey.slug,
        r.created_at,
        ...survey.questions.map((q) =>
          typeof r.answers[q.id] === "object"
            ? JSON.stringify(r.answers[q.id])
            : r.answers[q.id],
        ),
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
