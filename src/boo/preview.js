// Fictional rehearsal data only. This module never calls a production API.
export const PREVIEW_SCHEDULE = {
  phase: "guessing",
  serverNow: "2026-10-30T13:00:00-04:00",
  timezone: "America/New_York",
  submissionsOpenAt: "2026-10-29T00:00:00-04:00",
  submissionsCloseAt: "2026-10-30T11:59:00-04:00",
  guessesOpenAt: "2026-10-30T12:00:00-04:00",
  guessesCloseAt: "2026-10-31T23:59:00-04:00",
  resultsAt: "2026-11-01T00:00:00-04:00",
  resultsOn: "2026-11-01",
  submittedStudents: 12,
  resultsPublished: false,
  tieRule: "drawing",
};
export const PRACTICE_NAMES = [
  "Fable Finch",
  "Milo Moon",
  "Piper Pumpkin",
  "Rowan Rocket",
  "Clover Cloud",
  "Juno Jellybean",
  "Wren Willow",
  "Nova Night",
  "Sunny Star",
  "Indigo Ice",
  "Robin Rain",
  "Your Fictional Boo",
];
const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function createPreview(userId, storage = null) {
  const key = "rcap-boo-organizer-preview-v1:" + userId;
  let state = {
    plays: {},
    removed: [],
    profile: { display: "Practice Player", house: "Amistad", grade: "5th" },
  };
  try {
    const saved = JSON.parse(storage?.getItem(key) || "null");
    if (saved?.plays && Array.isArray(saved.removed) && saved.profile)
      state = saved;
  } catch {}
  const save = () => {
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch {}
  };
  const records = PRACTICE_NAMES.map((name, i) => ({
    id: "preview-" + (i + 1),
    name,
    house: ["Amistad", "Altruismo", "Isibindi", "Reveur"][i % 4],
    grade: ["5th", "6th", "7th", "8th"][i % 4],
    own: i === 11,
    firstAlready: i === 1,
  }));
  const getPhoto = (id) => {
    const p = records.find((x) => x.id === id && !state.removed.includes(id));
    if (!p) throw Error("This practice card is unavailable.");
    return p;
  };
  const choices = (p) => [
    p.name,
    ...records
      .filter((x) => x.id !== p.id)
      .slice(0, 3)
      .map((x) => x.name),
  ];
  const scores = () => {
    const plays = Object.values(state.plays),
      guessPoints = plays.reduce((sum, p) => sum + (p.points || 0), 0),
      uploadPoints = state.removed.includes("preview-12") ? 0 : 3;
    const me = {
      id: userId,
      ...state.profile,
      points: guessPoints + uploadPoints,
      guessPoints,
      uploadPoints,
      identified: plays.filter((p) => p.points > 0).length,
      contributions: uploadPoints ? 1 : 0,
    };
    return {
      individual: [me],
      house: [
        { label: me.house, points: me.points, guessPoints, uploadPoints },
      ],
      grade: [
        { label: me.grade, points: me.points, guessPoints, uploadPoints },
      ],
    };
  };
  const request = async (action, b = {}) => {
    if (action === "get")
      return {
        userId,
        me: { ...state.profile },
        isAdmin: false,
        settings: {
          closesAt: PREVIEW_SCHEDULE.guessesCloseAt,
          timezone: "America/New_York",
          tieRule: "drawing",
        },
        phase: PREVIEW_SCHEDULE,
        distinctChildren: 12,
        photos:
          b.mode === "adults"
            ? []
            : records
                .filter((p) => !state.removed.includes(p.id))
                .map((p) => {
                  const play = state.plays[p.id] || {};
                  return {
                    id: p.id,
                    caption: "Fictional practice card",
                    house: p.house,
                    grade: p.grade,
                    own: p.own,
                    canRemove: p.own,
                    correct: (play.points || 0) > 0,
                    points: play.points || 0,
                    hinted: !!play.hinted,
                    submitted: !!play.submitted,
                    choices: play.hinted ? choices(p) : null,
                  };
                }),
        board:
          b.mode === "adults"
            ? { individual: [], house: [], grade: [] }
            : scores(),
        notifications: [],
        awards: null,
      };
    if (action === "profile") {
      state.profile = {
        display: String(b.display || state.profile.display),
        house: b.house || state.profile.house,
        grade: b.grade || state.profile.grade,
      };
      save();
      return { ok: true };
    }
    if (!["media", "hint", "guess", "report", "remove"].includes(action))
      throw Error("This organizer rehearsal cannot change the real game.");
    const p = getPhoto(b.id);
    if (action === "media") {
      const color = ["#315475", "#634c72", "#315d55", "#6d4d38"][
        records.indexOf(p) % 4
      ];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/><circle cx="200" cy="170" r="70" fill="#f0c36d"/><path d="M100 145L200 25L300 145Z" fill="#101c35"/><path d="M110 420L135 235Q200 265 265 235L290 420Z" fill="#e6e8eb"/><circle cx="178" cy="166" r="6" fill="#101c35"/><circle cx="222" cy="166" r="6" fill="#101c35"/><path d="M180 200Q200 214 220 200" fill="none" stroke="#101c35" stroke-width="5"/><text x="200" y="465" fill="#ffdc7c" text-anchor="middle" font-family="Arial" font-size="21">FICTIONAL MYSTERY ${records.indexOf(p) + 1}</text></svg>`;
      return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    }
    if (action === "report") return { ok: true };
    if (action === "remove") {
      if (!p.own) throw Error("Only your fictional submission can be removed.");
      state.removed.push(p.id);
      save();
      return { ok: true };
    }
    if (p.own) throw Error("No guessing points on your own submission.");
    const play = state.plays[p.id] || {};
    if (play.submitted)
      throw Error(
        "You already committed your one practice guess for this photo.",
      );
    if (action === "hint") {
      play.hinted = true;
      state.plays[p.id] = play;
      save();
      return { choices: choices(p) };
    }
    if (!normalize(b.guess)) throw Error("Type a name before locking it in.");
    const correct = [
      normalize(p.name),
      normalize(p.name.split(" ")[0]),
    ].includes(normalize(b.guess));
    play.submitted = true;
    play.points = correct ? (play.hinted ? 1 : p.firstAlready ? 3 : 5) : 0;
    state.plays[p.id] = play;
    save();
    return { correct, points: play.points };
  };
  return {
    request,
    schedule: PREVIEW_SCHEDULE,
    reset() {
      try {
        storage?.removeItem(key);
      } catch {}
    },
  };
}
