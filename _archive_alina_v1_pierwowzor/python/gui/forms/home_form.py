
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                             QComboBox, QSpinBox, QDoubleSpinBox, QCheckBox, QGridLayout)
from python.gui.widgets.collapsible_box import CollapsibleBox
from python.services.legacy_parser import LegacyParser

class HomeForm(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0,0,0,0)
        self.layout.setSpacing(15)
        
        self.create_main_section()
        self.create_tech_section()
        self.create_sums_section()
        self.create_risks_section()
        
        self.layout.addStretch()

    def _lbl(self, text):
        """Helper to create styled mini label"""
        lbl = QLabel(text)
        lbl.setProperty("cssClass", "MiniLabel")
        return lbl

    def create_main_section(self):
        box = CollapsibleBox("Przedmiot i Adres")
        box.set_expanded(True)
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.cb_type = QComboBox()
        self.cb_type.addItems(['MIESZKANIE', 'DOM', 'DOM W BUDOWIE', 'LETNISKOWY'])
        
        self.inp_address = QLineEdit()
        self.inp_address.setPlaceholderText("Ulica, Numer, Miasto, Kod")
        
        grid.addWidget(self._lbl("Rodzaj Obiektu"), 0, 0)
        grid.addWidget(self.cb_type, 1, 0)
        
        grid.addWidget(self._lbl("Adres Ubezpieczenia"), 2, 0)
        grid.addWidget(self.inp_address, 3, 0)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def create_tech_section(self):
        box = CollapsibleBox("Dane Techniczne")
        box.set_expanded(True)
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.inp_area = QDoubleSpinBox()
        self.inp_area.setRange(0, 10000)
        self.inp_area.setSuffix(" m2")
        self.inp_area.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_year = QSpinBox()
        self.inp_year.setRange(1800, 2100)
        self.inp_year.setValue(2000)
        self.inp_year.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        
        self.cb_construction = QComboBox()
        self.cb_construction.addItems(['MUROWANA (Niepalna)', 'DREWNIANA (Palna)', 'MIESZANA'])
        
        self.chk_photo = QCheckBox("Fotowoltaika")
        
        grid.addWidget(self._lbl("Powierzchnia"), 0, 0)
        grid.addWidget(self.inp_area, 1, 0)
        
        grid.addWidget(self._lbl("Rok Budowy"), 0, 1)
        grid.addWidget(self.inp_year, 1, 1)
        
        grid.addWidget(self._lbl("Konstrukcja"), 2, 0)
        grid.addWidget(self.cb_construction, 3, 0)
        
        grid.addWidget(self.chk_photo, 3, 1)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def create_sums_section(self):
        box = CollapsibleBox("Sumy Ubezpieczenia")
        box.set_expanded(True)
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.inp_walls = QDoubleSpinBox()
        self.inp_walls.setMaximum(99999999)
        self.inp_walls.setSuffix(" PLN")
        self.inp_walls.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_elements = QDoubleSpinBox()
        self.inp_elements.setMaximum(9999999)
        self.inp_elements.setSuffix(" PLN")
        self.inp_elements.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_items = QDoubleSpinBox()
        self.inp_items.setMaximum(9999999)
        self.inp_items.setSuffix(" PLN")
        self.inp_items.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)

        grid.addWidget(self._lbl("Mury"), 0, 0)
        grid.addWidget(self.inp_walls, 1, 0)
        
        grid.addWidget(self._lbl("Elementy Stałe"), 0, 1)
        grid.addWidget(self.inp_elements, 1, 1)
        
        grid.addWidget(self._lbl("Ruchomości Domowe"), 2, 0)
        grid.addWidget(self.inp_items, 3, 0)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def create_risks_section(self):
        box = CollapsibleBox("Rozszerzenia i Cesja")
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.chk_flood = QCheckBox("Powódź")
        self.chk_theft = QCheckBox("Kradzież")
        self.chk_oc = QCheckBox("OC w Życiu Prywatnym")
        self.chk_glass = QCheckBox("Przedmioty Szklane")
        
        self.inp_assignment = QLineEdit()
        self.inp_assignment.setPlaceholderText("Nazwa Banku (Cesja)")
        
        checks = QHBoxLayout()
        checks.addWidget(self.chk_flood)
        checks.addWidget(self.chk_theft)
        checks.addWidget(self.chk_oc)
        checks.addWidget(self.chk_glass)
        
        grid.addLayout(checks, 0, 0)
        grid.addWidget(self._lbl("Cesja Praw (Kredyt)"), 1, 0)
        grid.addWidget(self.inp_assignment, 2, 0)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def get_data(self):
        return {
            'objectType': self.cb_type.currentText(),
            'propertyAddress': self.inp_address.text(),
            'area': self.inp_area.value(),
            'yearBuilt': str(self.inp_year.value()),
            'constructionType': self.cb_construction.currentText(),
            'photovoltaics': self.chk_photo.isChecked(),
            'sumWalls': self.inp_walls.value(),
            'sumFixedElements': self.inp_elements.value(),
            'sumItems': self.inp_items.value(),
            'flood': self.chk_flood.isChecked(),
            'theft': self.chk_theft.isChecked(),
            'ocPrivate': self.chk_oc.isChecked(),
            'assignmentBank': self.inp_assignment.text()
        }

    def set_data(self, data):
        if not data: return
        if data.get('objectType'): self.cb_type.setCurrentText(data['objectType'])
        self.inp_address.setText(data.get('propertyAddress', ''))
        
        try: self.inp_area.setValue(float(data.get('area', 0)))
        except: pass
        try: self.inp_year.setValue(int(data.get('yearBuilt', 2000)))
        except: pass
        
        try: self.inp_walls.setValue(float(data.get('sumWalls', 0)))
        except: pass
        
        self.chk_flood.setChecked(data.get('flood', True))
        self.inp_assignment.setText(data.get('assignmentBank', ''))

    def apply_parsed_data(self, raw_text):
        parsed = LegacyParser.parse_home_string(raw_text)
        
        if parsed.get('objectType'): self.cb_type.setCurrentText(parsed['objectType'])
        if parsed.get('area'): self.inp_area.setValue(parsed['area'])
        if parsed.get('yearBuilt'): 
            try: self.inp_year.setValue(int(parsed['yearBuilt']))
            except: pass
        
        # Proste wyciąganie adresu z tekstu (usuń "dom_" z początku)
        import re
        clean_addr = re.sub(r'^(dom|mieszkanie|lokal)[_ ]', '', raw_text, flags=re.IGNORECASE)
        self.inp_address.setText(clean_addr)
