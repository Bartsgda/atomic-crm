
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                             QComboBox, QDateEdit, QWidget, QFormLayout, 
                             QCheckBox, QPushButton, QMessageBox, QStackedWidget, 
                             QGroupBox, QSpinBox, QDoubleSpinBox, QScrollArea, QSplitter, QFrame, QTextEdit)
from PyQt6.QtCore import Qt, QDate
import json
import uuid
from python.db import db
from python.models import PolicyType, SalesStage, VehicleSubType

# IMPORT DEDICATED FORMS
from python.gui.forms.auto_form import AutoForm
from python.gui.forms.home_form import HomeForm

# --- STAŁE (Checklist Templates z CHECKLIST_SPECS.md) ---
CHECKLIST_TEMPLATES = {
    'COMMON': [('rodo', 'RODO (Klauzula)'), ('apk', 'APK (Analiza Potrzeb)')],
    'OC': [('dowod_rej', 'Dowód Rejestracyjny'), ('prawo_jazdy', 'Prawo Jazdy')],
    'AC': [('zdjecia', 'Zdjęcia (4 strony + VIN)'), ('kluczyki', '2 kpl. Kluczyków')],
    'DOM': [('akt_notarialny', 'Akt Notarialny / KW'), ('cesja', 'Cesja (Bank)')],
    'ZYCIE': [('ankieta', 'Ankieta Medyczna'), ('uposazeni', 'Wskazanie Uposażonych')],
    'PODROZ': [('zakres', 'Zakres Terytorialny (Potwierdzenie)')],
    'FIRMA': [('nip', 'Wpis CEIDG/KRS')]
}

