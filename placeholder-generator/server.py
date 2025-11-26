#!/usr/bin/env python3
"""
A11y Placeholder Generator (heuristic only)

FastAPI service that inspects HTML/markup and returns a list of edits
to improve accessibility:

- Add alt text to <img> tags
- Add aria-label to unlabeled <button>, <input>, <select>, <textarea>, <a>
- Fix duplicate id attributes
- Fix skipped heading levels
- Replace positive tabindex with 0
- Add lang="en" to <html> when missing
"""

import os
import re
from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# -----------------------------------------------------------------------------
# FastAPI setup
# -----------------------------------------------------------------------------

app = FastAPI(title="A11y Placeholder Generator (heuristic)")

# CORS – wide open for POC; tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    code: str
    # Kept for backward compatibility; currently only "heuristic" is used.
    mode: Optional[str] = "heuristic"

class EditModel(BaseModel):
    start: Dict[str, int]  # { line, column } zero-based
    end: Dict[str, int]
    newText: str

class GenerateResponse(BaseModel):
    edits: List[EditModel]
    warnings: List[str] = []

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------

def offset_to_pos(text: str, offset: int) -> Dict[str, int]:
    """Convert absolute character offset into zero-based {line, column}."""
    offset = max(0, min(offset, len(text)))
    prefix = text[:offset]
    lines = prefix.split("\n")
    line = len(lines) - 1
    column = len(lines[-1])
    return {"line": line, "column": column}

def sanitize_text_for_attr(s: str, max_len: int = 60) -> str:
    """Make a compact label suitable for alt/aria-label: collapse whitespace, trim, truncate."""
    if not s:
        return ""
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace('"', "'")  # avoid breaking attributes
    if len(s) > max_len:
        s = s[:max_len].rstrip() + "..."
    return s

# -----------------------------------------------------------------------------
# Heuristic guessers (no ML)
# -----------------------------------------------------------------------------

def guess_alt_from_src(src: str) -> str:
    """Guess a human-friendly alt from filename or src path."""
    if not src:
        return "Image"
    src = src.split("?")[0].split("#")[0]  # strip query/fragment
    if src.startswith("data:"):
        return "Image"
    filename = os.path.basename(src)
    name = os.path.splitext(filename)[0]
    name = re.sub(r"[_\-\+]+", " ", name)
    name = re.sub(r"\b(img|image|photo|picture)\b", "", name, flags=re.I)
    name = re.sub(r"\d+", "", name)
    name = sanitize_text_for_attr(name).strip()
    if not name:
        return "Image"
    return name[0].upper() + name[1:]

def guess_button_label_from_attrs(attrs: str, inner_html: str) -> str:
    """Guess a label for buttons using classes/ids/inner content."""
    attrs_l = attrs.lower()
    inner_l = (inner_html or "").lower()

    visible_text = re.sub(r"<[^>]*>", "", inner_html or "").strip()
    if visible_text:
        return sanitize_text_for_attr(visible_text)

    if re.search(r"\b(close|dismiss|cancel|close-btn)\b", attrs_l) or re.search(
        r"\bclose\b", inner_l
    ):
        return "Close"
    if re.search(r"\b(submit|send|save|confirm)\b", attrs_l):
        return "Submit"
    if re.search(r"\b(search|find)\b", attrs_l):
        return "Search"
    if re.search(r"\b(menu|open-menu|toggle)\b", attrs_l):
        return "Open menu"
    if re.search(r"\b(next|prev|previous)\b", attrs_l):
        return "Next"
    if re.search(r"<svg\b", inner_html or "", flags=re.I) or re.search(
        r"\bicon\b", attrs_l
    ):
        return "Icon button"
    return "Button"

