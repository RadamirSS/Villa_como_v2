# Showroom interface — reference-led simplification

## Primary screen
Replaced the architecture dashboard with one scene-first composition following
the supplied IMG_3356 reference: dark green header, editorial serif title,
warm neutral background, central model, compact camera tabs, time controls and
bottom floor selector. The actual corrected house/site geometry is preserved.
Primary actions are camera reset/export, camera orientation, time, floor selection,
room-light panel and scenarios. Source sheets, counts and geometry controls no
longer occupy the main screen. The layout reserves scene space above the docks;
390 x 844 CSS-pixel portrait layout was inspected in a local iframe viewport.

## Progressive disclosure
- Menu: scenarios, room lights, view settings, source drawings, model passport.
- Room lights: room list with direct switches, then a selected room's light kinds.
  Physical-control labels are an extra disclosure inside that detail.
- Clicking a room on the model exposes only its name/status and power action.
- Scenarios: five descriptive cards. Applying one closes the panel, leaving the
  current preset name in the dock and announcing state accessibly.
- View: model modes, layers, schematic lighting links, zoom, side view and kitchen
  detail. Source renderer limitations are retained behind another disclosure.
- Drawings: existing 2D layers, navigation, export and sanitary details retained.
- Passport: room/door/sanitary/dimension data, geometry calibrations, source notes
  and accuracy limitations retained below the main screen.

## Interaction and accessibility
Native dialogs supply modal focus handling, Escape and backdrop dismissal.
Explicit cleanup returns focus to the opener, with menu fallback for panel routes.
Floor tabs have distinct accessible labels including their numbers. Lighting
switches expose checked state and the main scene announces preset/room-light count.
Underlying model stays mounted while panels open, so camera and lighting state
are preserved. Room and scenario components share the existing lighting engine.
The camera button downloads the current model view as PNG for WebGL or SVG for
vector fallback; no screenshot is uploaded to a service.

## Validation
Existing 44 data/geometry/lighting tests, TypeScript and production build pass.
Browser checks cover desktop composition, the 390 x 844 portrait layout, floor
selection, room light/detail controls, scenario application with automatic close,
menu routing, Escape/focus return, view settings and source-drawing access.
Source model rendering uses SVG fallback in this browser; no new claim about
real-iPhone GPU quality or performance is made. Temporary responsive QA pages
are not included in the committed or published source.
