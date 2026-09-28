import React, { useState } from "react";
import { distribution, toCsv } from "./model.js";
import { voiceUrl } from "./api.js";
function Ratings({ values }) {
  const d = distribution(values);
  return (
    <>
      <p>
        <strong>{d.average ?? "No ratings"}</strong>
        {d.average && " / 5"} · {d.count} rated · {d.na} didn’t try / N/A
      </p>
      {d.bins.map((n, i) => (
        <div className="bar" key={i}>
          <span>{i + 1}</span>
          <meter min={0} max={Math.max(1, d.count)} value={n} />
          <span>{n}</span>
        </div>
      ))}
    </>
  );
}
export default function Results({ data, auth, run }) {
  const { survey, rows, voices, insights } = data;
  const [urls, setUrls] = useState({}),
    [note, setNote] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([toCsv(survey, rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.slug}-feedback.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section>
      <h2>{survey.event_name}</h2>
      <div className="stats">
        <span>
          <strong>{rows.length}</strong> responses
        </span>
        <span>
          <strong>{voices.length}</strong> voice notes visible
        </span>
      </div>
      <p className="muted">
        Completion rate: not tracked. We do not record visits or abandoned
        answers.
      </p>
      <button onClick={download}>Export responses as CSV</button>
      {survey.questions.map((q) => (
        <section className="result-question" key={q.id}>
          <h3>{q.title}</h3>
          {q.type === "rating" ? (
            <Ratings values={rows.map((r) => r.answers[q.id])} />
          ) : q.type === "matrix" ? (
            q.items.map((i) => (
              <div key={i.id}>
                <h4>{i.label}</h4>
                <Ratings values={rows.map((r) => r.answers[q.id]?.[i.id])} />
              </div>
            ))
          ) : q.type === "text" ? (
            rows
              .filter((r) => r.answers[q.id])
              .map((r) => <blockquote key={r.id}>{r.answers[q.id]}</blockquote>)
          ) : (
            <>
              {q.options.map((o) => (
                <p key={o.id}>
                  {o.label}:{" "}
                  <strong>
                    {
                      rows.filter((r) =>
                        q.type === "multi"
                          ? r.answers[q.id]?.choices?.includes(o.id)
                          : r.answers[q.id] === o.id,
                      ).length
                    }
                  </strong>
                </p>
              ))}
              {q.type === "multi" &&
                rows
                  .filter((r) => r.answers[q.id]?.other)
                  .map((r) => (
                    <blockquote key={r.id}>
                      Other: {r.answers[q.id].other}
                    </blockquote>
                  ))}
            </>
          )}
        </section>
      ))}
      <section className="result-question">
        <h3>Voices of RCAP</h3>
        <p>
          {voices.filter((v) => v.permission === "private").length} private ·{" "}
          {voices.filter((v) => v.permission === "community").length} community
          sharing allowed
        </p>
        {!data.leadership && (
          <p>Private recordings are only visible to leadership.</p>
        )}
        {voices.map((v) => (
          <div className="voice-row" key={v.id}>
            <strong>
              {v.permission === "private"
                ? "Private · leadership only"
                : "Community sharing allowed"}
            </strong>
            <p>
              {Math.round(v.duration)} seconds ·{" "}
              {new Date(v.created_at).toLocaleDateString()}
            </p>
            {urls[v.id] ? (
              <audio controls src={urls[v.id]} />
            ) : (
              <button
                onClick={() =>
                  run(async () => {
                    const url = await voiceUrl(v.id, auth.pass || auth.token);
                    setUrls({ ...urls, [v.id]: url });
                  })
                }
              >
                Listen
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="result-question">
        <h3>Insights & next steps</h3>
        <p>Organizer notes stay separate from parent responses.</p>
        {insights.map((i) => (
          <blockquote key={i.id}>{i.body}</blockquote>
        ))}
        <label>
          Add an insight
          <textarea
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          disabled={!note.trim()}
          onClick={() =>
            run(async (api) => {
              await api("insight", { survey: survey.id, body: note });
              setNote("");
            })
          }
        >
          Save insight
        </button>
      </section>
    </section>
  );
}
