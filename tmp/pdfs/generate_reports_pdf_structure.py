from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/pdf/daily-sales-report-th-sarabun.pdf"
FONT_REGULAR = str(ROOT / "tmp/pdfs/fonts/Sarabun-Regular.ttf")
FONT_BOLD = str(ROOT / "tmp/pdfs/fonts/Sarabun-Bold.ttf")

PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN = 14 * mm
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
REPORT_WIDTH = CONTENT_WIDTH - (6 * mm)

INK = colors.black
MUTED = colors.HexColor("#444444")
BORDER = colors.HexColor("#777777")
HEADER_FILL = colors.HexColor("#F2F2F2")
WHITE = colors.white

STORE_NAME = "Phetsamut Pharma"
STORE_ADDRESS = "50/524 หมู่ 2 ถนนหนามแดง ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540"
STORE_PHONE = "0963733450"
STORE_TAX_ID = "0115568004551"


pdfmetrics.registerFont(TTFont("Thai", FONT_REGULAR))
pdfmetrics.registerFont(TTFont("ThaiBold", FONT_BOLD))

styles = getSampleStyleSheet()


def style(name, **kwargs):
    kwargs.setdefault("fontName", "Thai")
    kwargs.setdefault("textColor", INK)
    return ParagraphStyle(name, **kwargs)


TITLE = style("title", fontName="ThaiBold", fontSize=18, leading=22, spaceAfter=1, alignment=TA_CENTER)
SUBTITLE = style("subtitle", fontName="ThaiBold", fontSize=11, leading=14)
META = style("meta", fontSize=7.2, leading=9.2, textColor=MUTED)
META_RIGHT = style("meta-right", fontSize=7.2, leading=9.2, textColor=MUTED, alignment=TA_RIGHT)
META_CENTER = style("meta-center", fontSize=8, leading=10.5, textColor=INK, alignment=TA_CENTER)
TOTAL = style("total", fontName="ThaiBold", fontSize=12, leading=15, alignment=TA_LEFT)
DETAIL = style("detail", fontSize=8.5, leading=12, alignment=TA_LEFT)
PILL = style("pill", fontName="ThaiBold", fontSize=7.2, leading=9)
METRIC_LABEL = style("metric-label", fontName="ThaiBold", fontSize=7.1, leading=9)
METRIC_VALUE = style("metric-value", fontName="ThaiBold", fontSize=11, leading=14, textColor=INK)
SECTION = style("section", fontName="ThaiBold", fontSize=10, leading=13)
TABLE_HEADER = style("table-header", fontName="ThaiBold", fontSize=6.3, leading=7.5, alignment=TA_CENTER)
TABLE_LEFT = style("table-left", fontSize=6.7, leading=8.5, alignment=TA_LEFT)
TABLE_CENTER = style("table-center", fontSize=6.7, leading=8.5, alignment=TA_CENTER)
TABLE_RIGHT = style("table-right", fontSize=6.7, leading=8.5, alignment=TA_RIGHT)
TABLE_RIGHT_BOLD = style("table-right-bold", fontName="ThaiBold", fontSize=6.7, leading=8.5, alignment=TA_RIGHT)
NOTE = style("note", fontSize=7, leading=9.5, textColor=INK)
WARNING = style("warning", fontSize=7, leading=9.5, textColor=INK)


def p(text, paragraph_style=TABLE_LEFT):
    return Paragraph(str(text), paragraph_style)


def money(value):
    if value is None:
        return "ไม่มีข้อมูล"
    return f"฿{value:,.2f}"


def number(value):
    return f"{value:,.0f}"


def percent(value):
    if value is None:
        return "ไม่มีข้อมูล"
    return f"{value:,.2f}%"


def page_chrome(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Thai", 6.5)
    canvas.drawString(MARGIN, 7.5 * mm, "ตัวอย่างโครงสร้างเอกสาร - ยังไม่ใช่รายงานจริง")
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 7.5 * mm, f"หน้า {doc.page}")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 11 * mm, PAGE_WIDTH - MARGIN, 11 * mm)
    canvas.restoreState()


def daily_header():
    return [
        p("รายงานยอดขายรายวัน", TITLE),
        Spacer(1, 2 * mm),
        p(STORE_NAME, META_CENTER),
        p(STORE_ADDRESS, META_CENTER),
        p(f"โทรศัพท์ {STORE_PHONE}   เลขประจำตัวผู้เสียภาษี {STORE_TAX_ID}", META_CENTER),
        Spacer(1, 2 * mm),
        p("ช่วงวันที่ 15 กรกฎาคม 2569 - 13 สิงหาคม 2569", META_CENTER),
        p("จัดทำเมื่อ 13 สิงหาคม 2569 เวลา 17:30 น.", META_CENTER),
        Spacer(1, 5 * mm),
    ]


