
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTreeWidget, QTreeWidgetItem, 
                             QSplitter, QFrame, QTableWidget, QTableWidgetItem, QHeaderView, QPushButton, 
                             QDialog, QFormLayout, QLineEdit, QMessageBox)
from PyQt6.QtCore import Qt
from python.db import db
import json
import pandas as pd
from datetime import datetime

class SubAgentEditDialog(QDialog):
    def __init__(self, agent_data=None, parent=None):
        super().__init__(parent)
        self.agent_data = agent_data or {}
        self.setWindowTitle("Dane Pośrednika")
        self.resize(400, 300)
        
        layout = QVBoxLayout(self)
        form = QFormLayout()
        
        self.inp_name = QLineEdit(self.agent_data.get('name', ''))
        self.inp_phone = QLineEdit(self.agent_data.get('phone', ''))
        self.inp_email = QLineEdit(self.agent_data.get('email', ''))
        
        form.addRow("Nazwa / Imię:", self.inp_name)
        form.addRow("Telefon:", self.inp_phone)
        form.addRow("E-mail:", self.inp_email)
        
        layout.addLayout(form)
        
        btns = QHBoxLayout()
        btn_save = QPushButton("Zapisz")
        btn_save.clicked.connect(self.save)
        btns.addWidget(btn_save)
        layout.addLayout(btns)

    def save(self):
        if not self.inp_name.text():
            return
        
        new_data = {
            'id': self.agent_data.get('id') or f"sa_{datetime.now().timestamp()}",
            'name': self.inp_name.text(),
            'phone': self.inp_phone.text(),
            'email': self.inp_email.text(),
            'defaultRates': self.agent_data.get('defaultRates', {})
        }
        db.add_sub_agent(new_data)
        self.accept()

