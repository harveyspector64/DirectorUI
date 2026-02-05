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
- Free text script-matching search
- Actor attachment filtering from actor matrix relationships
- Availability-aware results panel with next project context
- Top metrics for matching count, Board A overlap, and lane coverage
