"""Genera un PDF individual por persona con el desglose de su comisión."""
from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import ComputedCommission


def _money(v: float) -> str:
    return f"$ {v:,.0f}".replace(",", ".")


def build_individual_pdf(res: ComputedCommission) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter, rightMargin=1.8 * cm, leftMargin=1.8 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title2", parent=styles["Title"], fontSize=16, textColor=colors.HexColor("#1F4E78")
    )
    body = styles["BodyText"]

    story = []
    story.append(Paragraph("Comprobante de Comisiones — Qurii", title))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"<b>Nombre:</b> {res.nombre}", body))
    story.append(Paragraph(f"<b>Cédula:</b> {res.cedula}", body))
    story.append(Paragraph(f"<b>Rol:</b> {res.role.value} — {res.company.value}", body))
    story.append(Paragraph(f"<b>Estructura:</b> {res.structure_id}", body))
    story.append(Spacer(1, 12))

    data = [
        ["Concepto", "Valor"],
        ["Cantidad de contratos", str(res.cantidad_contratos)],
        ["% Persistencia", f"{res.porcentaje_persistencia:.2%}"],
        ["% Segundo Pago", f"{res.porcentaje_segundo_pago:.2%}"],
        ["Monto base comisionable", _money(res.monto_base_comisionable)],
        ["% Comisión aplicado", f"{res.porcentaje_comision:.4%}"],
        ["Factor variable (persistencia)", f"{res.factor_variable_persistencia:.2%}"],
        ["Factor Segundo Pago", f"{res.factor_segundo_pago:.0%}"],
        ["Comisión base", _money(res.valor_comision_base)],
        ["Comisión final", _money(res.valor_comision_final)],
        ["Garantizado", _money(res.valor_garantizado)],
        ["Bono", _money(res.valor_bono_final)],
        ["Ajuste manual", _money(res.ajuste_manual)],
        ["TOTAL a pagar", _money(res.valor_total_a_pagar)],
    ]
    t = Table(data, colWidths=[9 * cm, 6 * cm])
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E78")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E8F1FB")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(t)
    story.append(Spacer(1, 14))

    if res.notas:
        story.append(Paragraph("<b>Notas del cálculo</b>", body))
        for n in res.notas:
            story.append(Paragraph(f"• {n}", body))

    if res.motivo_ajuste:
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Motivo del ajuste manual:</b> {res.motivo_ajuste}", body))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue()
