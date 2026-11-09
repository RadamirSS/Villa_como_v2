# Simpler navigation and demonstration courtyard light

The scene dock keeps permanent, labelled Light and Scenes actions with comfortable
38px visible buttons. A count includes lit rooms and the yard; an indicator marks
an applied preset. Preset names never replace the action label. Floor navigation
and a Whole site return remain available; long translated overview labels truncate
inside their tab rather than pushing garage off the mobile dock. Arrow keys and
Home/End move/select floors. Zoom in/out join reset by the scene; image export
moves into View settings. A short usage guide is available there as well.

Light opens a courtyard card first, then floor selection and room controls.
The card contains on/off state, a demo/source-gap explanation and Show courtyard,
which restores the site and closes the sheet. Outdoor fixtures and ground pools
respond immediately in day, dusk and night without rebuilding scene geometry.
The stored lighting v1 payload gains an optional courtyard boolean; older saves
keep room states and use courtyard=true. Disabled/corrupt storage is tolerated.
Manual yard changes clear the active scenario. Away and All off include the yard;
arrival, evening, dinner and night route include it as an explicit demo addition.
Room/circuit IDs and original source lighting remain unchanged. All new copy is
available in RU/EN/FR/IT/DE. No hardware commands are issued.

Verification: existing geometry, lighting, localization and landscape checks plus
new tests for persistence migration, source evidence, scene mapping and independent
outdoor power across all three times; TypeScript and production build.
