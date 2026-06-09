# Archived conversion templates

These JSON files describe **historical** Neo→CF migration runs from
earlier stages of the project. They do not reflect the current state
of `mta.yaml` (which represents the live 54-app HR7+SLS deployment) or
`mta-hd6.yaml` (8-app HD6 deployment).

Kept for audit history. **Do not run the conversion automation against
these files** — they will rebuild the wrong app set with stale MTA IDs.

The current templates are:
- `../neo-to-cf-hd6.json` — active 8-app HD6 conversion
- `../cf-destinations-from-neo.json` — destination mapping reference
- `../destinations-needed.json` — destination inventory

For HR7+SLS, the canonical descriptor is `../../mta.yaml`. No active
template file exists for it (and won't be regenerated unless we resume
batch conversion).
