# Remaining stages — Villa Como v2

The agreed five-stage workflow is preserved: (1) architecture in 2D,
(2) furniture/plumbing, (3) spatial model, (4) interiors/materials,
(5) lighting and smart-home scenarios. Stage 3.6 corrects the exterior and site;
it does not silently mark stages 4 or 5 complete.

## Stage 4 — interiors and materials

1. Parse A-44–A-57 for room-specific floors, wall finishes and ceilings, with
   references to source sheets rather than one generic material for every room.
2. Stages 3.8–3.9 implement 180 individually identified procedural 3D placements
   from A-18–A-29, including every scheduled sanitary mark. Kitchen finishes
   and fitted-unit details now reference A-92–A-94/A-118–A-119. Independently accept
   traced positions and dimensions against plans/elevations; retain the 2D
   comparison and do not label unverified objects exact BIM.
3. Resolve source ambiguities and placements before adding presentation detail.
   Keep source-derived positions, assumed dimensions and chosen models separate.
4. Add finished room views and useful cutaway heights, without altering the
   external footprint, registered source frame or room IDs.
5. Validate all four levels, including terrace and garage, on desktop and phone.

Acceptance: the viewer can open furnished, finished rooms and compare them with
the original plans; approximate items are identifiable in the data. Roof, site
and other missing architectural information retain their evidence status.

## Stage 5 — lighting and smart-home scenarios

1. Extract fixtures and control groups from A-34–A-39; correlate circuits with
   actual rooms and source switching diagrams. Multiple switches can control
   one group, and one room can contain several groups.
2. Define stable IDs for fixtures, circuits, controls and scenarios. Bind them
   to the existing room IDs and facade opening IDs; visual state is separate
   from architectural geometry and camera state.
3. Implement the demonstration state: on/off, brightness where applicable,
   group and room control, all-off, and scenario selection.
4. Present scenarios such as arrival, evening, dinner, night route and away as
   explicit combinations of reviewed groups. Show what changed on the 3D model,
   in the selected floor and through illuminated windows.
5. Add day/evening/night scene lighting, controlled fixture emission and a
   performance budget. Avoid one dynamic shadow-casting light per lamp.
6. Clearly identify simulated commands. Future physical integration must keep
   local switches usable during Wi-Fi/controller failure; a browser simulation
   does not demonstrate electrical fail-safe operation.

Acceptance: source-matched groups respond coherently in the 3D and room controls;
scenarios can be applied, inspected and reset; the villa remains navigable and
responsive on a phone. No live equipment is implied by a working UI simulation.
