
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTableWidget, 
                             QTableWidgetItem, QHeaderView, QPushButton, QDialog, QFormLayout, 
                             QLineEdit, QCheckBox)
from PyQt6.QtCore import Qt
from python.data.insurers import INSURERS_DATA
from python.db import db

class InsurerEditDialog(QDialog):
    def __init__(self, insurer_name, current_config, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Edycja: {insurer_name}")
        self.resize(400, 300)
        self.layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.inp_manager = QLineEdit(current_config.get('manager_name', ''))
        self.inp_phone = QLineEdit(current_config.get('manager_phone', ''))
        self.inp_email = QLineEdit(current_config.get('manager_email', ''))
        self.chk_active = QCheckBox("Aktywny na liście")
        self.chk_active.setChecked(bool(current_config.get('is_active', 1)))
        
        form_layout.addRow("Opiekun (Imię Nazwisko):", self.inp_manager)
        form_layout.addRow("Telefon Opiekuna:", self.inp_phone)
        form_layout.addRow("E-mail Opiekuna:", self.inp_email)
        form_layout.addRow("Status:", self.chk_active)
        
        self.layout.addLayout(form_layout)
        
        # Buttons
        btns = QHBoxLayout()
        btn_save = QPushButton("Zapisz")
        btn_save.clicked.connect(self.accept)
        btn_cancel = QPushButton("Anuluj")
        btn_cancel.clicked.connect(self.reject)
        
        btns.addWidget(btn_cancel)
        btns.addWidget(btn_save)
        self.layout.addLayout(btns)
        
    def get_data(self):
        return {
            'manager_name': self.inp_manager.text(),
            'manager_phone': self.inp_phone.text(),
            'manager_email': self.inp_email.text(),
            'is_active': 1 if self.chk_active.isChecked() else 0
        }

class InsurersView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.layout = QVBoxLayout(self)
        
        # Header
        header_layout = QHBoxLayout()
        title = QLabel("Katalog Towarzystw")
        title.setStyleSheet("font-size: 24px; font-weight: bold;")
        header_layout.addWidget(title)
        header_layout.addStretch()
        
        btn_refresh = QPushButton("Odśwież")
        btn_refresh.clicked.connect(self.refresh_table)
        header_layout.addWidget(btn_refresh)
        
        self.layout.addLayout(header_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(["Nazwa", "Podmiot Prawny", "Opiekun", "Telefon", "E-mail", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.cellDoubleClicked.connect(self.on_row_double_click)
        
        self.layout.addWidget(self.table)
        
        self.refresh_table()

    def refresh_table(self):
        configs = db.get_insurer_configs() # Pobiera { 'Warta': {...}, ... }
        
        # Merge static data with DB configs
        self.merged_data = []
        for ins in INSURERS_DATA:
            name = ins['name']
            conf = configs.get(name, {})
            
            merged = {
                **ins,
                'manager_name': conf.get('manager_name', ''),
                'manager_phone': conf.get('manager_phone', ''),
                'manager_email': conf.get('manager_email', ''),
                'is_active': conf.get('is_active', 1)
            }
            self.merged_data.append(merged)
            
        # Add custom insurers from DB that are NOT in static list?
        # (Optional future feature, for now stick to list)
            
        self.table.setRowCount(len(self.merged_data))
        
        for row, item in enumerate(self.merged_data):
            self.table.setItem(row, 0, QTableWidgetItem(item['name']))
            self.table.setItem(row, 1, QTableWidgetItem(item['legal_entity']))
            self.table.setItem(row, 2, QTableWidgetItem(item['manager_name']))
            self.table.setItem(row, 3, QTableWidgetItem(item['manager_phone']))
            self.table.setItem(row, 4, QTableWidgetItem(item['manager_email']))
            
            status_item = QTableWidgetItem("Aktywny" if item['is_active'] else "Ukryty")
            if not item['is_active']:
                status_item.setForeground(Qt.GlobalColor.gray)
            self.table.setItem(row, 5, status_item)

    def on_row_double_click(self, row, col):
        item = self.merged_data[row]
        dialog = InsurerEditDialog(item['name'], item, self)
        
        if dialog.exec():
            new_data = dialog.get_data()
            db.upsert_insurer_config(
                item['name'], 
                new_data['manager_name'],
                new_data['manager_phone'],
                new_data['manager_email'],
                new_data['is_active']
            )
            self.refresh_table()