def guess_input_label_from_attrs(tag_name: str, attrs: str) -> str:
    """Guess an input label from type/name/id/class attributes."""
    type_m = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    name_m = re.search(r'\bname\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    id_m = re.search(r'\bid\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    class_m = re.search(r'\bclass\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)

    type_val = (type_m.group(1) if type_m else "").lower()
    name_val = name_m.group(1) if name_m else ""
    id_val = id_m.group(1) if id_m else ""
    class_val = class_m.group(1) if class_m else ""

    if "email" in (type_val + name_val + id_val + class_val):
        return "Email address"
    if "password" in (type_val + name_val + id_val):
        return "Password"
    if "tel" in type_val or "phone" in name_val:
        return "Phone number"
    if "search" in type_val or "search" in name_val:
        return "Search"
    if "date" in type_val:
        return "Date"
    if "number" in type_val:
        return "Number"

    if name_val:
        return sanitize_text_for_attr(name_val.replace("_", " ").replace("-", " "))
    if id_val:
        return sanitize_text_for_attr(id_val.replace("_", " ").replace("-", " "))
    if class_val:
        token = class_val.split()[0]
        return sanitize_text_for_attr(token.replace("-", " "))
    return "Input field"

def guess_link_label_from_href(href: str, inner_html: str) -> str:
    """Guess a label for a link using href, inner content, or domain hints."""
    if not href:
        visible = re.sub(r"<[^>]+>", "", inner_html or "").strip()
        if visible:
            return sanitize_text_for_attr(visible)
        return "Link"

    href_l = href.lower()
    for name in ("twitter", "facebook", "linkedin", "instagram", "youtube", "github"):
        if name in href_l:
            return f"Visit {name.capitalize()}"

    if href_l.startswith("/"):
        part = href_l.strip("/").split("/")[0] or "page"
        return "Go to " + sanitize_text_for_attr(part.replace("-", " "))

    host = re.sub(r"https?://(www\.)?", "", href_l).split("/")[0]
    host = host.split(":")[0]
    host = host.split(".")[-2] if "." in host else host
    host = sanitize_text_for_attr(host)
    if host:
        return f"Visit {host.capitalize()}"
    return "Visit link"

# -----------------------------------------------------------------------------
# Rule implementations (heuristic)
# -----------------------------------------------------------------------------

def rule_image_alt(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
  """Find <img> tags without alt and propose alt text heuristically."""
  for m in re.finditer(r"<img\b([^>]*)\/?>", code, flags=re.IGNORECASE):
      attrs = m.group(1) or ""
      if re.search(r'\balt\s*=\s*["\']', attrs, flags=re.I):
          continue

      src_m = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
      src_val = src_m.group(1) if src_m else ""
      alt_text = sanitize_text_for_attr(guess_alt_from_src(src_val))

      insert_pos = m.start() + (
          m.group(0).rfind(">")
          if m.group(0).rfind(">") >= 0
          else len(m.group(0))
      )
      edits.append(
          {
              "start": offset_to_pos(code, insert_pos),
              "end": offset_to_pos(code, insert_pos),
              "newText": f' alt="{alt_text}"',
          }
      )

def rule_button_name(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Find <button> without accessible name and propose aria-labels."""
    for m in re.finditer(
        r"<button\b([^>]*)>([\s\S]*?)</button>", code, flags=re.IGNORECASE
    ):
        attrs = m.group(1) or ""
        inner = m.group(2) or ""

        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I) or re.search(
            r'\baria-labelledby\s*=\s*["\']', attrs, flags=re.I
        ) or re.search(r'\btitle\s*=\s*["\']', attrs, flags=re.I):
            continue

        visible_text = re.sub(r"<[^>]*>", "", inner or "").strip()
        if visible_text:
            continue

        label = guess_button_label_from_attrs(attrs, inner)
        insert_pos = m.start() + (m.group(0).find(">") if m.group(0).find(">") >= 0 else 0)
        edits.append(
            {
                "start": offset_to_pos(code, insert_pos),
                "end": offset_to_pos(code, insert_pos),
                "newText": f' aria-label="{label}"',
            }
        )

def rule_input_label(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Add aria-labels for unlabeled form controls (inputs/selects/textareas)."""
    for m in re.finditer(
        r"<(input|select|textarea)\b([^>]*)\/?>", code, flags=re.IGNORECASE
    ):
        tag = m.group(1).lower()
        attrs = m.group(2) or ""

        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I) or re.search(
            r'\baria-labelledby\s*=\s*["\']', attrs, flags=re.I
        ):
            continue

        id_m = re.search(r'\bid\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        if id_m:
            idv = id_m.group(1)
            if re.search(
                rf'<label\b[^>]*\bfor\s*=\s*["\']{re.escape(idv)}["\']',
                code,
                flags=re.I,
            ):
                continue

        label = guess_input_label_from_attrs(tag, attrs)
        match_str = m.group(0)
        insert_pos = m.start() + (
            match_str.rfind(">")
            if match_str.rfind(">") >= 0
            else len(match_str)
        )
        edits.append(
            {
                "start": offset_to_pos(code, insert_pos),
                "end": offset_to_pos(code, insert_pos),
                "newText": f' aria-label="{label}"',
            }
        )

def rule_link_name(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """
    Add missing accessible name for anchors:
    - if image-only link: add alt to inner <img>
    - else: add aria-label to <a>.
    """
    for m in re.finditer(r"<a\b([^>]*)>([\s\S]*?)</a>", code, flags=re.IGNORECASE):
        attrs = m.group(1) or ""
        inner = m.group(2) or ""

        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I):
            continue

        visible = re.sub(r"<[^>]*>", "", inner or "").strip()
        if visible:
            continue

        img_m = re.search(r"<img\b([^>]*)\/?>", inner, flags=re.IGNORECASE)
        if img_m:
            img_attrs = img_m.group(1) or ""
            if not re.search(r'\balt\s*=\s*["\']', img_attrs, flags=re.I):
                inner_start = m.start(2)
                img_index_in_inner = inner.find(img_m.group(0))
                absolute_img_start = inner_start + img_index_in_inner
                insert_pos = absolute_img_start + (
                    img_m.group(0).rfind(">")
                    if img_m.group(0).rfind(">") >= 0
                    else len(img_m.group(0))
                )
                src_m = re.search(
                    r'\bsrc\s*=\s*["\']([^"\']+)["\']', img_attrs, flags=re.I
                )
                src_val = src_m.group(1) if src_m else ""
                alt_guess = guess_alt_from_src(src_val)
                edits.append(
                    {
                        "start": offset_to_pos(code, insert_pos),
                        "end": offset_to_pos(code, insert_pos),
                        "newText": f' alt="{alt_guess}"',
                    }
                )
                continue

        href_m = re.search(r'\bhref\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        href_val = href_m.group(1) if href_m else ""
        label = guess_link_label_from_href(href_val, inner)
        open_tag_end = m.start() + (m.group(0).find(">") if m.group(0).find(">") >= 0 else 0)
        edits.append(
            {
                "start": offset_to_pos(code, open_tag_end),
                "end": offset_to_pos(code, open_tag_end),
                "newText": f' aria-label="{label}"',
            }
        )

def rule_duplicate_id(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Append -1, -2 ... to duplicate id attribute values (leave first occurrence intact)."""
    occurrences = []
    for m in re.finditer(r'\bid\s*=\s*["\']([^"\']+)["\']', code, flags=re.IGNORECASE):
        idval = m.group(1)
        match_str = m.group(0)
        idx = m.start() + match_str.lower().find(idval.lower())
        occurrences.append((idval, idx))

    groups: Dict[str, List[int]] = {}
    for idval, idx in occurrences:
        groups.setdefault(idval, []).append(idx)

    for idval, arr in groups.items():
        if len(arr) <= 1:
            continue
        for i, abs_idx in enumerate(arr):
            if i == 0:
                continue
            new_id = f"{idval}-{i}"
            edits.append(
                {
                    "start": offset_to_pos(code, abs_idx),
                    "end": offset_to_pos(code, abs_idx + len(idval)),
                    "newText": new_id,
                }
            )

def rule_heading_order(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Detect heading level skips and rename offending headings to lastLevel+1."""
    headings = []
    for m in re.finditer(
        r"<(h[1-6])\b([^>]*)>([\s\S]*?)</(h[1-6])>",
        code,
        flags=re.IGNORECASE,
    ):
        open_tag = m.group(1).lower()
        level = int(open_tag[1])
        headings.append((m.start(), m.group(0), level))

    last = None
    for start_pos, block, level in headings:
        if last is not None and level > last + 1:
            target = last + 1
            open_rel = block.find(f"h{level}")
            open_abs = start_pos + open_rel
            close_rel = block.rfind(f"</h{level}>")
            close_abs = start_pos + close_rel + 2  # +2 to start at 'h'
            edits.append(
                {
                    "start": offset_to_pos(code, open_abs),
                    "end": offset_to_pos(code, open_abs + len(f"h{level}")),
                    "newText": f"h{target}",
                }
            )
            edits.append(
                {
                    "start": offset_to_pos(code, close_abs),
                    "end": offset_to_pos(code, close_abs + len(f"h{level}")),
                    "newText": f"h{target}",
                }
            )
            warnings.append(
                f"Changed heading level h{level} -> h{target} at offset {start_pos} to fix order."
            )
        last = level

def rule_no_positive_tabindex(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Replace positive tabindex values by 0."""
    for m in re.finditer(
        r'\btabindex\s*=\s*["\']([0-9]+)["\']', code, flags=re.IGNORECASE
    ):
        try:
            val = int(m.group(1))
            if val > 0:
                val_start = m.start(1)
                edits.append(
                    {
                        "start": offset_to_pos(code, val_start),
                        "end": offset_to_pos(code, val_start + len(m.group(1))),
                        "newText": "0",
                    }
                )
        except Exception:
            continue

def rule_html_lang(code: str, edits: List[Dict[str, Any]], warnings: List[str]) -> None:
    """Add lang='en' to <html> if missing."""
    m = re.search(r"<html\b([^>]*)>", code, flags=re.IGNORECASE)
    if m:
        attrs = m.group(1) or ""
        if not re.search(r'\blang\s*=\s*["\']', attrs, flags=re.I):
            insert_pos = m.start() + m.group(0).rfind(">")
            edits.append(
                {
                    "start": offset_to_pos(code, insert_pos),
                    "end": offset_to_pos(code, insert_pos),
                    "newText": ' lang="en"',
                }
            )

def rule_form_control_has_label(
    code: str, edits: List[Dict[str, Any]], warnings: List[str]
) -> None:
    """Placeholder for future form-label refinements (heuristics already handled above)."""
    return

# -----------------------------------------------------------------------------
# Main endpoint
# -----------------------------------------------------------------------------

@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    code = req.code or ""
    # mode is kept for compatibility; we only run heuristic logic.
    _mode = (req.mode or "heuristic").lower()
    edits: List[Dict[str, Any]] = []
    warnings: List[str] = []

    MAX_CHARS = 600_000
    if len(code) > MAX_CHARS:
        warnings.append("Input truncated due to size.")
        code = code[:MAX_CHARS]

    # Apply rules
    rule_image_alt(code, edits, warnings)
    rule_input_label(code, edits, warnings)
    rule_link_name(code, edits, warnings)
    rule_button_name(code, edits, warnings)
    rule_duplicate_id(code, edits, warnings)
    rule_heading_order(code, edits, warnings)
    rule_no_positive_tabindex(code, edits, warnings)
    rule_html_lang(code, edits, warnings)
    rule_form_control_has_label(code, edits, warnings)

    # aria-hidden checks: warn only (no edits)
    for m in re.finditer(
        r'<([a-z0-9\-]+)\b([^>]*)aria-hidden\s*=\s*["\']true["\']([^>]*)>',
        code,
        flags=re.IGNORECASE,
    ):
        snippet = code[m.end() : m.end() + 400]
        if re.search(
            r'(tabindex\s*=\s*["\']0["\']|href=|<button\b|<a\b|<input\b|<select\b|<textarea\b)',
            snippet,
            flags=re.IGNORECASE,
        ):
            warnings.append(
                "aria-hidden element contains focusable children; "
                "consider removing aria-hidden or making content non-focusable."
            )

    # Deduplicate identical edits
    unique: List[Dict[str, Any]] = []
    seen = set()
    for e in edits:
        key = (
            e["start"]["line"],
            e["start"]["column"],
            e["end"]["line"],
            e["end"]["column"],
            e["newText"],
        )
        if key not in seen:
            seen.add(key)
            unique.append(e)
    edits = unique

    # Sort edits descending by position
    edits.sort(
        key=lambda e: (e["start"]["line"], e["start"]["column"]), reverse=True
    )

    return {"edits": edits, "warnings": warnings}
