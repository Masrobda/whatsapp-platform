#!/usr/bin/env python3
# src/scripts/generate_campaign_report.py
# Génération de rapports PDF professionnels pour les campagnes
# Usage: python3 generate_campaign_report.py --data '{"campaign":...}' --output /tmp/report.pdf
# Ou:   echo '{"campaign":...}' | python3 generate_campaign_report.py --output /tmp/report.pdf

import sys
import json
import argparse
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.lib.enums import TA_CENTER

# ============================================================
# PALETTE NUMERICEXPORT
# ============================================================
GREEN_DARK   = colors.HexColor('#1e5a2f')
GREEN_MAIN   = colors.HexColor('#2d7a3e')
GREEN_LIGHT  = colors.HexColor('#8bc34a')
GREEN_BG     = colors.HexColor('#f0f7f3')
BLUE_ACCENT  = colors.HexColor('#1976d2')
ORANGE       = colors.HexColor('#f57c00')
RED_ERR      = colors.HexColor('#c62828')
NEUTRAL_100  = colors.HexColor('#f0f7f3')
NEUTRAL_200  = colors.HexColor('#e5ebe8')
NEUTRAL_600  = colors.HexColor('#4a5852')
NEUTRAL_800  = colors.HexColor('#1a1f1d')
WHITE        = colors.white
GRAY_TEXT    = colors.HexColor('#6b7c74')

W, H = A4  # 595.27, 841.89 pts