def daily_description():
    detail = Table([
        [p("รายละเอียดรายงาน", PILL), p("สรุปยอดขายและกำไรแยกตามวัน เพื่อใช้ตรวจสอบยอดขาย ส่วนลด ภาษีมูลค่าเพิ่ม และต้นทุนรวมของแต่ละวัน", DETAIL)],
        [p("เงื่อนไขข้อมูล", PILL), p("ใช้ราคาที่บันทึกรวมภาษีมูลค่าเพิ่ม 7% และแสดงเฉพาะบิลที่ชำระแล้วในช่วงวันที่ที่เลือก", DETAIL)],
        [p("ที่มาข้อมูลร้าน", PILL), p("ชื่อร้าน ที่อยู่ โทรศัพท์ และเลขประจำตัวผู้เสียภาษีอ่านจาก การตั้งค่า > ข้อมูลร้าน ณ เวลาส่งออก", DETAIL)],
    ], colWidths=[29 * mm, REPORT_WIDTH - 29 * mm], hAlign="LEFT")
    detail.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return [detail, Spacer(1, 5 * mm)]


def metrics(items):
    cards = []
    for label, value, tone in items:
        value_style = ParagraphStyle(
            f"metric-{label}",
            parent=METRIC_VALUE,
            textColor=INK,
        )
        cards.append([p(label, METRIC_LABEL), p(value, value_style)])
    table = Table([cards], colWidths=[CONTENT_WIDTH / 4] * 4)
    commands = [
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    table.setStyle(TableStyle(commands))
    return [table, Spacer(1, 4 * mm)]


def report_table(headers, rows, widths, alignments, emphasize_columns=()):
    header_row = [p(label, TABLE_HEADER) for label in headers]
    body = []
    for row in rows:
        cells = []
        for index, value in enumerate(row):
            align = alignments[index]
            cell_style = TABLE_LEFT if align == "left" else TABLE_CENTER if align == "center" else TABLE_RIGHT
            if index in emphasize_columns:
                cell_style = TABLE_RIGHT_BOLD
            cells.append(p(value, cell_style))
        body.append(cells)
    table = LongTable([header_row, *body], colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("TEXTCOLOR", (0, 0), (-1, 0), INK),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    table.setStyle(TableStyle(commands))
    return table


def table_title(title, row_count, width=CONTENT_WIDTH):
    table = Table([[
        p(title, SECTION),
        p(f"จำนวน {row_count} รายการ", META_RIGHT),
    ]], colWidths=[width * 0.7, width * 0.3], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def note_box(text, warning=False):
    paragraph_style = WARNING if warning else NOTE
    table = Table([[p(text, paragraph_style)]], colWidths=[CONTENT_WIDTH])
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def daily_page():
    rows = [
        ["13 ส.ค. 2569", "48", "92", money(28940), money(840), money(1838.32), money(28100), money(17640), money(10460), percent(37.22)],
        ["12 ส.ค. 2569", "41", "78", money(24620.5), money(620.5), money(1570.09), money(24000), money(14980), money(9020), percent(37.58)],
        ["11 ส.ค. 2569", "53", "106", money(33210), money(1210), money(2093.46), money(32000), money(20450), money(11550), percent(36.09)],
        ["10 ส.ค. 2569", "37", "69", money(21980.25), money(599.75), money(1398.69), money(21380.5), money(13820), money(7560.5), percent(35.36)],
        ["9 ส.ค. 2569", "44", "87", money(24870.25), money(1000), money(1561.6), money(23870.25), money(15178.25), money(8692), percent(36.41)],
    ]
    widths = [24, 14, 15, 27, 24, 23, 28, 26, 27, 18]
    scale = REPORT_WIDTH / sum(widths)
    total_line = Table([[p(f"ยอดรวมการขาย: {money(128450.75)}", TOTAL)]], colWidths=[REPORT_WIDTH], hAlign="LEFT")
    total_line.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [
        *daily_header(),
        *daily_description(),
        total_line,
        Spacer(1, 5 * mm),
        table_title("รายละเอียดรายวัน", len(rows), REPORT_WIDTH),
        report_table(
            ["วันที่", "บิล", "จำนวนขาย", "มูลค่าสินค้า", "ส่วนลดท้ายบิล", "ภาษีมูลค่าเพิ่ม", "ยอดรับจริง", "ต้นทุน", "กำไร", "กำไรร้อยละ"],
            rows,
            [value * scale for value in widths],
            ["left", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
            emphasize_columns=(6, 8),
        ),
    ]


def bill_page():
    rows = [
        ["SR260813-00048", "13 ส.ค. 14:32", "ลูกค้าทั่วไป", "พร้อมเพย์", money(1280), money(80), money(78.5), money(1200), money(720), money(480), percent(40)],
        ["SR260813-00047", "13 ส.ค. 14:18", "สมศรี ก.", "เงินสด", money(760), money(0), money(49.72), money(760), money(438), money(322), percent(42.37)],
        ["SR260813-00046", "13 ส.ค. 13:54", "ลูกค้าทั่วไป", "บัตรเครดิต", money(1940), money(140), money(117.76), money(1800), money(1125), money(675), percent(37.5)],
        ["SR260813-00045", "13 ส.ค. 13:41", "อรทัย พ.", "พร้อมเพย์", money(430), money(30), money(26.17), money(400), money(245), money(155), percent(38.75)],
        ["SR260813-00044", "13 ส.ค. 13:28", "ลูกค้าทั่วไป", "เงินสด", money(980), money(0), money(64.11), money(980), money(615), money(365), percent(37.24)],
        ["SR260813-00043", "13 ส.ค. 13:12", "วรชัย น.", "เงินสด", money(615), money(15), money(39.25), money(600), money(356), money(244), percent(40.67)],
    ]
    widths = [29, 22, 25, 20, 22, 20, 20, 22, 21, 21, 17]
    scale = CONTENT_WIDTH / sum(widths)
    return [
        *header(
            "กำไร-ขาดทุนแยกตามบิล",
            "แสดงรายได้ ต้นทุน และส่วนต่างของบิลแต่ละใบ เพื่อใช้ตรวจสอบว่าบิลใดมีกำไร ขาดทุน ส่วนลด หรือข้อมูลต้นทุนไม่ครบ",
        ),
        *metrics([
            ("บิลที่ชำระแล้ว", number(264), None),
            ("ยอดรับจริง", money(128450.75), None),
            ("ต้นทุน", money(82068.25), None),
            ("ส่วนต่างขั้นต้น", money(46382.5), None),
        ]),
        table_title("รายละเอียดบิล", len(rows)),
        report_table(
            ["เลขที่บิล", "วันและเวลา", "ลูกค้า", "การชำระเงิน", "มูลค่าสินค้า", "ส่วนลดท้ายบิล", "ภาษีมูลค่าเพิ่ม", "ยอดรับจริง", "ต้นทุน", "ส่วนต่าง", "อัตราส่วนต่าง"],
            rows,
            [value * scale for value in widths],
            ["left", "center", "left", "center", "right", "right", "right", "right", "right", "right", "right"],
            emphasize_columns=(7, 9),
        ),
        Spacer(1, 3 * mm),
        note_box("รายละเอียดการคำนวณ: ส่วนต่างของบิล คือยอดรับจริงหักต้นทุนสินค้าทุกรายการในบิล อัตราส่วนต่าง คือส่วนต่างหารด้วยยอดรับจริงคูณ 100 ไฟล์จริงจะรวมทุกบิลในช่วงวันที่ที่เลือกโดยไม่จำกัดเฉพาะแถวที่แสดงบนหน้าจอ"),
    ]


def product_sales_page():
    rows = [
        ["P-001", "Paracetamol 500 mg", "10 เม็ด", "84", "61", money(178.5), money(14994)],
        ["P-002", "Vitamin C 1000 mg", "30 เม็ด", "46", "43", money(840), money(38640)],
        ["P-003", "Cetirizine 10 mg", "10 เม็ด", "39", "35", money(125), money(4875)],
        ["P-004", "Omeprazole 20 mg", "14 แคปซูล", "32", "29", money(245), money(7840)],
        ["P-005", "Normal Saline 500 ml", "1 ขวด", "27", "26", money(78), money(2106)],
        ["P-006", "Blackmores Bio C", "30 เม็ด", "22", "21", money(410), money(9020)],
        ["P-007", "Betadine Solution 30 ml", "1 ขวด", "18", "16", money(92), money(1656)],
        ["P-008", "Tiger Balm Red", "19 กรัม", "15", "14", money(115), money(1725)],
    ]
    widths = [24, 67, 28, 22, 22, 34, 36]
    scale = CONTENT_WIDTH / sum(widths)
    return [
        *header(
            "สรุปการขายสินค้า",
            "รวมยอดขายตามสินค้า เพื่อดูจำนวนที่ขาย จำนวนบิลที่เกี่ยวข้อง ราคาขายเฉลี่ย และยอดขายรวมของสินค้าแต่ละรายการ",
        ),
        *metrics([
            ("ยอดขายสินค้า", money(128450.75), None),
            ("จำนวนที่ขาย", number(642), None),
            ("สินค้าที่ขาย", number(116), None),
            ("บิลที่เกี่ยวข้อง", number(264), None),
        ]),
        table_title("รายละเอียดสินค้า", len(rows)),
        report_table(
            ["รหัสสินค้า", "ชื่อสินค้า", "แพ็กหรือหน่วย", "จำนวนที่ขาย", "จำนวนบิล", "ราคาขายเฉลี่ย", "ยอดขายสินค้า"],
            rows,
            [value * scale for value in widths],
            ["left", "left", "center", "right", "right", "right", "right"],
            emphasize_columns=(6,),
        ),
        Spacer(1, 3 * mm),
        note_box("รายละเอียดการคำนวณ: จำนวนที่ขายรวมจากทุกรายการขายของสินค้า ราคาขายเฉลี่ยคำนวณจากยอดขายสินค้าหารด้วยจำนวนที่ขาย ยอดขายสินค้าหักส่วนลดระดับสินค้าแล้ว แต่ยังไม่จัดสรรส่วนลดท้ายบิลกลับไปยังสินค้าแต่ละรายการ"),
    ]


def product_profit_page():
    rows = [
        ["P-001", "Paracetamol 500 mg", "10 เม็ด", "84", money(14994), money(92), money(7728), money(7266), percent(48.46), "ครบ"],
        ["P-002", "Vitamin C 1000 mg", "30 เม็ด", "46", money(38640), money(536), money(24656), money(13984), percent(36.19), "ครบ"],
        ["P-003", "Cetirizine 10 mg", "10 เม็ด", "39", money(4875), money(64), money(2496), money(2379), percent(48.8), "ครบ"],
        ["P-004", "Omeprazole 20 mg", "14 แคปซูล", "32", money(7840), money(132), money(4224), money(3616), percent(46.12), "ครบ"],
        ["P-005", "Normal Saline 500 ml", "1 ขวด", "27", money(2106), money(42), money(1134), money(972), percent(46.15), "ครบ"],
        ["P-006", "Blackmores Bio C", "30 เม็ด", "22", money(9020), money(285), money(6270), money(2750), percent(30.49), "ครบ"],
        ["P-007", "Betadine Solution 30 ml", "1 ขวด", "18", money(1656), money(54), money(972), money(684), percent(41.3), "ครบ"],
        ["P-8383", "Muscle Relief Set", "1 ชุด", "40", money(400), money(None), money(None), money(None), percent(None), "ไม่มีต้นทุน"],
    ]
    widths = [20, 50, 22, 16, 24, 23, 23, 23, 18, 23]
    scale = CONTENT_WIDTH / sum(widths)
    return [
        *header(
            "กำไร-ขาดทุนแยกตามสินค้า",
            "เปรียบเทียบยอดขายกับต้นทุนของสินค้าแต่ละรายการ เพื่อดูส่วนต่าง อัตราส่วนต่าง และความครบถ้วนของข้อมูลต้นทุน",
        ),
        *metrics([
            ("ยอดขายสินค้า", money(128450.75), None),
            ("ต้นทุนที่คำนวณได้", money(82068.25), None),
            ("ส่วนต่างขั้นต้น", money(46382.5), None),
            ("ความครบถ้วนของต้นทุน", "23 จาก 24 รายการ", "warning"),
        ]),
        table_title("รายละเอียดกำไร-ขาดทุนสินค้า", len(rows)),
        report_table(
            ["รหัสสินค้า", "ชื่อสินค้า", "แพ็กหรือหน่วย", "จำนวน", "ยอดขาย", "ต้นทุนเฉลี่ย", "ต้นทุนรวม", "ส่วนต่าง", "อัตราส่วนต่าง", "สถานะต้นทุน"],
            rows,
            [value * scale for value in widths],
            ["left", "left", "center", "right", "right", "right", "right", "right", "right", "center"],
            emphasize_columns=(7,),
        ),
        Spacer(1, 3 * mm),
        note_box("รายละเอียดการคำนวณ: ต้นทุนรวม คือจำนวนที่ขายคูณต้นทุนเฉลี่ย ส่วนต่าง คือยอดขายหักต้นทุนรวม และอัตราส่วนต่าง คือส่วนต่างหารด้วยยอดขายคูณ 100 รายการที่ไม่มีต้นทุนจะไม่ถูกแทนด้วยศูนย์ และจะไม่แสดงส่วนต่างจนกว่าจะมีข้อมูลต้นทุน", warning=True),
    ]


def build_pdf():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=landscape(A4),
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=17 * mm,
        bottomMargin=15 * mm,
        title="ตัวอย่างโครงสร้างไฟล์รายงานการขาย",
        author="Pharm",
        subject="ตัวอย่างโครงสร้างไฟล์รายงานภาษาไทย",
    )
    doc.build(daily_page(), onFirstPage=page_chrome, onLaterPages=page_chrome)


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT)
