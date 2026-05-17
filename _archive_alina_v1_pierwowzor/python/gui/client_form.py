
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                             QPushButton, QFormLayout, QMessageBox, QTextEdit, QScrollArea, QWidget, QFrame)
from PyQt6.QtCore import Qt
from datetime import datetime
import uuid
from python.db import db
from python.gui.widgets.collapsible_box import CollapsibleBox

class ClientForm(QDialog):
    def __init__(self, client_data=None, parent=None):
        super().__init__(parent)
        self.client_data = client_data or {}
        self.setWindowTitle("Karta Klienta")
        self.resize(550, 700)
        
        # Main Layout
        main_layout = QVBoxLayout(self)
        
        # Scroll Area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        
        container = QWidget()
        self.layout = QVBoxLayout(container)
        
        # --- 1. TOŻSAMOŚĆ ---
        self.create_identity_section()
        
        # --- 2. KONTAKT (Dynamiczny) ---
        self.create_contact_section()
        
        # --- 3. ADRES ---
        self.create_address_section()
        
        # --- 4. FIRMY (B2B) ---
        self.create_business_section()
        
        # --- 5. NOTATKI ---
        lbl_notes = QLabel("Notatki Prywatne (Hobby, Rodzina):")
        lbl_notes.setStyleSheet("font-weight: bold; color: #fcd34d; margin-top: 10px;")
        self.layout.addWidget(lbl_notes)
        self.inp_notes = QTextEdit(self.client_data.get('notes', ''))
        self.inp_notes.setMaximumHeight(80)
        self.layout.addWidget(self.inp_notes)
        
        self.layout.addStretch()
        scroll.setWidget(container)
        main_layout.addWidget(scroll)
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_cancel = QPushButton("Anuluj")
        btn_cancel.clicked.connect(self.reject)
        
        btn_save = QPushButton("Zapisz Klienta")
        btn_save.setStyleSheet("background-color: #dc2626; color: white; font-weight: bold; padding: 10px;")
        btn_save.clicked.connect(self.save)
        
        btn_layout.addStretch()
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        main_layout.addLayout(btn_layout)

    def create_identity_section(self):
        box = CollapsibleBox("Dane Osobiste")
        box.set_expanded(True)
        form = QFormLayout()
        
        self.inp_first_name = QLineEdit(self.client_data.get('first_name', ''))
        self.inp_last_name = QLineEdit(self.client_data.get('last_name', ''))
        self.inp_pesel = QLineEdit(self.client_data.get('pesel', ''))
        
        form.addRow("Imię:", self.inp_first_name)
        form.addRow("Nazwisko:", self.inp_last_name)
        form.addRow("PESEL:", self.inp_pesel)
        
        box.add_layout(form)
        self.layout.addWidget(box)

    def create_contact_section(self):
        # TODO: W przyszłości dynamiczne dodawanie wierszy (useFieldArray equivalent)
        # Na razie trzymamy się schematu DB, gdzie phone/email to pojedyncze stringi
        # Ale w GUI pokazujemy to jako sekcję
        
        box = CollapsibleBox("Kontakt")
        box.set_expanded(True)
        form = QFormLayout()
        
        self.inp_phone = QLineEdit(self.client_data.get('phone', ''))
        self.inp_phone.setPlaceholderText("500 600 700")
        
        self.inp_email = QLineEdit(self.client_data.get('email', ''))
        self.inp_email.setPlaceholderText("klient@example.com")
        
        form.addRow("Telefon:", self.inp_phone)
        form.addRow("E-mail:", self.inp_email)
        
        box.add_layout(form)
        self.layout.addWidget(box)

    def create_address_section(self):
        box = CollapsibleBox("Adres Zamieszkania")
        box.set_expanded(True)
        layout = QVBoxLayout()
        
        self.inp_address = QLineEdit(self.client_data.get('address', ''))
        self.inp_address.setPlaceholderText("Ulica, Numer, Kod Pocztowy, Miasto")
        layout.addWidget(self.inp_address)
        
        box.add_layout(layout)
        self.layout.addWidget(box)
        
    def create_business_section(self):
        box = CollapsibleBox("Dane Firmowe (B2B)")
        # W MVP Pythonowym nie mamy jeszcze tabeli businesses 1:N w DB (oparte na JSON string)
        # Więc tutaj tylko placeholder/notatka
        layout = QVBoxLayout()
        lbl = QLabel("Funkcja obsługi wielu firm dostępna wkrótce.\nWpisz NIP w notatkach.")
        lbl.setStyleSheet("color: gray; font-style: italic;")
        layout.addWidget(lbl)
        
        box.add_layout(layout)
        self.layout.addWidget(box)

    def save(self):
        if not self.inp_last_name.text():
            QMessageBox.warning(self, "Błąd", "Nazwisko jest wymagane!")
            return

        data = {
            'id': self.client_data.get('id') or f"c_loc_{uuid.uuid4().hex[:8]}",
            'firstName': self.inp_first_name.text(),
            'lastName': self.inp_last_name.text(),
            'pesel': self.inp_pesel.text(),
            'phone': self.inp_phone.text(),
            'email': self.inp_email.text(),
            'street': self.inp_address.text(),
            'notes': self.inp_notes.toPlainText(),
            'createdAt': self.client_data.get('created_at') or datetime.now().isoformat()
        }
        
        try:
            db.add_client(data)
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Błąd zapisu", str(e))
