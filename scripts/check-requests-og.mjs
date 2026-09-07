import { ImageResponse } from "@vercel/og";
import React from "react";
import { writeFile } from "node:fs/promises";
const h = React.createElement;
const image = new ImageResponse(
  h(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#173542",
        color: "#fff",
        padding: "64px",
        flexDirection: "column",
        justifyContent: "space-between",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 20 } },
      h(
        "div",
        { style: { fontSize: 36, fontWeight: 700, color: "#f1ce7b" } },
        "RCAP",
      ),
      h(
        "div",
        { style: { fontSize: 21, letterSpacing: 2 } },
        "RON CLARK ACADEMY PARENTS",
      ),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 20 } },
      h(
        "div",
        { style: { fontSize: 82, fontWeight: 700, letterSpacing: -3 } },
        "Check requests.",
      ),
      h(
        "div",
        { style: { fontSize: 34, color: "#d7e5eb", maxWidth: 920 } },
        "Receipts, approvals, and reimbursements. Together in one place.",
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #496671",
          paddingTop: 28,
        },
      },
      h(
        "div",
        { style: { fontSize: 23, color: "#f1ce7b" } },
        "Submit  /  Track  /  Download",
      ),
      h("div", { style: { fontSize: 23 } }, "wearercap.org"),
    ),
  ),
  { width: 1200, height: 630 },
);
await writeFile(
  "public/check-requests-og.png",
  Buffer.from(await image.arrayBuffer()),
);
