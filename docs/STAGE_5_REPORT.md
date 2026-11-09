# Stage 5 — lighting demonstration and first scenarios

## Implemented
- Shared boolean state for all 44 room zones, including garage and service rooms.
- 87 addressable groups; 243 visually traced light/output anchors; 63 printed
  control-label/contact bindings. These are not certified fixture quantities.
- Individual groups and room master actions. Multi-location and combined controls
  operate the same group IDs, including the second-floor control linked to
  first-floor 10.1/10.2. A-34 gate-contact simulation forces garage ceiling light
  on; repeated opening signals do not turn it off.
- Ceiling, pendant, wall and LED representations; lit floor fills clipped to
  registered building/terrace outlines with source walls subtracted.
- Independently addressable warm facade panes and skylights. Each retains room ID
  and binding evidence. Garage lab/store windows follow their actual zones;
  the opaque main entry gets a presentation light-spill pool, not invented glass.
- Day/dusk/night; five explicit presets: arrival, evening, dinner, night route,
  away. Presets replace the whole lighting state; manual changes clear the preset
  label. All-off includes service rooms and garage.
- Local versioned persistence of group state. Full-screen controls remain usable.
- Optional dashed logical group links. They are deliberately labelled schematic,
  not physical cable routes, and no electrical sizing or protection is implied.

## Source and uncertainty
A-34/A-35/A-36/A-37 are PDF pages 34–37 of the supplied project. The next PDF
page is A-40; A-38/A-39 are not present as lighting sheets in this supplied set.
Printed circuit marks remain intact, with stable floor-qualified IDs. Positions
and fixture categories are visually transcribed; symbol positions, kinds and
quantities still require independent engineering acceptance. A-37 source X frame
is compensated by -3.96 PDF points, unlike furniture page A-21's -4.32.

A-35 leaves the left apartment wing without lighting symbols/groups. Ten logical
room controls across all floors are explicitly demo-unresolved, not passed off
as issued circuits. Six garage circuits have no printed numbers and use local
IDs with an unmarked-circuit label. Two attic bedside circuits are source symbols
with integral switches and no printed group marks. Technical 5.1 has a control
label but no resolved fixture location. No dimming capability is assumed.

Room fill boundaries are visual traces from furniture plans, clipped against
source architectural geometry. Facade panes use nearest inward room-footprint
matching, not a certified BIM adjacency graph. This preserves the unresolved
architectural status of the preceding stages.

## Architecture and performance
`lighting-plan.json` is generated from explicit traces/control text, separate
from the source architectural geometry. `lighting.ts` owns pure room/group and
scenario transitions; `useLighting` owns UI state and optional persistence.
`Lighting3D` only changes materials and visibility on state changes. Switching
lights does not rebuild the house or reset its camera. No dynamic shadow light
is allocated per lamp; visible glow uses emissive panes and floor/symbol fills.
Source wiring relationships and future live commands are distinct concepts.

## Verification
`npm run build`: 44 tests pass, TypeScript and production build pass. Tests cover
room/group completeness, explicit unknowns, valid control and scenario targets,
cross-floor controls, combined toggles, all-off, finite four-floor geometry,
room-fill visibility, independent facade/garage response and unchanged geometry.
Browser checks: dinner/arrival/evening, kitchen combined switch, room toggle,
all-off with windows dark, garage gate signal, schematic links and full-screen.
Browser uses SVG fallback because WebGL is unavailable here. Real phone GPU
performance, photometric accuracy and physical equipment operation are unverified.

## What this does not complete
The frontend demo now supports the first requested light/scenario workflows.
It is not an installation-ready wiring design, controller configuration or a
commissioned electrical system. Relays, breakers, cable sizing, mains topology,
driver dimming and failure behaviour need a separate reviewed integration design.
Stage 4 final finishes and earlier architectural acceptance items remain open.
