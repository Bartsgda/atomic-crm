
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                             QComboBox, QSpinBox, QDoubleSpinBox, QCheckBox, QGridLayout, QFrame)
from PyQt6.QtCore import Qt
from python.gui.widgets.collapsible_box import CollapsibleBox
from python.services.legacy_parser import LegacyParser

class AutoForm(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0,0,0,0)
        self.layout.setSpacing(15)
        
        self.create_id_section()
        self.create_tech_section()
        self.create_protection_section()
        self.create_ac_section()
        
        self.layout.addStretch()

    def _lbl(self, text):
        """Helper to create styled mini label"""
        lbl = QLabel(text)
        lbl.setProperty("cssClass", "MiniLabel") # For QSS targeting
        return lbl

    def create_id_section(self):
        # === 1. IDENTYFIKACJA ===
        box = CollapsibleBox("Identyfikacja Pojazdu")
        box.set_expanded(True)
        
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        grid.setHorizontalSpacing(15)
        
        self.cb_type = QComboBox()
        self.cb_type.addItems(['OSOBOWY', 'CIEZAROWY', 'MOTOCYKL', 'QUAD', 'CIAGNIK', 'PRZYCZEPA', 'AUTOBUS', 'FLOTA'])
        
        self.inp_brand = QLineEdit()
        self.inp_brand.setPlaceholderText("np. Toyota")
        
        self.inp_model = QLineEdit()
        self.inp_model.setPlaceholderText("np. Yaris")
        
        self.inp_reg = QLineEdit()
        self.inp_reg.setPlaceholderText("GD 12345")
        
        self.inp_vin = QLineEdit()
        self.inp_vin.setPlaceholderText("17 znaków")
        
        grid.addWidget(self._lbl("Rodzaj"), 0, 0)
        grid.addWidget(self.cb_type, 1, 0)
        
        grid.addWidget(self._lbl("Marka"), 0, 1)
        grid.addWidget(self.inp_brand, 1, 1)
        
        grid.addWidget(self._lbl("Model"), 0, 2)
        grid.addWidget(self.inp_model, 1, 2)
        
        grid.addWidget(self._lbl("Nr Rejestracyjny"), 2, 0)
        grid.addWidget(self.inp_reg, 3, 0)
        
        grid.addWidget(self._lbl("VIN"), 2, 1, 1, 2)
        grid.addWidget(self.inp_vin, 3, 1, 1, 2)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def create_tech_section(self):
        # === 2. DANE TECHNICZNE ===
        box = CollapsibleBox("Dane Techniczne")
        box.set_expanded(True)
        
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        grid.setHorizontalSpacing(15)
        
        self.inp_year = QSpinBox()
        self.inp_year.setRange(1900, 2100)
        self.inp_year.setValue(2015)
        self.inp_year.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_capacity = QSpinBox()
        self.inp_capacity.setRange(0, 20000)
        self.inp_capacity.setSuffix(" cm3")
        self.inp_capacity.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_power = QSpinBox()
        self.inp_power.setRange(0, 2000)
        self.inp_power.setSuffix(" kW")
        self.inp_power.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        
        self.cb_fuel = QComboBox()
        self.cb_fuel.addItems(['BENZYNA', 'DIESEL', 'LPG', 'HYBRYDA', 'ELEKTRYK'])
        
        self.inp_mileage = QSpinBox()
        self.inp_mileage.setRange(0, 9999999)
        self.inp_mileage.setSuffix(" km")
        self.inp_mileage.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)

        grid.addWidget(self._lbl("Rok Produkcji"), 0, 0)
        grid.addWidget(self.inp_year, 1, 0)
        
        grid.addWidget(self._lbl("Pojemność"), 0, 1)
        grid.addWidget(self.inp_capacity, 1, 1)
        
        grid.addWidget(self._lbl("Moc (kW)"), 0, 2)
        grid.addWidget(self.inp_power, 1, 2)
        
        grid.addWidget(self._lbl("Paliwo"), 2, 0)
        grid.addWidget(self.cb_fuel, 3, 0)
        
        grid.addWidget(self._lbl("Przebieg"), 2, 1)
        grid.addWidget(self.inp_mileage, 3, 1)
        
        box.add_layout(grid)
        self.layout.addWidget(box)

    def create_protection_section(self):
        # === 3. ZAKRES I ASSISTANCE ===
        box = CollapsibleBox("Zakres i Assistance")
        
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.cb_assist = QComboBox()
        self.cb_assist.addItems(['PODSTAWOWY', 'ROZSZERZONY', 'VIP/MAX', 'BRAK'])
        
        self.cb_towing = QComboBox()
        self.cb_towing.addItems(['100 KM', '200 KM', '500 KM', '1000 KM', 'BEZ LIMITU', 'BRAK'])
        
        self.cb_car = QComboBox()
        self.cb_car.addItems(['WYPADEK (3 dni)', 'AWARIA/WYPADEK (7 dni)', 'MAX (do 21 dni)', 'BRAK'])
        
        self.chk_tires = QCheckBox("Opony")
        self.chk_windows = QCheckBox("Szyby")
        self.chk_nnw = QCheckBox("NNW Kierowcy")
        
        grid.addWidget(self._lbl("Wariant Assistance"), 0, 0, 1, 2)
        grid.addWidget(self.cb_assist, 1, 0, 1, 2)
        
        grid.addWidget(self._lbl("Limit Holowania"), 2, 0)
        grid.addWidget(self.cb_towing, 3, 0)
        
        grid.addWidget(self._lbl("Auto Zastępcze"), 2, 1)
        grid.addWidget(self.cb_car, 3, 1)
        
        extras = QHBoxLayout()
        extras.addWidget(self.chk_tires)
        extras.addWidget(self.chk_windows)
        extras.addWidget(self.chk_nnw)
        
        grid.addLayout(extras, 4, 0, 1, 2)
        
        box.add_layout(grid)
        self.layout.addWidget(box)
        
    def create_ac_section(self):
        # === 4. AUTOCASCO ===
        self.box_ac = CollapsibleBox("Autocasco (AC)")
        
        grid = QGridLayout()
        grid.setVerticalSpacing(10)
        
        self.cb_ac_variant = QComboBox()
        self.cb_ac_variant.addItems(['KOSZTORYS', 'WARSZTAT', 'ASO'])
        
        self.chk_amortization = QCheckBox("Zniesiona Amortyzacja")
        self.chk_amortization.setChecked(True)
        
        self.inp_ac_val = QDoubleSpinBox()
        self.inp_ac_val.setMaximum(9999999)
        self.inp_ac_val.setSuffix(" PLN")
        self.inp_ac_val.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        
        self.inp_deductible = QSpinBox()
        self.inp_deductible.setRange(0, 10000)
        self.inp_deductible.setSuffix(" PLN")
        self.inp_deductible.setValue(500)
        
        grid.addWidget(self._lbl("Wariant Likwidacji"), 0, 0)
        grid.addWidget(self.cb_ac_variant, 1, 0)
        
        grid.addWidget(self._lbl("Suma Ubezpieczenia"), 0, 1)
        grid.addWidget(self.inp_ac_val, 1, 1)
        
        grid.addWidget(self._lbl("Udział Własny"), 2, 0)
        grid.addWidget(self.inp_deductible, 3, 0)
        
        grid.addWidget(self.chk_amortization, 3, 1)
        
        self.box_ac.add_layout(grid)
        self.layout.addWidget(self.box_ac)

    # --- API FOR DATA EXCHANGE ---
    def get_data(self):
        return {
            'vehicleType': self.cb_type.currentText(),
            'vehicleBrand': self.inp_brand.text(),
            'vehicleModel': self.inp_model.text(),
            'vehicleReg': self.inp_reg.text().upper(),
            'vehicleVin': self.inp_vin.text().upper(),
            'productionYear': str(self.inp_year.value()),
            'engineCapacity': str(self.inp_capacity.value()),
            'enginePower': str(self.inp_power.value()),
            'fuelType': self.cb_fuel.currentText(),
            'mileage': self.inp_mileage.value(),
            # AC/Assistance
            'assistanceVariant': self.cb_assist.currentText(),
            'towingLimitPL': self.cb_towing.currentText(),
            'replacementCar': self.cb_car.currentText(),
            'tires': self.chk_tires.isChecked(),
            'windows': self.chk_windows.isChecked(),
            'nnw': self.chk_nnw.isChecked(),
            'acVariant': self.cb_ac_variant.currentText(),
            'acAmortization': self.chk_amortization.isChecked(),
            'acDeductible': self.inp_deductible.value(),
            'vehicleValue': self.inp_ac_val.value()
        }

    def set_data(self, data):
        if not data: return
        # Basic
        if data.get('vehicleType'): self.cb_type.setCurrentText(data['vehicleType'])
        self.inp_brand.setText(data.get('vehicleBrand', ''))
        self.inp_model.setText(data.get('vehicleModel', ''))
        self.inp_reg.setText(data.get('vehicleReg', ''))
        self.inp_vin.setText(data.get('vehicleVin', ''))
        
        # Tech
        try: self.inp_year.setValue(int(data.get('productionYear', 2015)))
        except: pass
        try: self.inp_capacity.setValue(int(data.get('engineCapacity', 0)))
        except: pass
        try: self.inp_power.setValue(int(data.get('enginePower', 0)))
        except: pass
        if data.get('fuelType'): self.cb_fuel.setCurrentText(data['fuelType'])
        try: self.inp_mileage.setValue(int(data.get('mileage', 0)))
        except: pass
        
        # AC
        if data.get('acVariant'): self.cb_ac_variant.setCurrentText(data['acVariant'])
        try: self.inp_ac_val.setValue(float(data.get('vehicleValue', 0)))
        except: pass
        self.chk_amortization.setChecked(data.get('acAmortization', True))

    def apply_parsed_data(self, raw_text):
        # Wywołanie parsera legacy (zmigrowanego)
        parsed = LegacyParser.parse_auto_string(raw_text)
        
        # Autouzupełnianie pól, jeśli parser coś znalazł
        if parsed.get('vehicleBrand'): self.inp_brand.setText(parsed['vehicleBrand'])
        if parsed.get('vehicleReg'): self.inp_reg.setText(parsed['vehicleReg'])
        
        details = parsed.get('autoDetails', {})
        if details.get('vehicleType'): self.cb_type.setCurrentText(details['vehicleType'])
        if details.get('fuelType'): self.cb_fuel.setCurrentText(details['fuelType'])
        if details.get('engineCapacity'): 
            try: self.inp_capacity.setValue(int(details['engineCapacity']))
            except: pass
        if details.get('enginePower'): 
            try: self.inp_power.setValue(int(details['enginePower']))
            except: pass
        if details.get('productionYear'): 
            try: self.inp_year.setValue(int(details['productionYear']))
            except: pass

    def set_ac_visible(self, visible: bool):
        self.box_ac.setVisible(visible)
