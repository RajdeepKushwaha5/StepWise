"""PDF rendering for verified reports."""
from __future__ import annotations

import base64
import io
from datetime import date
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _fmt_num(n: float) -> str:
    if float(n).is_integer():
        return f"{int(n):,}"
    return f"{n:,.2f}".rstrip("0").rstrip(".")


def _fmt_value(key: str, value: Any) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, list):
        shown = ", ".join(
            _fmt_num(float(x)) if isinstance(x, (int, float)) else str(x)
            for x in value[:6]
        )
        return f"[{shown}{', ...' if len(value) > 6 else ''}]"
    if not isinstance(value, (int, float)):
        # symbolic results (derivatives, solutions, simplified forms) are strings
        return str(value)
    return _fmt_num(float(value))


def _pretty_key(key: str) -> str:
    return key.replace("_", " ").replace(" tex", " (LaTeX)")


def render_report_pdf(report: dict[str, Any]) -> bytes:
    """Return a polished, self-contained PDF for a verified report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title=f"StepWise document - {report.get('label', 'Problem')}",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Tiny", fontSize=7.5, leading=10, textColor=colors.HexColor("#64748b")))
    styles.add(ParagraphStyle(name="Kicker", fontSize=8, leading=10, textColor=colors.HexColor("#059669"), spaceAfter=4))
    styles.add(ParagraphStyle(name="StepWiseCode", fontName="Courier", fontSize=6.2, leading=8, textColor=colors.HexColor("#d1fae5")))

    story: list[Any] = []
    story.append(Paragraph(escape(str(report.get("document_type") or "STEPWISE WORKED SOLUTION")), styles["Kicker"]))
    story.append(Paragraph(escape(str(report.get("label") or "Problem")), styles["Title"]))
    generated = escape(str(report.get("generated_on") or ""))
    story.append(Paragraph(f"Generated {generated} · Every displayed result computed by Wolfram Language", styles["Tiny"]))
    story.append(Spacer(1, 0.18 * inch))

    sections = report.get("sections", [])
    for section in sections:
        section_title = escape(str(section.get("title", section.get("tool", "Section"))))
        block: list[Any] = [Paragraph(section_title, styles["Heading2"])]
        rows = [["Metric", "Verified value"]]
        for key, value in section.get("values", {}).items():
            rows.append([_pretty_key(key), _fmt_value(key, value)])
        table = Table(rows, colWidths=[2.5 * inch, 4.1 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#047857")),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#dbe5e8")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        block.append(table)

        chart = section.get("chart_png_base64")
        if chart:
            try:
                img_bytes = io.BytesIO(base64.b64decode(chart))
                img = Image(img_bytes, width=4.9 * inch, height=2.8 * inch, kind="proportional")
                block.extend([Spacer(1, 0.12 * inch), img])
            except Exception:  # noqa: BLE001 - chart is nice-to-have, table remains authoritative
                pass
        block.append(Spacer(1, 0.22 * inch))
        story.append(KeepTogether(block))

    story.append(Paragraph("Wolfram provenance appendix", styles["Heading2"]))
    story.append(
        Paragraph(
            "The Wolfram Language code below is the exact computation behind each step above. "
            "Nothing here was written by a language model.",
            styles["Tiny"],
        )
    )
    story.append(Spacer(1, 0.08 * inch))
    for section in sections:
        code = section.get("wolfram_code")
        if not code:
            continue
        section_title = escape(str(section.get("title", section.get("tool", "Section"))))
        story.append(Paragraph(section_title, styles["Heading4"]))
        code_text = escape(code).replace("\n", "<br/>")
        code_table = Table([[Paragraph(code_text, styles["StepWiseCode"])]], colWidths=[6.7 * inch])
        code_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#020617")),
                    ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#334155")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(code_table)
        story.append(Spacer(1, 0.12 * inch))

    story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph("Every displayed result was computed by Wolfram Language before it was explained. StepWise · OSC AI Build 1.0.", styles["Tiny"]))
    doc.build(story)
    return buf.getvalue()


def render_study_report_pdf(title: str, items: list[dict[str, Any]]) -> bytes:
    """Return a compact multi-problem study report from previously computed results."""
    report = {
        "label": title or "StepWise study report",
        "document_type": "STEPWISE STUDY REPORT",
        "generated_on": date.today().isoformat(),
        "sections": [
            {
                "tool": item.get("tool") or "saved_result",
                "title": item.get("question") or "Saved problem",
                "values": item.get("values") or {},
                "chart_png_base64": None,
                "wolfram_code": item.get("wolfram_code"),
            }
            for item in items
        ],
    }
    return render_report_pdf(report)
