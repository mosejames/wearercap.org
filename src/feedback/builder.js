export function newQuestion(type = "rating", n = 1) {
  return {
    id: crypto.randomUUID(),
    type,
    title: `Question ${n}`,
    help: "",
    required: type !== "text",
    ...(type === "choice" || type === "multi"
      ? {
          options: [
            { id: "one", label: "Option 1" },
            { id: "two", label: "Option 2" },
          ],
        }
      : {}),
    ...(type === "multi" ? { max: 2 } : {}),
    ...(type === "matrix"
      ? { items: [{ id: "one", label: "Experience 1" }] }
      : {}),
  };
}
export function newSurvey() {
  return {
    id: crypto.randomUUID(),
    slug: "",
    event_name: "",
    event_date: new Date().toISOString().slice(0, 10),
    title: "Help make the next one even better.",
    intro:
      "What felt good? What could be better? Your honest feedback, including criticism, helps us create better experiences for our RCA school community.",
    gallery_url: "/rcap-capsule/",
    voices_enabled: true,
    status: "draft",
    questions: [
      { ...newQuestion(), title: "How much did you enjoy the event?" },
      {
        ...newQuestion("text", 2),
        title: "What should we keep or change next time?",
      },
    ],
  };
}
export function surveyError(s) {
  if (
    typeof s.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug) ||
    s.slug === "admin" ||
    s.slug.length > 80
  )
    return "Choose a short link using lowercase letters, numbers and hyphens.";
  if (
    typeof s.event_name !== "string" ||
    typeof s.title !== "string" ||
    typeof s.intro !== "string" ||
    !s.event_name.trim() ||
    !s.title.trim() ||
    !s.intro.trim()
  )
    return "Add an event name, title and introduction.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s.event_date) ||
    !Number.isFinite(Date.parse(s.event_date))
  )
    return "Choose an event date.";
  if (s.event_name.length > 120 || s.title.length > 160 || s.intro.length > 800)
    return "Please shorten the event name, title or introduction.";
  if (new Set(s.questions?.map((q) => q.id)).size !== s.questions?.length)
    return "Each question needs a unique identifier.";
  if (
    !Array.isArray(s.questions) ||
    s.questions.length < 1 ||
    s.questions.length > 12
  )
    return "Use 1 to 12 questions.";
  for (const q of s.questions) {
    if (!["rating", "matrix", "choice", "multi", "text"].includes(q.type))
      return "Choose a supported answer style.";
    if (
      !q ||
      typeof q.title !== "string" ||
      !q.title.trim() ||
      q.title.length > 240 ||
      (q.help || "").length > 400
    )
      return "Give every question a title.";
    if (
      ["choice", "multi"].includes(q.type) &&
      (!Array.isArray(q.options) ||
        q.options.length < 2 ||
        q.options.length > 8 ||
        q.options.some(
          (o) =>
            typeof o?.label !== "string" ||
            !o.label.trim() ||
            o.label.length > 160,
        ) ||
        new Set(q.options.map((o) => o.id)).size !== q.options.length)
    )
      return "Choice questions need at least two named options.";
    if (
      q.type === "matrix" &&
      (!Array.isArray(q.items) ||
        !q.items.length ||
        q.items.length > 8 ||
        q.items.some(
          (i) =>
            typeof i?.label !== "string" ||
            !i.label.trim() ||
            i.label.length > 160,
        ) ||
        new Set(q.items.map((i) => i.id)).size !== q.items.length)
    )
      return "Name each rating item.";
    if (
      q.type === "multi" &&
      (!Number.isInteger(q.max) || q.max < 1 || q.max > q.options.length)
    )
      return "The selection limit must fit the number of options.";
  }
  return "";
}
export function chatPrompt(survey, brief, count) {
  return `Help me draft an anonymous RCAP event survey for the RCA school community. Return ONLY a JSON object, no markdown. Create exactly ${count} questions. Welcome honest criticism. Keep copy concise and warm. Do not ask for names, email, phone, identity, dues or fundraising. Do not use em dashes. Question types: rating (1=Not for me, 5=Loved it), matrix (1–5 plus N/A), choice, multi, text. Use unique short ids. For choice/multi include options:[{id,label}], 2 to 8 choices. Other must use id "other". For multi include max:2 (or an appropriate limit). For matrix include items:[{id,label}], 1 to 8 items. Every question needs id,type,title,help,required. Text responses should generally be optional. Include these top-level fields: slug (lowercase, hyphenated), event_name, event_date (YYYY-MM-DD), title, intro, questions. Maximum lengths: title 160, intro 800, question title 240, help 400, option label 160.\nEvent brief: ${brief}\nCurrent draft: ${JSON.stringify({ event_name: survey.event_name, event_date: survey.event_date, title: survey.title, intro: survey.intro, questions: survey.questions })}`;
}
export function importDraft(raw) {
  const parsed = JSON.parse(
    raw.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""),
  );
  if (!parsed || !Array.isArray(parsed.questions))
    throw new Error("Paste the JSON survey draft from ChatGPT.");
  const draft = {
    slug: String(parsed.slug || ""),
    event_name: String(parsed.event_name || ""),
    event_date: String(parsed.event_date || ""),
    title: String(parsed.title || ""),
    intro: String(parsed.intro || ""),
    questions: parsed.questions.map((q, i) => ({
      id: `q${i + 1}`,
      type: q.type,
      title: String(q.title || ""),
      help: String(q.help || ""),
      required: !!q.required,
      ...(q.type === "matrix" ? { items: q.items } : {}),
      ...(["multi", "choice"].includes(q.type) ? { options: q.options } : {}),
      ...(q.type === "multi" ? { max: q.max } : {}),
    })),
  };
  const error = surveyError(draft);
  if (error) throw new Error(error);
  return draft;
}
