import { describe, it, expect } from "vitest";
import questions from "./karaoke.json";
import { validateQuestion, distribution, toCsv } from "./model.js";
import { importDraft, newSurvey, surveyError } from "./builder.js";
describe("anonymous feedback validation", () => {
  it("keeps eight karaoke questions with optional communication additions", () => {
    expect(questions).toHaveLength(8);
    expect(questions.map((q) => q.required)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
  it("requires an explicit overall rating", () => {
    for (const v of [undefined, null, 0, 6, 2.5, "5"])
      expect(validateQuestion(questions[0], v)).toBeFalsy();
    expect(validateQuestion(questions[0], 1)).toBe(true);
  });
  it("requires every compact rating and accepts N/A", () => {
    const v = { food: 1, dj: 2, karaoke: 3, dancing: 4, atmosphere: "na" };
    expect(validateQuestion(questions[1], v)).toBe(true);
    delete v.atmosphere;
    expect(validateQuestion(questions[1], v)).toBe(false);
  });
  it("validates connection and practical improvement choices", () => {
    expect(validateQuestion(questions[2], "somewhat")).toBe(true);
    expect(validateQuestion(questions[3], "time")).toBe(true);
    expect(validateQuestion(questions[3], "whatever")).toBe(false);
  });
  it("limits future choices to two unique options and asks for Other text", () => {
    const q = questions[4];
    for (const value of [
      { choices: [] },
      { choices: ["music", "music"] },
      { choices: ["music", "games", "dinner"] },
      { choices: ["unknown"] },
      { choices: ["other"], other: "  " },
    ])
      expect(validateQuestion(q, value)).toBe(false);
    expect(
      validateQuestion(q, { choices: ["other", "music"], other: "Museum" }),
    ).toBe(true);
  });
  it("permits an empty optional response but caps text length", () => {
    expect(validateQuestion(questions[7], undefined)).toBe(true);
    expect(validateQuestion(questions[7], "")).toBe(true);
    expect(validateQuestion(questions[7], "x".repeat(2001))).toBe(false);
    expect(validateQuestion({ ...questions[7], required: true }, "  ")).toBe(
      false,
    );
  });
  it("excludes N/A from averages without hiding its count", () => {
    expect(distribution([5, 1, "na", undefined])).toEqual({
      count: 2,
      average: "3.00",
      bins: [1, 0, 0, 0, 1],
      na: 1,
    });
  });
  it("escapes CSV formulas and quotes while preserving question columns", () => {
    const csv = toCsv(
      { slug: "test", questions: [{ id: "text", title: "Keep/change" }] },
      [
        {
          id: "id",
          created_at: "now",
          answers: { text: ' =HYPERLINK("bad")' },
        },
      ],
    );
    expect(csv).toContain("' =HYPERLINK");
    expect(csv).toContain('""bad""');
    expect(csv).toContain("Keep/change");
  });
  it("rejects malformed imported questions and retains only supported fields", () => {
    expect(() => importDraft("{}")).toThrow();
    const s = { ...newSurvey(), slug: "test", event_name: "Test" };
    expect(surveyError(s)).toBe("");
    expect(
      importDraft(JSON.stringify({ ...s, tracking: "bad" })).tracking,
    ).toBeUndefined();
    expect(() =>
      importDraft(
        JSON.stringify({
          ...s,
          questions: [{ type: "choice", title: "Broken" }],
        }),
      ),
    ).toThrow();
  });
});
