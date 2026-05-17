
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTableWidget, 
                             QTableWidgetItem, QHeaderView, QPushButton, QLineEdit, QMessageBox, QFileDialog)
from PyQt6.QtCore import Qt
from python.db import db
from python.services.pdf_generator import PdfGenerator
from python.data.insurers import INSURERS_DATA

class TerminationsView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.layout = QVBoxLayout(self)
        
        # HEADER
        header_layout = QHBoxLayout()
        
        title_block = QVBoxLayout()
        title = QLabel("Rejestr Wypowiedzeń")
        title.setStyleSheet("font-size: 24px; font-weight: bold;")
        subtitle = QLabel("Ewidencja wysłanych dokumentów (Art. 28/28a)")
        subtitle.setStyleSheet("color: #71717a; font-size: 11px; font-weight: bold; text-transform: uppercase;")
        title_block.addWidget(title)
        title_block.addWidget(subtitle)
        
        header_layout.addLayout(title_block)
        header_layout.addStretch()
        
        # Search
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Szukaj ID, Klienta...")
        self.search_input.setFixedWidth(250)
        self.search_input.textChanged.connect(self.refresh_table)
        header_layout.addWidget(self.search_input)
        
        btn_refresh = QPushButton("Odśwież")
        btn_refresh.clicked.connect(self.refresh_table)
        header_layout.addWidget(btn_refresh)
        
        self.layout.addLayout(header_layout)
        
        # TABLE
        self.table = QTableWidget()
        self.table.setColumnCount(7) # Added Generate PDF column
        self.table.setHorizontalHeaderLabels(["ID", "Data Złożenia", "Data Sys.", "Klient", "Przedmiot", "Akcja", "Dokument"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        
        self.layout.addWidget(self.table)
        
        self.refresh_table()

    def refresh_table(self):
        term_data = db.get_terminations()
        filter_text = self.search_input.text().lower()
        
        filtered = [
            t for t in term_data 
            if filter_text in t['client_name'].lower() 
            or filter_text in t['item_description'].lower()
            or filter_text in t['id'].lower()
        ]
        
        self.table.setRowCount(len(filtered))
        
        for row, item in enumerate(filtered):
            # ID
            id_item = QTableWidgetItem(item['id'])
            id_item.setToolTip(item['id'])
            self.table.setItem(row, 0, id_item)
            
            # Data Fakt.
            self.table.setItem(row, 1, QTableWidgetItem(item['actual_date']))
            
            # Data Sys.
            sent_at = item['sent_at'][:16].replace('T', ' ')
            self.table.setItem(row, 2, QTableWidgetItem(sent_at))
            
            # Klient
            client_item = QTableWidgetItem(item['client_name'])
            client_item.setFont(self.get_bold_font())
            self.table.setItem(row, 3, client_item)
            
            # Przedmiot
            self.table.setItem(row, 4, QTableWidgetItem(item['item_description']))
            
            # Akcja (Delete)
            btn_del = QTableWidgetItem("USUŃ")
            btn_del.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            btn_del.setForeground(Qt.GlobalColor.red)
            self.table.setItem(row, 5, btn_del)

            # Dokument (Generate PDF)
            btn_pdf = QTableWidgetItem("📄 PDF")
            btn_pdf.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            btn_pdf.setForeground(Qt.GlobalColor.blue)
            self.table.setItem(row, 6, btn_pdf)

        # Connect click
        self.table.cellClicked.connect(self.on_cell_clicked)

    def get_bold_font(self):
        font = self.font()
        font.setBold(True)
        return font

    def on_cell_clicked(self, row, col):
        item_id = self.table.item(row, 0).text()

        if col == 5: # Delete
            confirm = QMessageBox.question(
                self, "Potwierdź usunięcie", 
                f"Czy na pewno usunąć wypowiedzenie {item_id} z rejestru?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if confirm == QMessageBox.StandardButton.Yes:
                db.delete_termination(item_id)
                self.refresh_table()

        elif col == 6: # Generate PDF
            self.generate_pdf_for_row(row)

    def generate_pdf_for_row(self, row):
        # Pobieramy dane z DB na podstawie ID z wiersza
        item_id = self.table.item(row, 0).text()
        # Znajdź pełny obiekt w DB (potrzebujemy client_id i policy_id)
        term_data = next((t for t in db.get_terminations() if t['id'] == item_id), None)
        
        if not term_data:
            QMessageBox.critical(self, "Błąd", "Nie znaleziono danych wypowiedzenia.")
            return

        client = db.get_client(term_data['client_id'])
        # Polisa może być w DB, ale może być też tylko w terminations jako 'item_description'
        # Spróbujmy pobrać polisę, żeby mieć numer
        policy = None
        policies = db.get_client_policies(term_data['client_id'])
        # Szukamy po ID jeśli jest, albo po opisie
        for p in policies:
            if p['id'] == term_data['policy_id']:
                policy = p
                break
        
        if not client or not policy:
            QMessageBox.warning(self, "Dane niekompletne", "Nie można wygenerować PDF - brak powiązanych danych klienta lub polisy.")
            return

        # Dane ubezpieczyciela
        insurer = next((i for i in INSURERS_DATA if i['name'] == policy['insurer']), {'name': policy['insurer'], 'address': '...', 'city': '', 'zip': ''})

        # File Dialog
        filename = f"Wypowiedzenie_{client['last_name']}_{policy['policy_number']}.pdf"
        path, _ = QFileDialog.getSaveFileName(self, "Zapisz PDF", filename, "PDF Files (*.pdf)")
        
        if path:
            try:
                # Przygotowanie danych (flattening dla generatora)
                c_data = {
                    'firstName': client['first_name'],
                    'lastName': client['last_name'],
                    'address': client['address'],
                    'city': 'Miasto', # TODO: Parsować z adresu lub dodać pole city do Client
                    'pesel': client['pesel']
                }
                p_data = {
                    'policyNumber': policy['policy_number'],
                    'vehicleBrand': policy['object_desc'], # Lub vehicleBrand z JSON
                    'vehicleReg': '' # TODO: extract from object_desc
                }
                i_data = {
                    'name': insurer.get('legal_entity', insurer['name']),
                    'address': insurer.get('address', ''),
                    'city': '', 
                    'zip': ''
                }
                
                PdfGenerator.generate_termination(c_data, p_data, i_data, path)
                QMessageBox.information(self, "Sukces", f"Wygenerowano: {path}")
            except Exception as e:
                QMessageBox.critical(self, "Błąd generowania", str(e))
