# Director Packaging Console

A lightweight UI built from `BoardA_Directors_UNIVERSE_v3.xlsx` for internal director filtering and packaging workflows.

## Run locally

```bash
python parse_xlsx.py
python -m http.server 4173
```

Open `http://localhost:4173`.

## Features

- Faceted filters (tier, lane, tonal DNA, scale, budget band)
- Preset views (All, Board A, Workman pool, Up & Comers)
- Free text script-matching search
- Actor attachment filtering from actor matrix relationships
- Availability-aware results panel with next project context
- Sort + pagination with explicit "Showing X-Y of Z" visibility
- Export filtered director list to CSV

## Spreadsheet improvements to consider next

- Add a normalized `Tags` column in `UNIVERSE` for reliable semantic matching (e.g. `contained`, `elevated-horror`, `period`, `auteur`, `franchise`).
- Add `BudgetBandTypical` to all directors (many rows are empty today).
- Add `AvailabilityCategory` controlled values (`Open`, `Limited`, `Busy`, `Unknown`) for cleaner filtering.
- Add `PackagingPriority` and `RiskFlag` fields for internal shortlist ranking.
