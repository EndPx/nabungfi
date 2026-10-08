# Expanded savings templates — 8 October 2026

AI/custom-prompt generation is deferred. Create Goal now offers nine deterministic templates: **Car, Laptop, House, Game console, Camera, Motorcycle, Bicycle, Smartphone and Travel suitcase**. Existing `custom` sculpture goals remain readable and renderable, but new creation does not offer the Something else placeholder.

Each template has exactly 100 stable primary part IDs, finite dimensions and its own geometry. New objects use the existing procedural toy renderer, exposed studs, rounded plastic, tires/hubs, lighting, completion cue and rotation controls. Cylinder orientation and optional hub decoration support camera lenses, phone cameras and vehicle wheels while preserving the original car/laptop/house rendering defaults. Template choice does not alter goal targets, balances, bindings, wallet authorization or claim rules.

The shared `GOAL_TEMPLATES` catalog supplies model identifiers and labels to the API and UI. `/api/config` advertises supported model IDs; the client filters its menu against that capability and falls back to the original named templates when talking to an older API. Create shows the actual model poster beneath the native select. Posters are captured from the same completed 3D model through the isolated local renderer; they are not generated photographs or customer balances.

Migration **010_goal_templates.sql** expands the model CHECK constraint additively and keeps all original model IDs. No user goal, original transaction or binding is rewritten. Actual Neon checks verified persistence and authenticated HTTP creation for every selectable template, then cleaned only their unique synthetic owners.

## Verification

- 75 frontend unit tests passed, including exact 100-part identities, distinct assemblies, stud footprints and rejected unknown model IDs.
- 44 server tests and typechecking passed.
- 65 real-Neon/database HTTP checks passed across migrations 1–10, including all nine model persistence and API-creation cases; zero financial transactions.
- Three browser tests passed for selection and actual loaded posters at 320/390/1280px, with no horizontal overflow. AI/custom is absent from the menu.
- Production build and production PWA shell checks passed. All six new posters were inspected against the renderer; camera lens and wheel orientation were corrected before capture.

## API rollout

The native API uses an API-only immutable copy under `/opt/nabungfi/api-releases/templates-*`, based on the existing Linux release and its pinned dependencies, with only the shared catalog, API validation/capability, migration runner and new SQL overlaid. A scoped systemd WorkingDirectory drop-in selects that API release. The shared `current` release pointer, runtime/security settings, keeper PID, signers and private configuration are retained. Only the API restarted. Registry publication refreshes `updatedAt`; the registry retains its four existing goal entries, so byte equality is not claimed.

The live HTTPS API returned all nine model IDs, `ok: true`, and available coordination with zero active registrations. The frontend release uses the supported catalog so template options follow API readiness. This is template/metadata acceptance, not a new owner-signed financial lifecycle.

For an installed PWA, accept the **Update** banner in the app after unresolved wallet requests are reconciled. The banner is global, not a Settings-only control.
