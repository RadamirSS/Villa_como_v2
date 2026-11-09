# Direct model access and automatic closure

Camera bodies now have concrete feet, metal posts and brackets. Every installation
has a declared terrain base, including the high rear slope. None is suspended at
an arbitrary viewpoint. Six camera stations retain stable IDs. Their lens viewpoint
is offset ahead of the housing. A dedicated lazy 960×540 renderer captures a fixed
16:9 frame and hides the selected installation in a try/finally scope, without
changing the main renderer, orbit camera, dimensions or visible model geometry.
The virtual night effect remains a clearly labelled appearance filter.

Direct interaction: projected, accessible camera/gate/car buttons track orbit and
zoom; physical geometry also resolves interactions by ancestor metadata. A 7px
pointer movement threshold avoids triggering object controls after rotation.
Camera taps open the selected feed directly. Gate and car taps show compact
in-scene action cards; no menu navigation is required. Hotspots hide in floor views.
Source room selection and the complete Systems sheet remain available.

Vehicle lifecycle:
- Both openings are commanded open before movement. Entry waits for full opening.
- On arrival, entrance closing starts only after progress .24, where the complete
  car has cleared the entrance. Movement continues toward the open garage.
- On departure, entrance stays open until the vehicle reaches the external apron,
  then closes automatically. The car/garage interlocks remain active while moving.
- Completing either journey schedules garage closure for 120,000ms later. The
  deadline uses wall time, independent of the capped motion timestep. The sheet and
  garage action card display remaining time. Manual closure cancels the deadline;
  a new journey clears the old deadline. A stopped car in the passage blocks closing.
- Reload resets this synthetic security demo; it does not restore real device state.

All added labels exist in RU/EN/FR/IT/DE. The systems remain simulation-only.
58 tests plus TypeScript and production build pass, including arrival clearance,
departure closure, exact timer deadline, manual override and physical camera mounts.
