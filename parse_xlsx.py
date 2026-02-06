#!/usr/bin/env python3
"""Extract key sheets from BoardA_Directors_UNIVERSE_v3.xlsx into JSON for the UI."""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

ROOT = Path(__file__).parent
XLSX_PATH = ROOT / "BoardA_Directors_UNIVERSE_v3.xlsx"
OUTPUT_PATH = ROOT / "data" / "directors.json"

TARGET_SHEETS = {
    "README",
    "UNIVERSE",
    "DIRECTORS",
    "ACTOR_MATRIX",
    "PROJECTS_NEXT",
    "AVAILABILITY",
    "BUDGET_BANDS",
}


def col_to_index(col: str) -> int:
    index = 0
    for ch in col:
        index = index * 26 + ord(ch) - 64
    return index - 1


def parse_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    ctype = cell.attrib.get("t")

    if ctype == "inlineStr":
        inline = cell.find(f"{{{NS_MAIN}}}is")
        if inline is None:
            return ""
        return "".join((node.text or "") for node in inline.iter(f"{{{NS_MAIN}}}t")).strip()

    value = cell.find(f"{{{NS_MAIN}}}v")
    if value is None or value.text is None:
        return ""

    text = value.text.strip()
    if ctype == "s" and text:
        return shared_strings[int(text)].strip()

    return text


def parse_sheet(zf: zipfile.ZipFile, sheet_path: str, shared_strings: list[str]) -> list[dict[int, str]]:
    root = ET.fromstring(zf.read(sheet_path))
    sheet_data = root.find(f"{{{NS_MAIN}}}sheetData")
    if sheet_data is None:
        return []

    rows: list[dict[int, str]] = []
    for row in sheet_data.findall(f"{{{NS_MAIN}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{NS_MAIN}}}c"):
            ref = cell.attrib.get("r", "")
            col = "".join(re.findall(r"[A-Z]+", ref))
            if not col:
                continue

            parsed = parse_cell_value(cell, shared_strings)
            if parsed:
                values[col_to_index(col)] = parsed

        if values:
            rows.append(values)

    return rows


def tabularize(rows: list[dict[int, str]]) -> list[dict[str, str]]:
    if not rows:
        return []

    header_map = rows[0]
    max_col = max(header_map)
    headers = [header_map.get(i, "") for i in range(max_col + 1)]

    records: list[dict[str, str]] = []
    for row in rows[1:]:
        record = {
            headers[col]: row[col]
            for col in row
            if col < len(headers) and headers[col]
        }
        if any((str(value).strip() for value in record.values())):
            records.append(record)

    return records


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(XLSX_PATH) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sroot = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for entry in sroot.findall(f"{{{NS_MAIN}}}si"):
                shared_strings.append(
                    "".join((node.text or "") for node in entry.iter(f"{{{NS_MAIN}}}t")).strip()
                )

        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {node.attrib["Id"]: node.attrib["Target"].lstrip("/") for node in rels}

        data: dict[str, object] = {}

        for sheet in workbook.find(f"{{{NS_MAIN}}}sheets") or []:
            sheet_name = sheet.attrib["name"]
            if sheet_name not in TARGET_SHEETS:
                continue

            rel_id = sheet.attrib[f"{{{NS_REL}}}id"]
            target = rel_map[rel_id]
            if not target.startswith("xl/"):
                target = f"xl/{target}"

            parsed_rows = parse_sheet(zf, target, shared_strings)
            if sheet_name == "README":
                data["readme"] = [
                    {
                        "cell": next(iter(row.keys())) + 1,
                        "text": next(iter(row.values())),
                    }
                    for row in parsed_rows
                ]
            elif sheet_name == "BUDGET_BANDS":
                data["budgetBands"] = tabularize(parsed_rows)
            elif sheet_name == "UNIVERSE":
                data["directors"] = tabularize(parsed_rows)
            elif sheet_name == "DIRECTORS":
                data["boardA"] = tabularize(parsed_rows)
            elif sheet_name == "ACTOR_MATRIX":
                data["actorMatrix"] = tabularize(parsed_rows)
            elif sheet_name == "PROJECTS_NEXT":
                data["projectsNext"] = tabularize(parsed_rows)
            elif sheet_name == "AVAILABILITY":
                data["availability"] = tabularize(parsed_rows)

    OUTPUT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
