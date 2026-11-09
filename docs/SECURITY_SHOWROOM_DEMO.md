# Access, vehicle, virtual cameras and security demonstration

Integrated access, vehicle, camera and security demonstration retaining the
house, garage and site layout. This supersedes SECURITY_SHOWROOM_REPORT.md.

- Existing entrance pickets/rails form two sliding leaves retracting 3.05m each.
  Existing garage-entry shutter compresses upward as a simplified sectional-door
  representation; no duplicate facade or invented second garage opening.
  Dynamic ancestors are excluded from opaque batching.
- Gate and garage progress use a reducer with reversible target commands. A car
  waits until both are fully open. Closing is rejected during driving or when
  the car has stopped in the passage. The demo car follows a smooth, illustrative
  driveway route into the existing garage. Entry/exit returns to the full model.
  Opening the garage also forces its source-linked ceiling-light group on.
- Six camera viewpoints (entrance, garage, main entry, terrace, garden, rear perimeter) render the actual
  current scene. The viewer refreshes at 750ms only while the camera tab is open,
  restores the main camera after each capture, and cleans up on leaving the tab.
  It is explicitly marked DEMO / 3D: no live camera, recording, video archive,
  person recognition or connected NVR is implied. The optional night visualization
  is a color filter, not actual infrared imaging.
- Disarmed / perimeter / full security modes, gate-clear checks, a simulated
  entrance-motion event, alarm acknowledgement and bounded 12-event journal.
  Armed modes reject access commands. Alarm acknowledgement leaves the mode armed;
  disarming clears the alarm. No real alarm or external notification is emitted.
- A single Systems header action and menu entry open three focused tabs. New copy
  is translated into RU/EN/FR/IT/DE. Reset on reload starts disarmed with gates
  closed and the car outside; security state is intentionally not persisted as
  though it represented real equipment.

The small approach-road extension and device/car geometry are illustrative.
They do not change source architecture or purport to be a surveyed equipment plan.
The model animation is illustrative, not a vehicle autopilot or physical gate
safety controller. Existing light/courtyard state and navigation remain intact.

Validation: 55 tests, TypeScript and production build. New tests cover interlocks,
waiting for openings, stop/resume/exit, arm guards, alarm lifecycle, bounded journal,
actual unbatched moving geometry, finite car/six-camera geometry and route continuity.
Browser QA uses SVG fallback; real-phone WebGL performance remains unmeasured.