class PolicyForm(QDialog):
    def __init__(self, client_id, policy_data=None, parent=None):
        super().__init__(parent)
        self.client_id = client_id
        self.policy_data = policy_data or {}
        self.is_math_blocked = False 
        
        self.setWindowTitle("Centrum Operacyjne Polisy" if policy_data else "Nowa Polisa")
        self.resize(1300, 850)
        
        # --- MAIN LAYOUT (SPLITTER) ---
        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)
        
        # 1. Header (Padded)
        header_container = QWidget()
        header_layout = QVBoxLayout(header_container)
        header_layout.setContentsMargins(15, 15, 15, 5)
        self.setup_header(header_layout)
        self.main_layout.addWidget(header_container)
        
        # 2. Splitter
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # --- LEFT PANEL ---
        self.left_panel = QWidget()
        self.left_layout = QVBoxLayout(self.left_panel)
        self.left_layout.setContentsMargins(15, 0, 15, 15)
        self.left_layout.setSpacing(15)
        
        self.setup_common_section()
        
        # Dynamic forms
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        self.scroll.setStyleSheet("background-color: transparent;")
        
        self.stack = QStackedWidget()
        self.stack.setStyleSheet("background-color: transparent;")
        
        # Instantiate dedicated forms
        self.form_auto = AutoForm()
        self.form_home = HomeForm()
        
        # Placeholder for other types (simple widget for now)
        self.form_travel = self.create_simple_widget("Formularz Podróżny w budowie...")
        self.form_life = self.create_simple_widget("Formularz Życiowy w budowie...")
        self.form_other = self.create_simple_widget("Formularz Inny w budowie...")
        
        self.stack.addWidget(self.form_auto)    # 0 (OC/AC/BOTH)
        self.stack.addWidget(self.form_home)    # 1 (DOM)
        self.stack.addWidget(self.form_travel)  # 2 (PODROZ)
        self.stack.addWidget(self.form_life)    # 3 (ZYCIE)
        self.stack.addWidget(self.form_other)   # 4 (INNE)
        
        self.scroll.setWidget(self.stack)
        self.left_layout.addWidget(self.scroll)
        
        # IMPORT / NOTES SECTION (Legacy Parsing Source)
        self.setup_import_notes_section()
        
        self.splitter.addWidget(self.left_panel)

        # --- RIGHT PANEL ---
        self.right_panel = QFrame()
        self.right_panel.setStyleSheet("background-color: #09090b; border-left: 1px solid #27272a;")
        self.right_layout = QVBoxLayout(self.right_panel)
        self.right_layout.setContentsMargins(15, 10, 15, 15)
        self.right_layout.setSpacing(15)
        
        self.setup_right_panel_content()
        
        self.splitter.addWidget(self.right_panel)
        self.splitter.setSizes([850, 450])
        
        self.main_layout.addWidget(self.splitter)

        # --- FOOTER ---
        footer_container = QWidget()
        footer_container.setStyleSheet("background-color: #18181b; border-top: 1px solid #27272a;")
        footer_layout = QHBoxLayout(footer_container)
        footer_layout.setContentsMargins(15, 15, 15, 15)
        self.setup_footer(footer_layout)
        self.main_layout.addWidget(footer_container)
        
        # Init
        self.load_initial_values()
        self.update_view_mode(self.combo_type.currentText())

    def _lbl(self, text):
        lbl = QLabel(text)
        lbl.setProperty("cssClass", "MiniLabel")
        return lbl

    def setup_header(self, layout):
        gb = QGroupBox("Konfiguracja Produktu")
        # Ensure header style is consistent
        gb_layout = QHBoxLayout()
        
        self.combo_type = QComboBox()
        self.combo_type.addItems(['OC', 'AC', 'BOTH', 'DOM', 'PODROZ', 'ZYCIE', 'FIRMA', 'INNE'])
        self.combo_type.currentTextChanged.connect(self.update_view_mode)
        
        self.combo_stage = QComboBox()
        self.combo_stage.addItems([s.value for s in SalesStage])
        
        layout_grid = QFormLayout()
        layout_grid.addRow("Typ Polisy:", self.combo_type)
        layout_grid.addRow("Etap Sprzedaży:", self.combo_stage)
        
        # Layout redesign for horizontal flow
        h_cont = QWidget()
        h_lay = QHBoxLayout(h_cont)
        h_lay.setContentsMargins(0,0,0,0)
        
        v1 = QVBoxLayout()
        v1.addWidget(self._lbl("Typ Polisy"))
        v1.addWidget(self.combo_type)
        h_lay.addLayout(v1)
        
        v2 = QVBoxLayout()
        v2.addWidget(self._lbl("Etap Sprzedaży"))
        v2.addWidget(self.combo_stage)
        h_lay.addLayout(v2)
        
        gb.setLayout(h_lay)
        layout.addWidget(gb)

    def setup_common_section(self):
        gb = QGroupBox("Dane Podstawowe")
        layout = QVBoxLayout()
        
        row1 = QHBoxLayout()
        
        v_ins = QVBoxLayout()
        v_ins.addWidget(self._lbl("Towarzystwo"))
        self.inp_insurer = QComboBox()
        self.inp_insurer.setEditable(True)
        self.inp_insurer.addItems(["PZU", "Warta", "Ergo Hestia", "Allianz", "Generali", "Wiener", "Link4", "Uniqa", "Interrisk", "Compensa", "TUZ", "Balcia"])
        v_ins.addWidget(self.inp_insurer)
        row1.addLayout(v_ins)
        
        v_pol = QVBoxLayout()
        v_pol.addWidget(self._lbl("Numer Polisy"))
        self.inp_policy_no = QLineEdit()
        self.inp_policy_no.setPlaceholderText("Wymagane przy sprzedaży")
        v_pol.addWidget(self.inp_policy_no)
        row1.addLayout(v_pol)
        
        layout.addLayout(row1)
        
        row2 = QHBoxLayout()
        
        v_start = QVBoxLayout()
        v_start.addWidget(self._lbl("Start Ochrony"))
        self.date_start = QDateEdit()
        self.date_start.setCalendarPopup(True)
        self.date_start.setDisplayFormat("yyyy-MM-dd")
        self.date_start.setDate(QDate.currentDate())
        v_start.addWidget(self.date_start)
        row2.addLayout(v_start)
        
        v_end = QVBoxLayout()
        v_end.addWidget(self._lbl("Koniec Ochrony"))
        self.date_end = QDateEdit()
        self.date_end.setCalendarPopup(True)
        self.date_end.setDisplayFormat("yyyy-MM-dd")
        self.date_end.setDate(QDate.currentDate().addDays(365))
        v_end.addWidget(self.date_end)
        row2.addLayout(v_end)
        
        layout.addLayout(row2)
        
        gb.setLayout(layout)
        self.left_layout.addWidget(gb)

    def setup_import_notes_section(self):
        gb = QGroupBox("Dane Źródłowe / Notatki")
        gb.setStyleSheet("QGroupBox { background-color: #2e2a0a; border: 1px solid #422006; } QGroupBox::title { color: #fcd34d; }") # Amber theme
        layout = QVBoxLayout()
        
        self.txt_import = QTextEdit()
        self.txt_import.setPlaceholderText("Wklej tutaj dane z Excela (np. 'samochód_GD12345')...")
        self.txt_import.setMaximumHeight(80)
        self.txt_import.setStyleSheet("background-color: #1a1600; color: #fef3c7; border: 1px solid #422006;")
        self.txt_import.textChanged.connect(self.on_import_text_changed)
        
        layout.addWidget(self.txt_import)
        gb.setLayout(layout)
        self.left_layout.addWidget(gb)

    def on_import_text_changed(self):
        text = self.txt_import.toPlainText()
        if not text: return
        
        # Trigger parsing logic based on current active form
        idx = self.stack.currentIndex()
        if idx == 0: # Auto
            self.form_auto.apply_parsed_data(text)
        elif idx == 1: # Home
            self.form_home.apply_parsed_data(text)

    def setup_right_panel_content(self):
        # 1. FINANSE (Kalkulator)
        gb_finance = QGroupBox("Kalkulator Prowizji")
        fin_layout = QVBoxLayout()
        
        self.inp_premium = QDoubleSpinBox()
        self.inp_premium.setMaximum(999999.99)
        self.inp_premium.setSuffix(" PLN")
        self.inp_premium.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        self.inp_premium.valueChanged.connect(self.recalc_commission_amount)
        self.inp_premium.setStyleSheet("font-size: 16px; color: #34d399;") # Emerald text
        
        self.inp_comm_rate = QDoubleSpinBox()
        self.inp_comm_rate.setMaximum(100.0)
        self.inp_comm_rate.setSuffix(" %")
        self.inp_comm_rate.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        self.inp_comm_rate.valueChanged.connect(self.recalc_commission_amount)
        
        self.inp_commission = QDoubleSpinBox()
        self.inp_commission.setMaximum(999999.99)
        self.inp_commission.setSuffix(" PLN")
        self.inp_commission.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        self.inp_commission.valueChanged.connect(self.recalc_commission_rate)
        self.inp_commission.setStyleSheet("font-size: 16px; font-weight: 900; color: #60a5fa;") # Blue text
        
        fin_layout.addWidget(self._lbl("Składka (Premium)"))
        fin_layout.addWidget(self.inp_premium)
        fin_layout.addWidget(self._lbl("Twoja Prowizja %"))
        fin_layout.addWidget(self.inp_comm_rate)
        fin_layout.addWidget(self._lbl("Kwota Prowizji"))
        fin_layout.addWidget(self.inp_commission)
        
        gb_finance.setLayout(fin_layout)
        self.right_layout.addWidget(gb_finance)
        
        # 2. CHECKLISTY
        self.gb_checklist = QGroupBox("Wymagane Dokumenty")
        self.checklist_layout = QVBoxLayout()
        self.gb_checklist.setLayout(self.checklist_layout)
        self.right_layout.addWidget(self.gb_checklist)
        
        self.checklist_widgets = {} 
        self.right_layout.addStretch()

    def setup_footer(self, layout):
        btn_cancel = QPushButton("Anuluj")
        btn_cancel.setObjectName("SecondaryButton")
        btn_cancel.clicked.connect(self.reject)
        
        btn_save = QPushButton("Zapisz i Zamknij")
        btn_save.setObjectName("ActionButton")
        btn_save.setMinimumHeight(40)
        btn_save.clicked.connect(self.save_policy)
        
        layout.addStretch()
        layout.addWidget(btn_cancel)
        layout.addWidget(btn_save)

    # --- MATH LOGIC ---
    def recalc_commission_amount(self):
        if self.is_math_blocked: return
        self.is_math_blocked = True
        prem = self.inp_premium.value()
        rate = self.inp_comm_rate.value()
        if prem > 0:
            comm = round((prem * rate) / 100, 2)
            self.inp_commission.setValue(comm)
        self.is_math_blocked = False

    def recalc_commission_rate(self):
        if self.is_math_blocked: return
        self.is_math_blocked = True
        prem = self.inp_premium.value()
        comm = self.inp_commission.value()
        if prem > 0:
            rate = round((comm / prem) * 100, 2)
            self.inp_comm_rate.setValue(rate)
        self.is_math_blocked = False

    def update_checklist(self, policy_type):
        for i in reversed(range(self.checklist_layout.count())): 
            self.checklist_layout.itemAt(i).widget().setParent(None)
        self.checklist_widgets = {}

        items = CHECKLIST_TEMPLATES.get('COMMON', [])[:]
        if policy_type in ['OC', 'AC', 'BOTH']:
            items.extend(CHECKLIST_TEMPLATES.get('OC', []))
            if policy_type in ['AC', 'BOTH']: items.extend(CHECKLIST_TEMPLATES.get('AC', []))
        elif policy_type == 'DOM': items.extend(CHECKLIST_TEMPLATES.get('DOM', []))
        elif policy_type == 'ZYCIE': items.extend(CHECKLIST_TEMPLATES.get('ZYCIE', []))
        elif policy_type == 'PODROZ': items.extend(CHECKLIST_TEMPLATES.get('PODROZ', []))

        checklist_saved = self.policy_data.get('checklist', {})

        for key, label in items:
            chk = QCheckBox(label)
            if checklist_saved.get(key): chk.setChecked(True)
            if key in ['rodo', 'apk', 'zdjecia']: chk.setStyleSheet("color: #ef4444; font-weight: bold;")
            self.checklist_layout.addWidget(chk)
            self.checklist_widgets[key] = chk

    def update_view_mode(self, type_text):
        if type_text in ['OC', 'AC', 'BOTH']:
            self.stack.setCurrentIndex(0)
            self.form_auto.set_ac_visible(type_text in ['AC', 'BOTH'])
        elif type_text == 'DOM': self.stack.setCurrentIndex(1)
        elif type_text == 'PODROZ': self.stack.setCurrentIndex(2)
        elif type_text == 'ZYCIE': self.stack.setCurrentIndex(3)
        else: self.stack.setCurrentIndex(4)
        self.update_checklist(type_text)

    def create_simple_widget(self, text):
        w = QWidget()
        l = QVBoxLayout(w)
        l.addWidget(QLabel(text))
        l.addStretch()
        return w

    def load_initial_values(self):
        p = self.policy_data
        
        self.combo_type.setCurrentText(p.get('type', 'OC'))
        self.combo_stage.setCurrentText(p.get('stage', 'of_do zrobienia'))
        self.inp_insurer.setCurrentText(p.get('insurerName', ''))
        self.inp_policy_no.setText(p.get('policyNumber', ''))
        
        if p.get('policyStartDate'):
            self.date_start.setDate(QDate.fromString(p['policyStartDate'][:10], "yyyy-MM-dd"))
        if p.get('policyEndDate'):
            self.date_end.setDate(QDate.fromString(p['policyEndDate'][:10], "yyyy-MM-dd"))
        
        self.inp_premium.setValue(float(p.get('premium', 0)))
        self.inp_commission.setValue(float(p.get('commission', 0)))
        
        if self.inp_premium.value() > 0:
            self.inp_comm_rate.setValue((self.inp_commission.value() / self.inp_premium.value()) * 100)
            
        self.txt_import.setText(p.get('originalProductString', ''))
        
        # Load Sub-Forms
        auto_data = p.get('autoDetails', {})
        # Merge flat fields into auto_data for convenience
        auto_data.update({
            'vehicleBrand': p.get('vehicleBrand'),
            'vehicleModel': p.get('vehicleModel'),
            'vehicleReg': p.get('vehicleReg'),
            'vehicleVin': p.get('vehicleVin')
        })
        self.form_auto.set_data(auto_data)
        
        home_data = p.get('homeDetails', {})
        home_data.update({
            'propertyAddress': p.get('propertyAddress')
        })
        self.form_home.set_data(home_data)

    def save_policy(self):
        checklist_state = {k: chk.isChecked() for k, chk in self.checklist_widgets.items()}

        # Base Data
        data = {
            'id': self.policy_data.get('id') or f"p_loc_{uuid.uuid4().hex[:8]}",
            'clientId': self.client_id,
            'type': self.combo_type.currentText(),
            'stage': self.combo_stage.currentText(),
            'insurerName': self.inp_insurer.currentText(),
            'policyNumber': self.inp_policy_no.text(),
            'policyStartDate': self.date_start.date().toString("yyyy-MM-dd"),
            'policyEndDate': self.date_end.date().toString("yyyy-MM-dd"),
            'premium': self.inp_premium.value(),
            'commission': self.inp_commission.value(),
            'checklist': checklist_state,
            'originalProductString': self.txt_import.toPlainText()
        }
        
        # Gather Sub-Forms
        auto_vals = self.form_auto.get_data()
        home_vals = self.form_home.get_data()
        
        # Flatten key fields to main policy for indexing/search
        data['vehicleBrand'] = auto_vals.get('vehicleBrand', '')
        data['vehicleReg'] = auto_vals.get('vehicleReg', '')
        data['propertyAddress'] = home_vals.get('propertyAddress', '')
        
        # Store nested details
        data['autoDetails'] = auto_vals
        data['homeDetails'] = home_vals
        
        try:
            db.add_policy(data)
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Błąd zapisu", str(e))
