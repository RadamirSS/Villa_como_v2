# Stage 3.8 — ground-level access and furnished floor views

## Site correction
The owner clarified that entry, parking and the detached garage are at the
first-floor datum. Removed the elevated courtyard, bridge, ramp and their
supports. Ground paving and parking markings are at that datum. The gate still
faces the balcony side; the rear hillside remains separate from the courtyard.
Garage distances and terrain profile remain conceptual, not a measured survey.

## Interiors
180 individually identified placements cover garage and all three residential
floors: beds, seating, tables, wardrobes, worktops, kitchens, washers, basins,
WCs, showers and bath. Lightweight procedural meshes are created locally;
there are no downloaded assets, license dependencies or runtime asset requests.
Furniture defaults on in floor overview. Tall storage is cut down to 0.85 m
in this control view to avoid hiding rooms; source-wall view shows full units. The visibility control removes actual
geometry. Source drawings remain available through the 2D viewer.

A-18–A-21 were visually traced at 1800px width. Every item retains its source
sheet, explicit symbol bounding box, PDF-frame centre, footprint, room and ID.
Existing source registration is applied unchanged. Shapes and heights are
simplified; this is not a millimetre-certified reconstruction. Curved first-floor
kitchen worktop uses a traced polygon rather than a rectangular block.

Sanitary assemblies link all 75 distinct scheduled marks from A-22–A-29.
Repeated basins preserve schedule quantities. Hidden cisterns and controls are
associated with their assembly, not placed as separate free-standing fixtures.
Unresolved A-27 mark 54 remains explicitly recorded; no product is invented.
A-24 was cross-checked to correct WC position and the paired laundry machines.

## Verification
`npm run build` checks placement IDs, finite mesh geometry on four levels and
scheduled sanitary coverage/quantities, together with existing architecture
checks and TypeScript. These checks do not independently prove XY accuracy.
Browser verification uses the SVG fallback because this environment has no
WebGL: furniture, visibility and floor navigation are checked; real-device GPU
performance, materials and shadow quality require separate verification.

## Remaining stages
Stage 4 now has a first furnished 3D implementation. Finish schedules, bespoke
joinery/elevations and final dimensional acceptance remain. Stage 5 lighting,
switching groups and smart-home scenarios remain planned. Object room bindings
are retained for future overlays; no live equipment control is implied.
