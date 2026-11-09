# Stage 3.9 — source-matched kitchen finishes

## References actually inspected
- PDF page 88, sheet A-119: three main-kitchen 3D schemes.
- Page 87, A-118: main-kitchen elevations.
- Pages 61–63, A-92–A-94: staff-kitchen elevations and 3D schemes.
- Page 86, A-117: dining-room table, upholstered chairs and fitted storage.
- Page 81, A-112: light living-room upholstery.
- Page 59, A-90: grey wardrobes.
- Page 70, A-101: upholstered bed/headboard.
- Pages 90/92, A-121/A-123: attic pink and sage accents with light timber.

## Change
Replaced the universal brown material with separate painted fronts, recessed
panels, framing, upholstery, light timber, hardware, appliances and worktops.
Main kitchen uses light grey framed doors and drawers, muted blush speckled
worktops, dark pulls, oven columns, tall storage, glazed uppers and bentwood-style
stools. Staff kitchen uses plain grey base fronts and timber upper cabinets;
it deliberately does not inherit the main kitchen's pink worktop.
Inset kitchen sinks no longer create a free-standing bathroom vanity over the
kitchen counter. Worktop and grain variation are deterministic DataTextures,
with no network assets, external licenses or canvas dependency.

A-20/A-19 placement IDs, room and sanitary bindings stay intact. Existing
traced main kitchen runs gain a short west return and segmented east bank
from the plan/elevation; generic heights and equal-width module subdivisions
remain approximate. This is a closer visual interpretation, not a fabricated
joinery fabrication model. PDF display colours are not verified RAL samples.
First-floor apartment-kitchen finishes remain neutral where no corresponding
coloured kitchen scheme was provided in these sheets.

## Viewing
Low-wall floor overview still cuts storage down for smart-home use. On floor 2,
“Кухня крупно” shows the same kitchen meshes at full unit height in an isolated
inspection view with a neutral presentation base, not an invented room slab.
“Обзор этажа” restores the full floor. Other rooms are retained in the scene
model, with visibility changed only for this inspection view.

Corrected selected-floor slab top to the zero furniture datum. SVG fallback
renders that base before furniture and subdivides kitchen faces to reduce
painter-order artefacts. Neutral fallback ambient colour compensates for
SVGRenderer ignoring AmbientLight intensity, which previously washed out the
material palette. This does not enable WebGL or reproduce GPU materials.

## Validation
40 tests, TypeScript and production build pass. Added checks ensure different
kitchen material palettes/source bindings, and restored full-height units in
detail mode without shifting registered placement centres. Existing geometry
and sanitary tests still pass. Browser QA uses SVG fallback: colour families,
floor/detail navigation and object visibility are checked, while exact GPU
appearance and phone performance remain unverified. Stage 4 final finishes and
stage 5 lighting/scenarios remain open.
