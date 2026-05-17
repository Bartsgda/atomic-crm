
# Stylesheet w formacie QSS (podobne do CSS)
# Paleta kolorów inspirowana Tailwind Zinc & Emerald

DARK_THEME = """
/* --- GLOBAL RESET & BASE --- */
QWidget {
    background-color: #09090b; /* zinc-950 */
    color: #e4e4e7; /* zinc-200 */
    font-family: 'Segoe UI', 'Inter', sans-serif;
    font-size: 13px;
}

QFrame, QDialog, QMainWindow {
    background-color: #09090b;
}

/* --- SCROLLBARS (Modern Slim) --- */
QScrollBar:vertical {
    border: none;
    background: #18181b;
    width: 8px;
    margin: 0;
}
QScrollBar::handle:vertical {
    background: #3f3f46;
    min-height: 20px;
    border-radius: 4px;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}
QScrollBar:horizontal {
    border: none;
    background: #18181b;
    height: 8px;
    margin: 0;
}
QScrollBar::handle:horizontal {
    background: #3f3f46;
    min-width: 20px;
    border-radius: 4px;
}

/* --- SIDEBAR --- */
QFrame#Sidebar {
    background-color: #000000; /* Absolute black for contrast */
    border-right: 1px solid #27272a;
}

QPushButton#NavButton {
    background-color: transparent;
    border: none;
    text-align: left;
    padding: 12px 16px;
    font-weight: 600;
    color: #a1a1aa; /* zinc-400 */
    border-radius: 8px;
    margin: 2px 10px;
}
QPushButton#NavButton:hover {
    background-color: #18181b; /* zinc-900 */
    color: #e4e4e7;
}
QPushButton#NavButton:checked {
    background-color: #18181b;
    color: #ffffff;
    border-left: 3px solid #dc2626; /* Red accent */
}

/* --- INPUTS & CONTROLS --- */
QLineEdit, QComboBox, QDateEdit, QSpinBox, QDoubleSpinBox, QTextEdit {
    background-color: #18181b; /* zinc-900 */
    border: 1px solid #3f3f46; /* zinc-700 */
    border-radius: 6px;
    padding: 8px 10px;
    color: #ffffff;
    font-weight: bold;
    selection-background-color: #dc2626;
}

QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QTextEdit:focus {
    border: 1px solid #3b82f6; /* Blue focus ring */
    background-color: #18181b;
}

QComboBox::drop-down {
    subcontrol-origin: padding;
    subcontrol-position: top right;
    width: 20px;
    border-left-width: 0px;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
}

/* --- CARDS & GROUP BOXES --- */
QGroupBox {
    background-color: #18181b; /* zinc-900 - CARD BG */
    border: 1px solid #27272a;
    border-radius: 12px;
    margin-top: 10px;
    padding-top: 20px;
    padding-bottom: 10px;
    padding-left: 10px;
    padding-right: 10px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 5px;
    left: 10px;
    top: 5px;
    color: #71717a; /* zinc-500 */
    font-weight: bold;
    font-size: 10px;
    text-transform: uppercase;
    background-color: transparent;
}

/* --- TABLES --- */
QTableWidget {
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    gridline-color: #27272a;
}
QHeaderView::section {
    background-color: #27272a; /* zinc-800 */
    padding: 8px;
    border: none;
    border-bottom: 1px solid #3f3f46;
    font-weight: 800;
    color: #71717a;
    text-transform: uppercase;
    font-size: 10px;
}
QTableWidget::item {
    padding: 5px;
    border-bottom: 1px solid #27272a;
}
QTableWidget::item:selected {
    background-color: #3f3f46;
    color: white;
}

/* --- BUTTONS --- */
QPushButton {
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 11px;
}

QPushButton#ActionButton {
    background-color: #dc2626; /* Red-600 */
    color: white;
    border: none;
}
QPushButton#ActionButton:hover {
    background-color: #b91c1c; /* Red-700 */
}

QPushButton#SecondaryButton {
    background-color: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
}
QPushButton#SecondaryButton:hover {
    background-color: #3f3f46;
    color: white;
}

/* --- SPECIFIC LABELS --- */
QLabel#Header {
    font-size: 24px;
    font-weight: 900;
    color: white;
}

/* MICRO LABELS (React style: text-[9px] font-black uppercase text-zinc-500) */
QLabel[cssClass="MiniLabel"] {
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    color: #71717a; /* zinc-500 */
    margin-bottom: 2px;
    margin-left: 2px;
}

/* SPLITTER */
QSplitter::handle {
    background-color: #27272a;
    width: 1px;
}

/* COLLAPSIBLE BOX HEADER */
QPushButton#CollapsibleHeader {
    text-align: left; 
    background-color: #18181b; 
    color: #a1a1aa; 
    border: 1px solid #27272a; 
    border-radius: 8px; 
    padding: 12px;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 11px;
}
QPushButton#CollapsibleHeader:hover {
    background-color: #27272a;
    color: white;
    border-color: #3f3f46;
}
QPushButton#CollapsibleHeader:checked {
    color: #60a5fa; /* Blue accent when open */
    border-color: #1e3a8a;
    background-color: #172554; /* Blue-950 */
}
"""
