#!/usr/bin/env python3
# server.py -- Placeholder generator for accessibility attributes (heuristic + optional ML)
# Place in placeholder-generator/server.py

import re
import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Optional ML imports (BLIP). If not installed, ml_available = False and ML paths will fallback to heuristics.
ml_available = False
BLIP_PROCESSOR = None
BLIP_MODEL = None
try:
    from PIL import Image
    from io import BytesIO
    import base64
    from transformers import BlipProcessor, BlipForConditionalGeneration
    ml_available = True
except Exception:
    ml_available = False

app = FastAPI(title="A11y Placeholder Generator (heuristic + optional ML)")

# Dev-friendly CORS: adjust for production.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ---- Request / Response models ----
class GenerateRequest(BaseModel):
    code: str
    mode: Optional[str] = "heuristic"  # "heuristic" or "ml"

class EditModel(BaseModel):
    start: Dict[str, int]  # { line, column } zero-based
    end: Dict[str, int]
    newText: str

class GenerateResponse(BaseModel):
    edits: List[EditModel]
    warnings: List[str] = []

# ---- Utilities ----
def offset_to_pos(text: str, offset: int) -> Dict[str, int]:
    """Convert absolute character offset into zero-based {line, column}."""
    if offset < 0:
        offset = 0
    if offset > len(text):
        offset = len(text)
    # faster: count newlines up to offset
    # slicing is simple and robust for moderate-size files
    prefix = text[:offset]
    lines = prefix.split("\n")
    line = len(lines) - 1
    column = len(lines[-1])
    return {"line": line, "column": column}

def sanitize_text_for_attr(s: str, max_len: int = 60) -> str:
    """Make a compact label suitable for alt/aria-label: remove excessive whitespace and quote-chars."""
    if not s:
        return ""
    s = s.strip()
    s = re.sub(r'\s+', ' ', s)
    s = s.replace('"', "'")  # avoid breaking attributes
    if len(s) > max_len:
        s = s[:max_len].rstrip() + "..."
    return s

# ---- Heuristic guessers (no ML) ----
def guess_alt_from_src(src: str) -> str:
    """Guess a human-friendly alt from filename or src path."""
    if not src:
        return "Image"
    src = src.split("?")[0].split("#")[0]  # strip query/fragment
    # If data URI or base64, we cannot infer from filename
    if src.startswith("data:"):
        return "Image"
    filename = os.path.basename(src)
    name = os.path.splitext(filename)[0]
    # replace separators
    name = re.sub(r'[_\-\+]+', ' ', name)
    name = re.sub(r'\b(img|image|photo|picture)\b', '', name, flags=re.I)
    name = re.sub(r'\d+', '', name)  # strip numbers
    name = sanitize_text_for_attr(name).strip()
    if not name:
        return "Image"
    # Capitalize first letter
    return name[0].upper() + name[1:]

def guess_button_label_from_attrs(attrs: str, inner_html: str) -> str:
    """Guess a label for buttons using classes/ids/inner content or SVG/icon hints."""
    attrs_l = attrs.lower()
    inner_l = (inner_html or "").lower()
    # priority: visible text
    visible_text = re.sub(r'<[^>]*>', '', inner_html or '').strip()
    if visible_text:
        return sanitize_text_for_attr(visible_text)

    # class/id hints
    if re.search(r'\b(close|dismiss|cancel|close-btn)\b', attrs_l) or re.search(r'\bclose\b', inner_l):
        return "Close"
    if re.search(r'\b(submit|send|save|confirm)\b', attrs_l):
        return "Submit"
    if re.search(r'\b(search|find)\b', attrs_l):
        return "Search"
    if re.search(r'\b(menu|open-menu|toggle)\b', attrs_l):
        return "Open menu"
    if re.search(r'\b(next|prev|previous)\b', attrs_l):
        return "Next"
    # svg/icon detection
    if re.search(r'<svg\b', inner_html or '', flags=re.I) or re.search(r'\bicon\b', attrs_l):
        return "Icon button"
    # fallback
    return "Button"

