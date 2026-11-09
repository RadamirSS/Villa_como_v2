# Landscape presentation

The courtyard entrance is now on the right of the garage when looking inward
from its gate (+Z frontage, right = +X). Garage geometry and placement are
unchanged. Entrance centre X=34m, driveway X=31–37m, with a continuous connection
to the garage apron at Z=20–28m. A geometry test checks driveway clearance from
the actual transformed garage envelope. Courtyard/parking remain at level 1;
there is no elevated court, ramp or bridge to level 2.

The site has distinct limestone forecourt/apron, entrance driveway, three 3×5.4m
permeable parking bays with wheel stops and illustrative EV pedestals, separate
pedestrian stepping stones, planted limestone beds, olives, low hedges, lavender,
gravel garden seating, boundary wall/railings, gate and intercom. This is a
presentation landscape, not surveyed construction or electrical equipment design.
The source house/garage, source room and lighting IDs remain unchanged.

Outdoor lighting uses shared emissive materials and transparent ground pools,
updated by existing day/dusk/night control. It does not add a dynamic shadow light
per bollard or imply live hardware integration. Opaque site geometry is batched
by material; the site has a tested mesh budget of fewer than 65 draws. No external
models, texture downloads, tracking or heavy asset dependencies were added.

Validation: 49 tests, TypeScript and production build. Tests cover entrance side,
driveway clearance, finite geometry, site bounds, batching and time-driven light
pools without geometry reconstruction. Source-derived terrain cutout and buried
rear first floor are retained. The cloud browser uses SVG fallback; this is not
a measurement of real-phone WebGL rendering performance.
