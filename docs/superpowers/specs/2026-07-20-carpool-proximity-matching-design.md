# Carpool Proximity Matching + Suggested Crews — Design

Date: 2026-07-20
Status: Approved in chat by Mose, pending spec review

## Origin

Mose, looking at the app: "Steve and Latasha are in the group and Latasha lives
hella far from me." Diagnosis, confirmed against the code: "Families near you"
is a flat directory. `rankNearby` (directory.js) sorts every approved family by
distance and slices to the top 20, with NO radius cutoff, and the map plots all
of them. So a parent sees up to 20 families regardless of how far, and nothing
suggests who actually belongs together. The expected model, "there are a couple
families near you" and "this is the College Park crew, that is the Conyers
crew," was never built. This spec builds it.

Membership itself is already correct and stays untouched: a group is joined by
request plus organizer accept (0005). Nothing here auto-adds anyone to a group.
This is about DISCOVERY, the near-you list and the crew SUGGESTIONS, not about
who is in a group.

## Not machine learning

Plain geography. Two fixed facts make it work and we have both: Ron Clark
Academy is a single hard-coded location (228 Margaret St SE, Atlanta, GA 30315),
and families already carry a ZIP-centroid (`area_lat`/`area_lng`). Everything
below is haversine distance and a threshold. No model, no training.

## The radius, three layers (Mose's design)

1. **Adaptive smart default.** A family with no personal radius set gets a tight
   base of **3 miles**. But before showing an empty list, the effective radius
   widens until it catches at least **3 other families**, capped at the metro
   limit below. Dense areas stay tight at 3; a rural family is not stranded
   staring at "nobody found". Nobody has to think about it in the common case.
2. **Personal override.** In the family's own settings, a slider "show me
   families within N miles" (range 1 to the metro cap). When set, it replaces
   the adaptive default for that family. This is the "their own little admin".
3. **Metro cap for privacy.** A hard outer bound of **25 miles** that no radius,
   adaptive or personal, exceeds. Beyond this the app never surfaces a family,
   so cranking the slider to max still cannot reach a genuinely far family.

## Data change — migration 0009

One nullable column on `families`:
```sql
alter table public.families
  add column if not exists radius_miles double precision
  check (radius_miles is null or (radius_miles >= 1 and radius_miles <= 25));
```
- `null` means "use the adaptive default". A real number is the personal
  override. The check keeps it inside [1, 25]; the metro cap is enforced both
  here and in the read.
- Writable by the family on their own row only. 0002's family UPDATE policy
  already scopes writes to `user_id = auth.uid()`; confirm `radius_miles` is not
  blocked by any column grant (families has no column-narrowed grant like
  members does, so the existing row policy covers it). No new RLS.

## Reads — replace the flat directory with a radius-scoped RPC

`family_directory()` today returns every approved family (already subject-gated
by 0007/0008). It gains a distance filter. New/changed:

- **`nearby_families()`** (new RPC, or `family_directory` extended): returns the
  caller's nearby families WITH `distance_miles` and `distance_to_school_miles`,
  already filtered to the caller's EFFECTIVE radius, ordered nearest first. The
  effective radius is computed in-RPC:
  - personal `radius_miles` if the caller set one, else
  - the adaptive value: start 3, widen (e.g. step to the distance of the 3rd
    nearest family) until >= 3 families are included, capped at 25.
  - Still passes every existing gate: caller approved, caller has a family row
    (0008 reciprocal), subject approved (0007). This filter is ADDED on top.
- The map (`MapView.jsx`) and the near-you list (`rankNearby`) consume this. The
  client no longer receives families outside the radius at all, which is the
  point: less scrolling AND fewer families routinely seeing each other's
  children's names.
- `area_family_count` (the pending-user teaser) keeps its own radius param and
  is unaffected in shape; optionally align its default with the 3-mile base.

The adaptive-widen logic is the one non-trivial piece of SQL. It is expressible
with a windowed distance ranking (rank families by distance, take the max of {3
miles, distance of the Kth family} clamped to 25). Build it as its own tested
step. If pure-SQL adaptivity proves awkward, the fallback is: RPC returns
families up to a fixed 25-mile privacy bound with their distances, and the
client applies the personal/adaptive radius for DISPLAY. That fallback keeps the
privacy bound intact (25 mi) while moving adaptivity client-side; note it and
decide during implementation, not now.

