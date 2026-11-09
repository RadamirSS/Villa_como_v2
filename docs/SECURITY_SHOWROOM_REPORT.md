> Historical first implementation. For current interlocks, camera preview and security modes see [SECURITY_SHOWROOM_DEMO.md](SECURITY_SHOWROOM_DEMO.md).

# Villa Como v2 — Security and Access Showroom (demonstration)

## Implemented
- Sliding entrance gate is a paired animated model element at the previously specified right-of-garage driveway. The existing enclosing wall, intercom and site geometry remain intact.
- The source-informed garage shutter `garage-entry` is animated inside its existing 10.9 m opening. It is *not* a claim of motor or door hardware selection.
- Procedurally modelled electric sedan, with an exterior-to-garage route. It moves only after both simulated gates finish opening. Entry/exit, separate gate commands and arming are supported.
- Six conceptual CCTV devices: driveway, garage, main entrance, terrace, garden and rear perimeter. Selecting a camera moves the existing 3D viewer to its viewpoint. No live video is served or claimed.
- Perimeter arming, disarming, visible detection zones, an explicit demo motion alarm and reset.
- Accessible controls under a new Security panel in the main dock and menu; existing lighting/scenarios and source drawing workflows stay untouched.
- RU/EN/FR/IT/DE translations via a dedicated key bundle.

## Source and constraints
The garage's wide opening comes from A-14 / `garage-entry` in the existing exterior model. The entrance gate geometry and site orientation are presentation-level based on the owner's prior clarification. Camera positions, motion sensors, vehicle, motorised actions, and security logic are *synthetic showroom additions*, not specified hardware in the supplied architectural PDF.

Nothing connects to physical gates, CCTV, cloud video, alarm services, police, notifications or smart-home controllers. No passwords, video URLs or user-sensitive event logs are stored. Alarm states are local browser state. A real deployment requires an authenticated backend, least-privilege device access, privacy review and an independently commissioned physical system.

## Developer notes
- Domain state: `src/domain/security.ts`
- Lightweight 3D devices/animation: `src/components/Security3D.ts`
- Security panel: `src/components/SecurityControls.tsx`
- Integration with the established scene/camera, exterior gates and Vite/i18n.
- `npm run build` runs the existing test/typecheck/geometry pipeline; `tests/security.test.mjs` covers camera targets, gate and car interlocks, and alarm states.

## Next real-world steps (not implemented)
Validate actual garage door opening width and mechanical type; locate installed or proposed cameras on a surveyed site plan; design access control with manual override, obstruction and safety interlocks; specify compliant surveillance retention and access controls; test real physical control with Wi-Fi disconnected before treating anything as commissioned.
