
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTableWidget, 
                             QTableWidgetItem, QHeaderView, QPushButton, QLineEdit, QMessageBox)
from PyQt6.QtCore import Qt
import pandas as pd
import json
from datetime import datetime
from python.db import db
from python.services.reverse_mapper import ReverseMapper
from python.data.insurers import INSURERS_DATA

# Definicje kolumn legacy (zgodne z React)
POLICY_COLUMNS = [
    "Imię i nazwisk", "kontakt / sprzedaż", "etap", "kol kont", "nr tel", "@", "adres", 
    "pesel nip regon", "co (produkt)", "start polisy", "nr pol", "gdzie (TU)", "przyp (składka)", 
    "kogo (źródło)", "prow (agent)", "rozl (pośrednik)", "stara składka", "stara polisa", 
    "współwł.", "notatki", "dok", "załączono", "płatność"
]

SMART_SHEETS = {
    'POJAZDY': ['samochód', 'pojazd', 'auto', 'motocykl', 'przyczepa', 'oc ', 'ac '],
    'MAJATEK': ['dom', 'mieszkanie', 'lokal', 'budowa', 'mur'],
    'ZYCIE': ['życie', 'zycie', 'nnw', 'szpital'],
    'PODROZ': ['podróż', 'podroz', 'wyjazd']
}

class RawDataView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        
        # --- HEADER ---
        header = QHBoxLayout()
        
        title_block = QVBoxLayout()
        title = QLabel("XLSX Master View")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: white;")
        sub = QLabel("Relacyjna Baza Danych v4.6 (Python Core)")
        sub.setStyleSheet("color: #059669; font-weight: bold; font-size: 11px;")
        title_block.addWidget(title)
        title_block.addWidget(sub)
        header.addLayout(title_block)
        
        header.addStretch()
        
        self.search = QLineEdit()
        self.search.setPlaceholderText("Szukaj w bazie (klient, polisa)...")
        self.search.setFixedWidth(250)
        self.search.textChanged.connect(self.filter_table)
        header.addWidget(self.search)
        
        btn_export = QPushButton("Eksportuj (8 Arkuszy)")
        btn_export.setStyleSheet("background-color: #059669; color: white; font-weight: bold; padding: 10px 20px; border-radius: 8px;")
        btn_export.clicked.connect(self.handle_export)
        header.addWidget(btn_export)
        
        self.layout.addLayout(header)
        
        # --- TABLE ---
        self.table = QTableWidget()
        self.table.setColumnCount(len(POLICY_COLUMNS) + 2) # +2 for debug IDs
        self.table.setHorizontalHeaderLabels(POLICY_COLUMNS + ["SYS_CLIENT", "SYS_POLICY"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.setStyleSheet("""
            QTableWidget { background-color: #18181b; color: #e4e4e7; gridline-color: #3f3f46; }
            QHeaderView::section { background-color: #27272a; padding: 4px; border: 1px solid #3f3f46; }
            QTableWidget::item { padding: 4px; }
        """)
        
        self.layout.addWidget(self.table)
        
        # Data Cache
        self.full_rows = [] 
        self.refresh()

    def refresh(self):
        # 1. Fetch Data
        policies = db.get_all_policies()
        clients = {c['id']: c for c in db.get_all_clients()}
        sub_agents = {sa['id']: sa for sa in db.get_sub_agents()}
        
        # 2. Build Rows using ReverseMapper
        self.full_rows = []
        
        for p in policies:
            client = clients.get(p['client_id'])
            notes = db.get_client_notes(p['client_id']) # Get all, mapper filters relevant
            # Filter notes for this policy (logic from mapper)
            policy_notes = [n for n in notes if n['policy_id'] == p['id'] or (not n['policy_id'] and n['client_id'] == p['client_id'])]
            
            # SubAgent Name resolving
            sa_name = None
            if p.get('json_data'):
                try:
                    jd = json.loads(p['json_data'])
                    if jd.get('subAgentId') and jd['subAgentId'] in sub_agents:
                        sa_name = sub_agents[jd['subAgentId']]['name']
                    elif jd.get('subAgentSplits'):
                        # Take first
                        sid = jd['subAgentSplits'][0]['agentId']
                        if sid in sub_agents: sa_name = sub_agents[sid]['name']
                except: pass

            row_data = ReverseMapper.map_policy_to_row(p, client, policy_notes, sa_name)
            self.full_rows.append(row_data)

        self.filter_table()

    def filter_table(self):
        term = self.search.text().lower()
        
        filtered = [
            r for r in self.full_rows 
            if any(term in str(cell).lower() for cell in r[:23]) # Search only in visible columns
        ]
        
        self.table.setRowCount(len(filtered))
        self.table.setColumnCount(len(POLICY_COLUMNS) + 2) # Limit columns in UI
        
        for row_idx, row_data in enumerate(filtered):
            for col_idx, cell_data in enumerate(row_data):
                if col_idx >= 23 and col_idx < 30: continue # Skip empty buffer cols
                
                # UI Column Mapping
                ui_col = col_idx
                if col_idx >= 30: ui_col = col_idx - 7 # Shift system cols to be visible at end
                
                if ui_col < self.table.columnCount():
                    item = QTableWidgetItem(str(cell_data))
                    self.table.setItem(row_idx, ui_col, item)

    def handle_export(self):
        try:
            # 1. Prepare DataFrames
            
            # --- Sheet 1: KLIENCI ---
            clients_data = db.get_all_clients()
            df_clients = pd.DataFrame(clients_data)
            
            # --- Sheet 2: POLISY (Main) ---
            # Use full_rows which already has the correct Excel structure (35 columns)
            # Headers need to match 0-34
            headers = POLICY_COLUMNS + [f"buffer_{i}" for i in range(23, 30)] + \
                      ["SYS_CLIENT_ID", "SYS_POLICY_ID", "SYS_FULL_CLIENT_JSON", "SYS_FULL_POLICY_JSON", "SYS_FULL_NOTES_JSON"]
            
            df_policies = pd.DataFrame(self.full_rows, columns=headers)
            
            # --- Sheet 7: POSREDNICY (Financial Report) ---
            sub_agents = db.get_sub_agents()
            # Logic for monthly pivot... for MVP, just dump list
            df_subagents = pd.DataFrame(sub_agents)
            
            # --- Sheet 8: TOWARZYSTWA ---
            df_insurers = pd.DataFrame(INSURERS_DATA)

            # 2. Write to Excel
            filename = f"Baza_CRM_Python_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
            
            with pd.ExcelWriter(filename, engine='openpyxl') as writer:
                df_clients.to_excel(writer, sheet_name="KLIENCI", index=False)
                df_policies.to_excel(writer, sheet_name="POLISY", index=False)
                
                # Smart Sheets (Filtering Pandas)
                for sheet_name, keywords in SMART_SHEETS.items():
                    # Filter policies where 'co (produkt)' column contains keyword
                    # Column index 8 is 'co (produkt)'
                    col_product = "co (produkt)"
                    mask = df_policies[col_product].astype(str).apply(lambda x: any(k in x.lower() for k in keywords))
                    df_smart = df_policies[mask]
                    df_smart.to_excel(writer, sheet_name=sheet_name, index=False)
                
                df_subagents.to_excel(writer, sheet_name="POSREDNICY", index=False)
                df_insurers.to_excel(writer, sheet_name="TOWARZYSTWA", index=False)
                
            QMessageBox.information(self, "Eksport Zakończony", f"Utworzono plik:\n{filename}")
            
        except Exception as e:
            QMessageBox.critical(self, "Błąd Eksportu", str(e))