def safe_float(val):
    """Convertit une valeur en float, retourne 0.0 si impossible."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0

def safe_int(val):
    """Convertit une valeur en int, retourne 0 si impossible."""
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return 0

def format_num(n):
    """Formate un nombre avec séparateur de milliers (espaces)."""
    n = safe_int(n)
    return f"{n:,}".replace(',', ' ') if n != 0 else '0'

def format_pct(n, d):
    """Calcule un pourcentage."""
    n = safe_float(n)
    d = safe_float(d)
    if d == 0:
        return '0.0%'
    return f"{(n/d*100):.1f}%"

def format_cost(usd):
    """Formate un coût USD en FCFA."""
    usd = safe_float(usd)
    fcfa = int(usd * 620)
    return f"${usd:.2f} ({fcfa:,} FCFA)".replace(',', ' ')

def parse_date(d):
    """Parse une date ISO et retourne une chaîne lisible."""
    if not d:
        return '—'
    try:
        dt = datetime.fromisoformat(d.replace('Z', '+00:00'))
        return dt.strftime('%d/%m/%Y %H:%M')
    except:
        return str(d)

# ============================================================
# STYLES
# ============================================================
def make_styles():
    s = {}
    s['title'] = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=22,
        textColor=GREEN_DARK, spaceAfter=4, leading=26)
    s['subtitle'] = ParagraphStyle('subtitle', fontName='Helvetica', fontSize=12,
        textColor=GRAY_TEXT, spaceAfter=16, leading=16)
    s['section'] = ParagraphStyle('section', fontName='Helvetica-Bold', fontSize=13,
        textColor=GREEN_DARK, spaceBefore=16, spaceAfter=8, leading=16,
        borderPad=4)
    s['body'] = ParagraphStyle('body', fontName='Helvetica', fontSize=10,
        textColor=NEUTRAL_800, leading=14, spaceAfter=6)
    s['small'] = ParagraphStyle('small', fontName='Helvetica', fontSize=8,
        textColor=GRAY_TEXT, leading=11)
    s['kpi_val'] = ParagraphStyle('kpi_val', fontName='Helvetica-Bold', fontSize=20,
        textColor=GREEN_MAIN, alignment=TA_CENTER, leading=24)
    s['kpi_lbl'] = ParagraphStyle('kpi_lbl', fontName='Helvetica', fontSize=8,
        textColor=GRAY_TEXT, alignment=TA_CENTER, leading=11)
    s['table_header'] = ParagraphStyle('table_header', fontName='Helvetica-Bold', fontSize=8,
        textColor=GREEN_DARK, alignment=TA_CENTER)
    s['table_cell'] = ParagraphStyle('table_cell', fontName='Helvetica', fontSize=9,
        textColor=NEUTRAL_800, leading=12)
    s['footer'] = ParagraphStyle('footer', fontName='Helvetica', fontSize=8,
        textColor=GRAY_TEXT, alignment=TA_CENTER)
    return s

# ============================================================
# COMPOSANTS GRAPHIQUES
# ============================================================
def make_header(campaign):
    d = Drawing(W - 4*cm, 60)
    d.add(Rect(0, 0, W - 4*cm, 60, fillColor=GREEN_MAIN, strokeColor=None))
    d.add(String(16, 36, 'RAPPORT DE CAMPAGNE', fontName='Helvetica-Bold', fontSize=16, fillColor=WHITE))
    d.add(String(16, 18, campaign.get('name', '')[:50], fontName='Helvetica', fontSize=11, fillColor=colors.HexColor('#d4edda')))
    status_text = campaign.get('status', '').upper()
    d.add(String(W - 4*cm - 90, 36, status_text, fontName='Helvetica-Bold', fontSize=10, fillColor=GREEN_LIGHT))
    return d

def make_kpi_table(stats, styles):
    total = safe_int(stats.get('total_contacts', 0))
    sent = safe_int(stats.get('sent_count', 0))
    delivered = safe_int(stats.get('delivered_count', 0))
    read = safe_int(stats.get('read_count', 0))

    def kpi_cell(val, label):
        return [Paragraph(str(val), styles['kpi_val']), Paragraph(label, styles['kpi_lbl'])]

    data = [[
        kpi_cell(format_num(total), 'Contacts ciblés'),
        kpi_cell(format_num(delivered), 'Messages livrés'),
        kpi_cell(format_pct(delivered, sent), 'Taux de livraison'),
        kpi_cell(format_pct(read, delivered), 'Taux de lecture'),
    ]]

    t = Table(data, colWidths=[(W - 4*cm) / 4] * 4, rowHeights=60)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NEUTRAL_100),
        ('BOX', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('INNERGRID', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    return t

def make_bar_chart(daily_stats):
    if not daily_stats:
        return Spacer(1, 80)

    recent = daily_stats[-7:]
    labels = [d.get('stat_date', '')[-5:].replace('-', '/') for d in recent]
    delivered_vals = [safe_int(d.get('delivered', 0)) for d in recent]
    read_vals = [safe_int(d.get('read', 0)) for d in recent]

    drawing = Drawing(W - 4*cm, 200)
    chart = VerticalBarChart()
    chart.x = 40
    chart.y = 30
    chart.height = 150
    chart.width = W - 4*cm - 80
    chart.data = [delivered_vals, read_vals]
    chart.strokeColor = None
    chart.groupSpacing = 4
    chart.barSpacing = 1

    chart.bars[0].fillColor = GREEN_MAIN
    chart.bars[1].fillColor = GREEN_LIGHT

    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontName = 'Helvetica'
    chart.categoryAxis.labels.fontSize = 8
    chart.categoryAxis.labels.fillColor = GRAY_TEXT
    chart.categoryAxis.strokeColor = NEUTRAL_200

    chart.valueAxis.labels.fontName = 'Helvetica'
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labels.fillColor = GRAY_TEXT
    chart.valueAxis.strokeColor = NEUTRAL_200
    chart.valueAxis.gridStrokeColor = NEUTRAL_200

    drawing.add(chart)

    for i, (color, label) in enumerate([(GREEN_MAIN, 'Livrés'), (GREEN_LIGHT, 'Lus')]):
        x_pos = chart.x + i * 80
        drawing.add(Rect(x_pos, 10, 10, 10, fillColor=color, strokeColor=None))
        drawing.add(String(x_pos + 14, 11, label, fontName='Helvetica', fontSize=8, fillColor=GRAY_TEXT))

    return drawing

def make_funnel_table(stats, styles):
    total = safe_int(stats.get('total_contacts', 0))
    sent = safe_int(stats.get('sent_count', 0))
    delivered = safe_int(stats.get('delivered_count', 0))
    read = safe_int(stats.get('read_count', 0))
    replied = safe_int(stats.get('replied_count', 0))
    failed = safe_int(stats.get('failed_count', 0))

    rows = [
        ['Étape', 'Nombre', 'Taux / Total', 'Conversion'],
        ['Contacts ciblés', format_num(total), '100%', '—'],
        ['Messages envoyés', format_num(sent), format_pct(sent, total), '→'],
        ['Livrés', format_num(delivered), format_pct(delivered, total), format_pct(delivered, sent)],
        ['Lus', format_num(read), format_pct(read, total), format_pct(read, delivered)],
        ['Réponses', format_num(replied), format_pct(replied, sent), format_pct(replied, read)],
        ['Échecs', format_num(failed), format_pct(failed, sent), '—'],
    ]

    col_widths = [160, 80, 100, 100]
    t = Table(rows, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN_MAIN),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, NEUTRAL_100]),
        ('GRID', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('PADDING', (0,0), (-1,-1), 7),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TEXTCOLOR', (1,3), (1,3), GREEN_MAIN),
        ('FONTNAME', (1,3), (1,3), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1,6), (1,6), RED_ERR),
        ('FONTNAME', (1,6), (1,6), 'Helvetica-Bold'),
    ]))
    return t

def make_info_table(campaign, styles):
    rows = [
        ['Champ', 'Valeur'],
        ['Nom', campaign.get('name', '—')],
        ['Type', campaign.get('campaign_type', '—')],
        ['Template', campaign.get('template_name', '—')],
        ['Numéro émetteur', campaign.get('phone_number', '—')],
        ['Mode d\'envoi', campaign.get('send_mode', '—')],
        ['Vitesse', f"{campaign.get('rate_per_minute', 30)} msg/min"],
        ['Catégorie', campaign.get('category', '—')],
        ['Priorité', f"{campaign.get('priority', 5)}/10"],
        ['Créée le', parse_date(campaign.get('created_at'))],
        ['Lancée le', parse_date(campaign.get('started_at'))],
        ['Terminée le', parse_date(campaign.get('completed_at'))],
        ['Coût estimé', format_cost(campaign.get('estimated_cost', 0))],
        ['Coût réel', format_cost(campaign.get('actual_cost', 0))],
    ]

    t = Table(rows, colWidths=[160, 300])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN_DARK),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, NEUTRAL_100]),
        ('GRID', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('PADDING', (0,0), (-1,-1), 6),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,1), (0,-1), NEUTRAL_600),
    ]))
    return t

def make_contacts_sample(contacts, styles):
    if not contacts:
        return Paragraph("Aucun contact à afficher.", styles['small'])

    headers = ['Téléphone', 'Nom', 'Statut', 'Envoyé à', 'Livré à', 'Lu à']
    status_map = {
        'delivered': '✓ Livré', 'read': '✓✓ Lu', 'sent': '→ Envoyé',
        'failed': '✗ Échoué', 'pending': '⏳ En attente', 'skipped': '⊘ Ignoré'
    }

    rows = [headers]
    for c in contacts[:20]:
        rows.append([
            c.get('phone_number', ''),
            (c.get('name') or '—')[:20],
            status_map.get(c.get('status', ''), c.get('status', '—')),
            parse_date(c.get('sent_at'))[:16] if c.get('sent_at') else '—',
            parse_date(c.get('delivered_at'))[:16] if c.get('delivered_at') else '—',
            parse_date(c.get('read_at'))[:16] if c.get('read_at') else '—',
        ])

    col_widths = [100, 90, 65, 80, 80, 75]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN_MAIN),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, NEUTRAL_100]),
        ('GRID', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    return t

# ============================================================
# GÉNÉRATION DU PDF
# ============================================================
def generate_pdf(data, output_path):
    campaign = data.get('campaign', {})
    stats = data.get('stats', campaign)
    daily_stats = data.get('daily_stats', [])
    contacts = data.get('contacts', [])
    exported_by = data.get('exported_by', 'NumericExport')
    export_date = datetime.now().strftime('%d/%m/%Y à %H:%M')

    styles = make_styles()
    story = []

    # Page 1
    story.append(make_header(campaign))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(f"Rapport généré le {export_date} · Exporté par {exported_by}", styles['small']))
    story.append(HRFlowable(width="100%", thickness=0.5, color=NEUTRAL_200, spaceAfter=10))

    story.append(Paragraph("Indicateurs clés de performance", styles['section']))
    story.append(make_kpi_table(stats, styles))
    story.append(Spacer(1, 0.5*cm))

    total_sent = safe_int(stats.get('sent_count', 0)) or 1
    actual_cost = safe_float(stats.get('actual_cost', 0))
    data_row2 = [[
        [Paragraph(format_cost(actual_cost), styles['kpi_val']), Paragraph("Coût réel", styles['kpi_lbl'])],
        [Paragraph(f"${(actual_cost/total_sent):.4f}", styles['kpi_val']), Paragraph("Coût / message livré", styles['kpi_lbl'])],
        [Paragraph(format_num(stats.get('failed_count', 0)), styles['kpi_val']), Paragraph("Messages échoués", styles['kpi_lbl'])],
        [Paragraph(format_num(stats.get('optout_count', 0)), styles['kpi_val']), Paragraph("Désabonnements", styles['kpi_lbl'])],
    ]]
    t2 = Table(data_row2, colWidths=[(W - 4*cm) / 4] * 4, rowHeights=60)
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NEUTRAL_100),
        ('BOX', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('INNERGRID', (0,0), (-1,-1), 0.5, NEUTRAL_200),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (2,0), (2,0), RED_ERR),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.5*cm))

    if daily_stats:
        story.append(Paragraph("Évolution sur 7 jours", styles['section']))
        story.append(make_bar_chart(daily_stats))
        story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Entonnoir de conversion", styles['section']))
    story.append(make_funnel_table(stats, styles))
    story.append(PageBreak())

    # Page 2
    story.append(Paragraph("Détails de la campagne", styles['section']))
    story.append(make_info_table(campaign, styles))
    story.append(Spacer(1, 0.6*cm))

    if contacts:
        story.append(Paragraph(f"Échantillon des contacts ({min(20, len(contacts))} premiers sur {format_num(len(contacts))})", styles['section']))
        story.append(make_contacts_sample(contacts, styles))
        story.append(Spacer(1, 0.4*cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=NEUTRAL_200, spaceBefore=16))
    story.append(Paragraph(f"© NumericExport — Rapport confidentiel — {export_date}", styles['footer']))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GRAY_TEXT)
        canvas.drawRightString(W - 2*cm, 1.5*cm, f"Page {doc.page}")
        canvas.setStrokeColor(NEUTRAL_200)
        canvas.line(2*cm, 1.8*cm, W - 2*cm, 1.8*cm)
        canvas.setFillColor(GREEN_MAIN)
        canvas.drawString(2*cm, 1.5*cm, "NumericExport")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2.5*cm,
        title=f"Rapport Campagne — {campaign.get('name', '')}",
        author="NumericExport",
        subject="Rapport de campagne WhatsApp"
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF généré: {output_path}", flush=True)

# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Génère un rapport PDF de campagne')
    parser.add_argument('--data', help='JSON des données (optionnel, sinon lire stdin)')
    parser.add_argument('--output', required=True, help='Chemin du fichier PDF de sortie')
    args = parser.parse_args()

    try:
        if args.data:
            data = json.loads(args.data)
        else:
            data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Erreur JSON: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        generate_pdf(data, args.output)
    except Exception as e:
        print(f"Erreur génération PDF: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