def guess_input_label_from_attrs(tag_name: str, attrs: str) -> str:
    """Guess an input label from type/name/id/class attributes."""
    attrs_l = attrs.lower()
    # look for type
    type_m = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    name_m = re.search(r'\bname\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    id_m = re.search(r'\bid\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
    class_m = re.search(r'\bclass\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)

    type_val = type_m.group(1).lower() if type_m else ""
    name_val = name_m.group(1) if name_m else ""
    id_val = id_m.group(1) if id_m else ""
    class_val = class_m.group(1) if class_m else ""

    if "email" in type_val or "email" in name_val or "email" in id_val or "email" in class_val:
        return "Email address"
    if "password" in type_val or "password" in name_val or "password" in id_val:
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
        # try to choose the most descriptive token
        token = class_val.split()[0]
        return sanitize_text_for_attr(token.replace("-", " "))
    # generic fallback
    return "Input field"

def guess_link_label_from_href(href: str, inner_html: str) -> str:
    """Guess a label for a link using href, inner content, or domain hints."""
    if not href:
        # fallback to inner text if available
        visible = re.sub(r'<[^>]+>', '', inner_html or '').strip()
        if visible:
            return sanitize_text_for_attr(visible)
        return "Link"
    href_l = href.lower()
    # obvious social domains
    for name in ("twitter", "facebook", "linkedin", "instagram", "youtube", "github"):
        if name in href_l:
            return f"Visit {name.capitalize()}"
    # if internal route
    if href_l.startswith("/"):
        part = href_l.strip("/").split("/")[0] or "page"
        return "Go to " + sanitize_text_for_attr(part.replace("-", " "))
    # external domain short label
    host = re.sub(r"https?://(www\.)?", "", href_l).split("/")[0]
    host = host.split(":")[0]
    host = host.split(".")[-2] if "." in host else host
    host = sanitize_text_for_attr(host)
    if host:
        return f"Visit {host.capitalize()}"
    return "Visit link"

# ---- ML helpers (BLIP for base64 inline images) ----
def ensure_blip_loaded():
    global BLIP_PROCESSOR, BLIP_MODEL
    if not ml_available:
        raise RuntimeError("ML dependencies are not installed (transformers/Pillow/torch).")
    if BLIP_PROCESSOR is None or BLIP_MODEL is None:
        BLIP_PROCESSOR = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        BLIP_MODEL = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

def caption_base64_image(b64: str) -> str:
    """Return a caption for a base64-encoded image using BLIP if available, else a fallback."""
    try:
        # allow either plain base64 or data: URI
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        from PIL import Image
        import base64
        from io import BytesIO
        img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")
        ensure_blip_loaded()
        inputs = BLIP_PROCESSOR(images=img, return_tensors="pt")
        out = BLIP_MODEL.generate(**inputs, max_length=30)
        caption = BLIP_PROCESSOR.decode(out[0], skip_special_tokens=True)
        return sanitize_text_for_attr(caption, max_len=100)
    except Exception:
        return "Image"

# ---- Rule implementations ----
def rule_image_alt(code: str, mode: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Find <img> tags without alt and propose intelligent alt text."""
    for m in re.finditer(r"<img\b([^>]*)\/?>", code, flags=re.IGNORECASE):
        attrs = m.group(1) or ""
        if re.search(r'\balt\s*=\s*["\']', attrs, flags=re.I):
            continue
        # src detection
        src_m = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        src_val = src_m.group(1) if src_m else ""
        # attempt ML caption for inline base64 in ML mode
        alt_text = "Image"
        if mode == "ml" and ml_available and src_val.startswith("data:"):
            try:
                alt_text = caption_base64_image(src_val)
            except Exception:
                alt_text = "Image"
        else:
            alt_text = guess_alt_from_src(src_val)
        alt_text = sanitize_text_for_attr(alt_text)
        insert_pos = m.start() + (m.group(0).rfind(">") if m.group(0).rfind(">") >= 0 else len(m.group(0)))
        edits.append({
            "start": offset_to_pos(code, insert_pos),
            "end": offset_to_pos(code, insert_pos),
            "newText": f' alt="{alt_text}"'
        })

def rule_button_name(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Find <button> without accessible name and propose aria-labels using clues."""
    for m in re.finditer(r"<button\b([^>]*)>([\s\S]*?)</button>", code, flags=re.IGNORECASE):
        attrs = m.group(1) or ""
        inner = m.group(2) or ""
        # skip if accessible name exists
        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I) or re.search(r'\baria-labelledby\s*=\s*["\']', attrs, flags=re.I) or re.search(r'\btitle\s*=\s*["\']', attrs, flags=re.I):
            continue
        # if visible text exists, skip
        visible_text = re.sub(r'<[^>]*>', '', inner or '').strip()
        if visible_text:
            continue
        label = guess_button_label_from_attrs(attrs, inner)
        insert_pos = m.start() + (m.group(0).find(">") if m.group(0).find(">") >= 0 else 0)
        edits.append({
            "start": offset_to_pos(code, insert_pos),
            "end": offset_to_pos(code, insert_pos),
            "newText": f' aria-label="{label}"'
        })

def rule_input_label(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Add aria-labels for unlabeled form controls (inputs/selects/textareas)."""
    for m in re.finditer(r"<(input|select|textarea)\b([^>]*)\/?>", code, flags=re.IGNORECASE):
        tag = m.group(1).lower()
        attrs = m.group(2) or ""
        # skip if aria label exists
        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I) or re.search(r'\baria-labelledby\s*=\s*["\']', attrs, flags=re.I):
            continue
        # if id present and a matching <label for="id"> exists somewhere, skip
        id_m = re.search(r'\bid\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        if id_m:
            idv = id_m.group(1)
            if re.search(rf'<label\b[^>]*\bfor\s*=\s*["\']{re.escape(idv)}["\']', code, flags=re.I):
                continue
        label = guess_input_label_from_attrs(tag, attrs)
        match_str = m.group(0)
        insert_pos = m.start() + (match_str.rfind(">") if match_str.rfind(">") >= 0 else len(match_str))
        edits.append({
            "start": offset_to_pos(code, insert_pos),
            "end": offset_to_pos(code, insert_pos),
            "newText": f' aria-label="{label}"'
        })

def rule_link_name(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Add missing accessible name for anchors: prefer alt for image-only links, else aria-label on <a>."""
    for m in re.finditer(r"<a\b([^>]*)>([\s\S]*?)</a>", code, flags=re.IGNORECASE):
        attrs = m.group(1) or ""
        inner = m.group(2) or ""
        # skip if aria-label exists
        if re.search(r'\baria-label\s*=\s*["\']', attrs, flags=re.I):
            continue
        # if visible inner text, skip
        visible = re.sub(r'<[^>]*>', '', inner or '').strip()
        if visible:
            continue
        # if inner contains an <img> without alt, add alt to the <img>
        img_m = re.search(r"<img\b([^>]*)\/?>", inner, flags=re.IGNORECASE)
        if img_m:
            img_attrs = img_m.group(1) or ""
            if not re.search(r'\balt\s*=\s*["\']', img_attrs, flags=re.I):
                # compute insertion point in the global code
                inner_start = m.start(2)
                img_index_in_inner = inner.find(img_m.group(0))
                absolute_img_start = inner_start + img_index_in_inner
                insert_pos = absolute_img_start + (img_m.group(0).rfind(">") if img_m.group(0).rfind(">") >= 0 else len(img_m.group(0)))
                # try to create a better alt if src present
                src_m = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', img_attrs, flags=re.I)
                src_val = src_m.group(1) if src_m else ""
                alt_guess = guess_alt_from_src(src_val)
                edits.append({
                    "start": offset_to_pos(code, insert_pos),
                    "end": offset_to_pos(code, insert_pos),
                    "newText": f' alt="{alt_guess}"'
                })
                continue
        # else try to guess label from href or inner context
        href_m = re.search(r'\bhref\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        href_val = href_m.group(1) if href_m else ""
        label = guess_link_label_from_href(href_val, inner)
        open_tag_end = m.start() + (m.group(0).find(">") if m.group(0).find(">") >= 0 else 0)
        edits.append({
            "start": offset_to_pos(code, open_tag_end),
            "end": offset_to_pos(code, open_tag_end),
            "newText": f' aria-label="{label}"'
        })

def rule_duplicate_id(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Append -1, -2 ... to duplicate id attribute values (leave first occurrence intact)."""
    occurrences = []
    for m in re.finditer(r'\bid\s*=\s*["\']([^"\']+)["\']', code, flags=re.IGNORECASE):
        idval = m.group(1)
        # find index of value start inside match: locate the first quote then the value
        match_str = m.group(0)
        # approximate: value starts at m.start() + match_str.index(idval)
        idx = m.start() + match_str.lower().find(idval.lower())
        occurrences.append((idval, idx))
    groups = {}
    for idval, idx in occurrences:
        groups.setdefault(idval, []).append(idx)
    for idval, arr in groups.items():
        if len(arr) <= 1:
            continue
        for i, abs_idx in enumerate(arr):
            if i == 0:
                continue
            new_id = f"{idval}-{i}"
            edits.append({
                "start": offset_to_pos(code, abs_idx),
                "end": offset_to_pos(code, abs_idx + len(idval)),
                "newText": new_id
            })

def rule_heading_order(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Detect heading level skips and rename offending headings to lastLevel+1 (open + close)."""
    headings = []
    for m in re.finditer(r'<(h[1-6])\b([^>]*)>([\s\S]*?)</(h[1-6])>', code, flags=re.IGNORECASE):
        open_tag = m.group(1).lower()
        level = int(open_tag[1])
        headings.append((m.start(), m.group(0), level))
    last = None
    for start_pos, block, level in headings:
        if last is not None and level > last + 1:
            target = last + 1
            # find opening name inside block
            open_rel = block.find(f"h{level}")
            open_abs = start_pos + open_rel
            # find closing tag name (last occurrence)
            close_rel = block.rfind(f"</h{level}>")
            close_abs = start_pos + close_rel + 2  # plus 2 to start at 'h'
            edits.append({
                "start": offset_to_pos(code, open_abs),
                "end": offset_to_pos(code, open_abs + len(f"h{level}")),
                "newText": f"h{target}"
            })
            edits.append({
                "start": offset_to_pos(code, close_abs),
                "end": offset_to_pos(code, close_abs + len(f"h{level}")),
                "newText": f"h{target}"
            })
            warnings.append(f"Changed heading level h{level} -> h{target} at offset {start_pos} to fix order.")
        last = level

def rule_no_positive_tabindex(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Remove positive tabindex values by replacing them with 0 or removing (here: replace with 0)."""
    for m in re.finditer(r'\btabindex\s*=\s*["\']([0-9]+)["\']', code, flags=re.IGNORECASE):
        try:
            val = int(m.group(1))
            if val > 0:
                # replace numeric value only
                val_start = m.start(1)
                edits.append({
                    "start": offset_to_pos(code, val_start),
                    "end": offset_to_pos(code, val_start + len(m.group(1))),
                    "newText": "0"
                })
        except Exception:
            continue

def rule_html_lang(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Add lang='en' to <html> if missing."""
    m = re.search(r'<html\b([^>]*)>', code, flags=re.IGNORECASE)
    if m:
        attrs = m.group(1) or ""
        if not re.search(r'\blang\s*=\s*["\']', attrs, flags=re.I):
            insert_pos = m.start() + m.group(0).rfind(">")
            edits.append({
                "start": offset_to_pos(code, insert_pos),
                "end": offset_to_pos(code, insert_pos),
                "newText": ' lang="en"'
            })

def rule_form_control_has_label(code: str, edits: List[Dict[str, Any]], warnings: List[str]):
    """Supplementary pass for form controls inside forms - add aria-label placeholders where no label exists."""
    # Re-use input_label logic but only inside forms or where name/id/class hints suggest it's a control
    # To keep it simple, we just reuse the input_label heuristics (already present).
    pass  # intentionally left as placeholder for future refinement

# ---- Main endpoint ----
@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    code = req.code or ""
    mode = (req.mode or "heuristic").lower()
    edits: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # sanity guard
    MAX_CHARS = 600_000
    if len(code) > MAX_CHARS:
        warnings.append("Input truncated due to size.")
        code = code[:MAX_CHARS]

    # Apply rules in priority order (images first -> inputs/links/buttons -> duplicate-id -> headings -> tabindex/lang)
    rule_image_alt(code, mode, edits, warnings)
    rule_input_label(code, edits, warnings)
    rule_link_name(code, edits, warnings)
    rule_button_name(code, edits, warnings)
    rule_duplicate_id(code, edits, warnings)
    rule_heading_order(code, edits, warnings)
    rule_no_positive_tabindex(code, edits, warnings)
    rule_html_lang(code, edits, warnings)
    rule_form_control_has_label(code, edits, warnings)
    # aria-hidden checks: not auto-fixing, just warn
    # simplified: if aria-hidden present with tab-index or focusable children nearby, warn
    for m in re.finditer(r'<([a-z0-9\-]+)\b([^>]*)aria-hidden\s*=\s*["\']true["\']([^>]*)>', code, flags=re.IGNORECASE):
        start = m.start()
        # scan a small window after the tag for focusable tokens
        snippet = code[m.end():m.end()+400]
        if re.search(r'(tabindex\s*=\s*["\']0["\']|href=|<button\b|<a\b|<input\b|<select\b|<textarea\b)', snippet, flags=re.IGNORECASE):
            warnings.append("aria-hidden element contains focusable children; consider removing aria-hidden or making content non-focusable.")

    # deduplicate identical edits (start+end+newText)
    unique = []
    seen = set()
    for e in edits:
        key = (e["start"]["line"], e["start"]["column"], e["end"]["line"], e["end"]["column"], e["newText"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    edits = unique

    # Sort edits by position (descending) to make client application straightforward
    edits.sort(key=lambda e: (e["start"]["line"], e["start"]["column"]), reverse=True)

    return {"edits": edits, "warnings": warnings}