class SubAgentsView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        
        # Header
        header = QHBoxLayout()
        title = QLabel("Centrum Pośredników")
        title.setStyleSheet("font-size: 24px; font-weight: bold;")
        header.addWidget(title)
        
        header.addStretch()
        
        btn_add = QPushButton("+ Dodaj Pośrednika")
        btn_add.clicked.connect(self.add_agent)
        header.addWidget(btn_add)
        
        btn_export = QPushButton("Eksport XLSX")
        btn_export.clicked.connect(self.export_report)
        header.addWidget(btn_export)
        
        self.layout.addLayout(header)
        
        # Main Splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # LEFT: Tree (Hierarchy)
        self.tree = QTreeWidget()
        self.tree.setHeaderLabel("Grupy i Agenci")
        self.tree.itemClicked.connect(self.on_agent_selected)
        splitter.addWidget(self.tree)
        
        # RIGHT: Details & History
        self.details_panel = QWidget()
        details_layout = QVBoxLayout(self.details_panel)
        
        self.lbl_agent_name = QLabel("Wybierz pośrednika...")
        self.lbl_agent_name.setStyleSheet("font-size: 18px; font-weight: bold; color: #a1a1aa;")
        details_layout.addWidget(self.lbl_agent_name)
        
        # Stats
        stats_frame = QFrame()
        stats_frame.setStyleSheet("background-color: #27272a; border-radius: 8px;")
        stats_layout = QHBoxLayout(stats_frame)
        self.lbl_total_commission = QLabel("0.00 PLN")
        self.lbl_policy_count = QLabel("0 polis")
        
        stats_layout.addWidget(QLabel("Prowizja całkowita:"))
        stats_layout.addWidget(self.lbl_total_commission)
        stats_layout.addStretch()
        stats_layout.addWidget(QLabel("Polisy:"))
        stats_layout.addWidget(self.lbl_policy_count)
        
        details_layout.addWidget(stats_frame)
        
        # Policy List
        self.policy_table = QTableWidget()
        self.policy_table.setColumnCount(5)
        self.policy_table.setHorizontalHeaderLabels(["Data", "Klient", "Polisa/Przedmiot", "Składka", "Prowizja"])
        self.policy_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        details_layout.addWidget(self.policy_table)
        
        # Edit/Delete Buttons
        action_btns = QHBoxLayout()
        self.btn_edit = QPushButton("Edytuj Dane")
        self.btn_edit.clicked.connect(self.edit_current_agent)
        self.btn_edit.setEnabled(False)
        self.btn_delete = QPushButton("Usuń")
        self.btn_delete.setStyleSheet("color: red;")
        self.btn_delete.clicked.connect(self.delete_current_agent)
        self.btn_delete.setEnabled(False)
        
        action_btns.addWidget(self.btn_edit)
        action_btns.addStretch()
        action_btns.addWidget(self.btn_delete)
        details_layout.addLayout(action_btns)
        
        splitter.addWidget(self.details_panel)
        splitter.setSizes([300, 900])
        
        self.layout.addWidget(splitter)
        
        self.current_agent = None
        self.policies_cache = []
        self.refresh()

    def refresh(self):
        self.tree.clear()
        agents = db.get_sub_agents()
        self.all_policies = db.get_all_policies()
        
        # Grouping Logic
        groups = {'FIRMOWY': [], 'WŁASNY': [], 'PARTNERZY': []}
        
        for agent in agents:
            name_lower = agent['name'].lower()
            if 'firmowy' in name_lower or '/' in agent['name']:
                groups['FIRMOWY'].append(agent)
            elif 'własny' in name_lower:
                groups['WŁASNY'].append(agent)
            else:
                groups['PARTNERZY'].append(agent)
                
        for group_name, members in groups.items():
            if not members: continue
            group_item = QTreeWidgetItem([group_name])
            group_item.setExpanded(True)
            
            # Calculate group total
            group_total = 0
            
            for agent in members:
                # Calculate simple stats
                agent_comm = 0
                for p in self.all_policies:
                    # Legacy check
                    if p.get('subAgentId') == agent['id']:
                        # Try to parse legacy float
                        try: agent_comm += float(p.get('subAgentCommission') or 0)
                        except: pass
                    # New check (subAgentSplits in json_data)
                    elif p.get('json_data'):
                        try:
                            jd = json.loads(p['json_data'])
                            if jd.get('subAgentSplits'):
                                for split in jd['subAgentSplits']:
                                    if split.get('agentId') == agent['id']:
                                        agent_comm += float(split.get('amount') or 0)
                        except: pass
                
                group_total += agent_comm
                
                child = QTreeWidgetItem([agent['name']])
                child.setData(0, Qt.ItemDataRole.UserRole, agent)
                group_item.addChild(child)
            
            group_item.setText(0, f"{group_name} ({group_total:.2f} PLN)")
            self.tree.addTopLevelItem(group_item)

    def on_agent_selected(self, item, col):
        agent = item.data(0, Qt.ItemDataRole.UserRole)
        if not agent:
            return # Group clicked
        
        self.current_agent = agent
        self.lbl_agent_name.setText(agent['name'])
        self.btn_edit.setEnabled(True)
        self.btn_delete.setEnabled(True)
        
        # Calculate details
        total_comm = 0
        count = 0
        
        self.policy_table.setRowCount(0)
        
        rows = []
        
        for p in self.all_policies:
            comm = 0
            is_related = False
            
            if p.get('subAgentId') == agent['id']:
                try: comm = float(p.get('subAgentCommission') or 0)
                except: pass
                is_related = True
            elif p.get('json_data'):
                try:
                    jd = json.loads(p['json_data'])
                    if jd.get('subAgentSplits'):
                        for split in jd['subAgentSplits']:
                            if split.get('agentId') == agent['id']:
                                comm = float(split.get('amount') or 0)
                                is_related = True
                except: pass
            
            if is_related:
                total_comm += comm
                count += 1
                
                # Fetch Client Name
                client = db.get_client(p['client_id'])
                client_name = f"{client['last_name']} {client['first_name']}" if client else "???"
                
                rows.append((
                    p['created_at'][:10],
                    client_name,
                    p['object_desc'],
                    str(p['premium']),
                    f"{comm:.2f}"
                ))
        
        self.lbl_total_commission.setText(f"{total_comm:.2f} PLN")
        self.lbl_policy_count.setText(str(count))
        
        self.policy_table.setRowCount(len(rows))
        for i, r in enumerate(rows):
            for j, val in enumerate(r):
                self.policy_table.setItem(i, j, QTableWidgetItem(val))
                
        self.policies_cache = rows # For export

    def add_agent(self):
        dlg = SubAgentEditDialog(parent=self)
        if dlg.exec():
            self.refresh()

    def edit_current_agent(self):
        if not self.current_agent: return
        dlg = SubAgentEditDialog(self.current_agent, self)
        if dlg.exec():
            self.refresh()
            
    def delete_current_agent(self):
        if not self.current_agent: return
        confirm = QMessageBox.question(self, "Potwierdź", "Usunąć pośrednika?", QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if confirm == QMessageBox.StandardButton.Yes:
            db.delete_sub_agent(self.current_agent['id'])
            self.current_agent = None
            self.refresh()

    def export_report(self):
        if not self.current_agent or not self.policies_cache:
            QMessageBox.warning(self, "Info", "Wybierz pośrednika z historią polis.")
            return
            
        try:
            import os
            filename = f"Raport_{self.current_agent['name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
            
            df = pd.DataFrame(self.policies_cache, columns=["Data", "Klient", "Przedmiot", "Składka", "Prowizja"])
            df.to_excel(filename, index=False)
            
            QMessageBox.information(self, "Sukces", f"Zapisano raport: {os.path.abspath(filename)}")
        except Exception as e:
            QMessageBox.critical(self, "Błąd", str(e))
