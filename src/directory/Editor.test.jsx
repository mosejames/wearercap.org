import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { emptyListing } from "./model.js";
const api = vi.hoisted(() => ({
  saveBusiness: vi.fn(),
  removePhotos: vi.fn(),
  uploadPhoto: vi.fn(),
  uploadVideo: vi.fn(),
}));
vi.mock("./api.js", () => ({
  ...api,
  photoUrl: async (path) => `https://example.com/${path}`,
  supabase: {},
  listBusinesses: vi.fn(),
}));
import { Editor } from "./App.jsx";
let root, host;
const initial = {
  ...emptyListing(),
  id: "listing",
  name: "Family Books",
  bio: "Stories for young readers",
  website: "https://example.com",
  published: true,
  photos: ["owner/listing/cover.jpg"],
};
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
  api.saveBusiness.mockImplementation(async (listing) => listing);
  api.removePhotos.mockResolvedValue();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render() {
  const saved = vi.fn(),
    error = vi.fn();
  await act(async () =>
    root.render(
      <Editor
        initial={initial}
        user={{ id: "owner" }}
        onSaved={saved}
        onError={error}
      />,
    ),
  );
  return { saved, error };
}
function button(text) {
  return [...host.querySelectorAll("button")].find(
    (el) => el.textContent === text,
  );
}
describe("listing management", () => {
  it("unpublishes while keeping the listing and images available to its owner", async () => {
    const { saved } = await render();
    await act(async () => button("Save as draft").click());
    expect(api.saveBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "listing",
        published: false,
        photos: initial.photos,
      }),
      { id: "owner" },
    );
    expect(saved).toHaveBeenCalled();
  });
  it("removes replaced images only after the new listing saves", async () => {
    await render();
    await act(async () => button("Remove").click());
    expect(api.removePhotos).not.toHaveBeenCalled();
    await act(async () => button("Save as draft").click());
    expect(api.saveBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [] }),
      { id: "owner" },
    );
    expect(api.removePhotos).toHaveBeenCalledWith(initial.photos);
    expect(api.saveBusiness.mock.invocationCallOrder[0]).toBeLessThan(
      api.removePhotos.mock.invocationCallOrder[0],
    );
  });
  it("preserves existing photos and form state when saving fails", async () => {
    const { saved, error } = await render();
    api.saveBusiness.mockRejectedValueOnce(new Error("Connection interrupted"));
    await act(async () => button("Remove").click());
    await act(async () => button("Save as draft").click());
    expect(saved).not.toHaveBeenCalled();
    expect(error).toHaveBeenLastCalledWith("Connection interrupted");
    expect(api.removePhotos).not.toHaveBeenCalled();
    expect(host.querySelector("input").value).toBe("Family Books");
  });
  it("rejects publication when public sharing permission is unchecked", async () => {
    const { saved, error } = await render();
    await act(async () =>
      host.querySelector('input[aria-label="Permission to publish"]').click(),
    );
    await act(async () =>
      host
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(api.saveBusiness).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(error).toHaveBeenLastCalledWith(
      "Confirm that you have permission to share this listing.",
    );
  });
});

it("saves owner-selected house and community opportunities with the listing", async () => {
  await render();
  const select = [...host.querySelectorAll("select")].find((el) =>
    el.parentElement.textContent.startsWith("House"),
  );
  await act(async () => {
    select.value = "isibindi";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const mentor = [...host.querySelectorAll("input[type=checkbox]")].find((el) =>
    el.parentElement.textContent.includes("Student mentorship"),
  );
  await act(async () => mentor.click());
  await act(async () => button("Save as draft").click());
  expect(api.saveBusiness).toHaveBeenCalledWith(
    expect.objectContaining({ house: "isibindi", offers: ["mentor"] }),
    { id: "owner" },
  );
});
it("starts a student listing with the parent-management guidance visible", async () => {
  await act(async () =>
    root.render(
      <Editor
        user={{ id: "owner" }}
        defaultVenture="student"
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    ),
  );
  expect(host.textContent).toContain(
    "A parent or guardian manages this listing",
  );
  expect(
    [...host.querySelectorAll("select")].find((el) =>
      el.parentElement.textContent.includes("Who runs"),
    ).value,
  ).toBe("student");
});

it("removes a listing video only after saving the updated listing", async () => {
 const saved=vi.fn();
 await act(async()=>root.render(<Editor initial={{...initial,video:"owner/listing/demo.mp4"}} user={{id:"owner"}} onSaved={saved} onError={vi.fn()}/>));
 await act(async()=>button("Remove video").click());
 expect(api.removePhotos).not.toHaveBeenCalled();
 await act(async()=>button("Save as draft").click());
 expect(api.saveBusiness).toHaveBeenCalledWith(expect.objectContaining({video:""}),{id:"owner"});
 expect(api.removePhotos).toHaveBeenCalledWith(["owner/listing/demo.mp4"]);
});
