---
name: geocarto-maps
description: Produce data and ready-made maps for GeoCarto, the visual-first cartography app. Use when asked to prepare a GeoJSON or CSV dataset for GeoCarto, to turn data into a map, or to write a .cartoproj project file (layers colored by value or category, labels, legend, title) that opens in GeoCarto as a finished map.
---

# GeoCarto maps

GeoCarto is a map editor for editorial work: a basemap, data layers, annotations, print-ready export.
You can hand it two kinds of deliverable. Pick the smallest one that does the job.

| The user wants… | Deliver | Read |
| --- | --- | --- |
| data they will style themselves, or data to join to a layer they already have | a `.geojson` or `.csv` file | `reference/data-files.md` |
| a finished map: colors, labels, legend, title already set | a `.cartoproj` file | `reference/project-format.md` |

## Workflow

1. Get the data right first. Coordinates are WGS84 degrees, `[longitude, latitude]`. Properties are flat.
2. For a `.cartoproj`, start from `examples/minimal.cartoproj` and change it. Write only the fields you
   need: GeoCarto fills in every default (ids, classification breaks, category colors, legend entries).
3. Validate every file you produce, and fix **every** line it prints, warnings included:

   ```bash
   node scripts/validate.mjs path/to/file.cartoproj path/to/data.csv
   ```

   The validator is built from GeoCarto's own loader, so a clean run means the file opens as intended.
   It also lists each dataset's numeric and category attributes, which tells you what can be styled.
4. Tell the user how to open it: **Open project** for a `.cartoproj`; **Import data** (after locking the
   map area) for `.geojson` / `.csv`; **Join data** in a layer's properties to attach a table to it.

## Rules that are easy to get wrong

- **Longitude first.** `[2.35, 48.85]` is Paris; `[48.85, 2.35]` is in the Indian Ocean. Never projected meters.
- **Codes are text.** Write INSEE, FIPS, ISO, and postal codes as strings (`"01"`, not `1`) so leading zeros
  survive and joins match.
- **Numbers are numbers.** A value you want to map by size or color must be a JSON number or an unquoted
  CSV cell, with no unit or thousands separator inside it. Put the unit in a label suffix instead.
- **Categories are few.** Color-by-category reads well up to about 8 values and is capped at 12. Group the
  tail into an explicit "Other" value yourself if the grouping matters.
- **Normalize before you shade.** A choropleth of raw counts mostly maps population. Compute a rate
  (per capita, percent, density) and map that; keep the raw count as a second attribute.
- **Do not invent positions on the page.** You cannot know the user's window size. Use
  `viewport.bounds` to frame the map and `"place": "top-left"` (etc.) to position furniture.
- **Do not fabricate data.** If you estimated, geocoded, or simplified something, say so in a
  `sourcecredit` annotation and in your reply.
