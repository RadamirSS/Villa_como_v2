# Stage 3.7 — common attic roof, floor overview and complete site

Owner clarification, 2026-11-08, supersedes the stage 3.6 interpretation of a
separate raised attic block and the previous isolated-only garage policy.

## Shared roof and attic

The common pitched roof covers the entire second-floor footprint and the
registered habitable attic footprint. The upper envelope of intersecting hip
surfaces uses one eave elevation (display assumption 6.45 m). The old tall
third-floor facade box and exposed flat-roof wings are removed. Knee walls
follow the actual roof profile in short segments instead of spanning valleys
with a straight chord that could protrude through the roof.

The third-floor source plan still defines its original five scheduled rooms.
The right-hand unused attic is real shaded floor space in the model, labelled
as unused and never added to the habitable-room register. Roof pitch, height,
exact ridges and remaining architectural registration limitations are still
presentation assumptions; owner clarification does not supply missing elevations.

## Floor overview

Selecting any floor now opens a cutaway with **550 mm display walls**, low
450 mm door representations, an oblique overview camera and room markers above
the walls. The terrace remains a filled, selectable part of floor two. Full
source wall heights are preserved in the separate source-wall mode. No source
height or original PDF footprint is changed to obtain the low-wall display.
Room IDs and marker selection remain the anchors for stage 5 controls.

## Site and garage

The existing v1 layout (`src/data/architecture.js`) uses garage centre
`[24.5, 10.2]` metres, rotation `-PI/2`, and the lower-floor elevation. These
**demonstration distances**, combined with the owner's confirmed right side and
orientation, are reused for the PDF-derived v2 garage. It has its own stable
building ID, appears in the default full-site view and can be hidden separately.
The selected-garage overview retains its source plan.

The site includes a raised court at +2.93 m, access ramp to the lower approach,
and yard entrance facing +Z, the same side as the balcony. Garage shutters face
inward toward the court. Ground extent and lower approach are expanded so the
garage does not sit outside the terrain or inside the hillside.

These site offsets are not construction coordinates or boundary measurements.
The original architectural drawings, 44 room positions and stage 4/5 scope are
preserved.

## Verification

`npm run build` verifies data, geometry regressions, TypeScript and production
output. Additional tests cover full-footprint roof ray casting (including the
unused right wing), garage side/orientation, entrance direction, unused attic
presence without new room IDs, and low versus original wall heights on all four
levels. Browser interaction is checked through the SVG fallback because WebGL
is unavailable in the provided browser; actual WebGL materials and iPhone
performance retain the previous verification limitation.