## The school anchor

Hard-coded constant (no DB, no input): `RCA = { lat, lng }` geocoded from the
Atlanta address, in a shared module (e.g. `src/carpool/school.js`, mirrored as a
SQL constant in the RPC). Used in v1 to show `distance_to_school_miles` as a
displayed fact on family and crew cards ("about 6 miles from school"). NOT a v1
matching gate. Same-route/same-corridor matching (direction from school, so two
families on the same side pair better than two equidistant families on opposite
sides) is a documented **v2 refinement**, deliberately out of v1.

## Suggested crews

Below the near-you list, a "Suggested crews" section. v1 is viewer-centric and
lightweight:
- Take the caller's near-you families within a TIGHT radius (the 3-mile base, or
  the caller's personal radius if smaller), cluster the ones that also sit near
  each other, and present the cluster as a startable group.
- Label it by the dominant `area_label`'s place name ("College Park crew",
  "Conyers crew"). Area-label to place-name is a lookup on the ZIP; if a clean
  place name is not derivable, fall back to "Families near you".
- One action: "Start a group with these families", which pre-fills the
  create-group form (name defaulted to the crew label) so the caller becomes the
  organizer and the suggested families are who they invite. It does NOT
  auto-create a group or auto-add anyone; the human still creates and the
  suggested families still request/accept through the existing 0005 flow. (An
  auto-invite convenience is a possible later add, out of v1.)

Global, viewer-independent crews ("the College Park crew" as a standing entity
everyone sees the same way) are heavier and out of v1; v1 crews are "who we
suggest for YOU".

## Client

- `src/carpool/school.js` (new): the RCA constant + `distanceToSchool(lat,lng)`.
- `src/carpool/directory.js`: `rankNearby` becomes radius-aware, or is replaced
  by consuming the RPC's pre-filtered rows + distances. Keep pure + tested.
- `src/carpool/proximity.js` (new): pure helpers for effective-radius resolution
  and viewer-centric crew clustering + labeling, fully unit-tested. This is where
  the logic lives.
- `src/carpool/views/MapView.jsx`: consume the scoped list; add the crew section;
  show distance-to-school.
- Family settings: a radius slider on the family edit form (`FamilyForm.jsx` or a
  small settings control), writing `radius_miles`.

## Privacy, stated plainly

v1 scopes what a family SEES to their effective radius. This already reduces how
many families routinely view any given family's children's names, a real
improvement over "every approved parent sees everyone". It does NOT yet
guarantee a family is DISCOVERABLE only within a radius (a viewer with a wide
personal radius, up to 25 mi, still sees a family inside that radius even if
that family set themselves tight). Making discovery mutual/directional (you
appear only to families whose radius you fall in, or only within your own
radius) is a deeper RLS change and a deliberate **fast-follow**, not folded into
v1. Flagged so it is a choice, not an oversight. The 25-mile metro cap is the
hard privacy floor in v1.

## Phasing

- **Phase A:** migration 0009 + radius-scoped `nearby_families` RPC + the
  adaptive default + the near-you list/map consuming it + the personal radius
  slider + distance-to-school display. This alone fixes the "60 strangers"
  problem.
- **Phase B:** suggested crews (clustering, labeling, "start a group with these
  families" prefill).
- **v2 (later, own spec):** same-route matching using the school direction, and
  the stricter directional-discovery privacy model.

## Testing

- `proximity.js` and `school.js`: pure unit tests. Effective-radius resolution
  (personal set, adaptive widen with enough/too-few families, metro-cap clamp),
  distance-to-school, crew clustering + labeling, empty and sparse cases.
- Migration 0009: the RPC gets the same opus security review as 0005-0008 before
  it touches the database, specifically that the radius filter is ADDED to and
  never REPLACES the existing approved/reciprocal/subject gates, and that a
  personal radius cannot exceed 25 in the read even if the column somehow holds
  more.
- Live acceptance with the test accounts at varying areas: confirm a family sees
  only in-radius families, a sparse area widens, and the crew suggestion labels
  correctly.

## Non-goals (v1)

- No auto-formed groups. No auto-invites. Membership stays request + accept.
- No same-route/corridor matching (v2).
- No directional-discovery privacy (fast-follow).
- No global standing crews (v1 crews are viewer-centric).
