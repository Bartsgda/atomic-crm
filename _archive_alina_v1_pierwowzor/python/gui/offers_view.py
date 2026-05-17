
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QListWidget, 
                             QListWidgetItem, QFrame, QMenu)
from PyQt6.QtCore import Qt
from python.db import db
from python.models import SalesStage

class KanbanColumn(QWidget):
    def __init__(self, title, stage_key, parent_view, color_border="#3f3f46"):
        super().__init__()
        self.stage_key = stage_key
        self.parent_view = parent_view
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        
        # Header
        header = QFrame()
        header.setStyleSheet(f"background-color: #27272a; border-top: 3px solid {color_border}; border-radius: 8px 8px 0 0;")
        header_layout = QHBoxLayout(header)
        lbl = QLabel(title)
        lbl.setStyleSheet("font-weight: bold; color: white;")
        header_layout.addWidget(lbl)
        
        self.count_lbl = QLabel("0")
        self.count_lbl.setStyleSheet("background-color: #3f3f46; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;")
        header_layout.addWidget(self.count_lbl)
        
        layout.addWidget(header)
        
        # List
        self.list = QListWidget()
        self.list.setStyleSheet("border: none; background-color: #18181b;")
        self.list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.list.customContextMenuRequested.connect(self.show_context_menu)
        layout.addWidget(self.list)

    def add_item(self, policy):
        # Format: "Marka Model (Rej) - Klient"
        # We need client name, so DB must provide it or we fetch it.
        # For simplicity in this version, policy object usually has everything needed or we fetch lazily.
        # Assuming db.get_policies_by_stage returns joined/enriched data or we fetch client
        
        label = f"{policy.get('insurer', '?')} | {policy.get('object_desc', '---')}"
        if policy.get('premium'):
            label += f"\nSkładka: {policy['premium']} PLN"
            
        item = QListWidgetItem(label)
        item.setData(Qt.ItemDataRole.UserRole, policy['id'])
        self.list.addItem(item)

    def show_context_menu(self, pos):
        item = self.list.itemAt(pos)
        if not item: return
        
        policy_id = item.data(Qt.ItemDataRole.UserRole)
        
        menu = QMenu()
        menu.setStyleSheet("QMenu { background-color: #27272a; color: white; } QMenu::item:selected { background-color: #dc2626; }")
        
        # Move options
        if self.stage_key != 'of_do zrobienia':
            menu.addAction("Przenieś do: DO ZROBIENIA", lambda: self.move_policy(policy_id, 'of_do zrobienia'))
        if self.stage_key != 'przeł kontakt':
            menu.addAction("Przenieś do: W TOKU", lambda: self.move_policy(policy_id, 'przeł kontakt'))
        if self.stage_key != 'oferta_wysłana':
            menu.addAction("Przenieś do: OFERTA WYSŁANA", lambda: self.move_policy(policy_id, 'oferta_wysłana'))
        
        menu.addSeparator()
        menu.addAction("✅ OZNACZ JAKO SPRZEDANE", lambda: self.move_policy(policy_id, 'sprzedaż'))
        menu.addAction("❌ ODRZUĆ (KOSZ)", lambda: self.move_policy(policy_id, 'ucięty kontakt'))
        
        menu.exec(self.list.mapToGlobal(pos))

    def move_policy(self, pid, stage):
        db.update_policy_stage(pid, stage)
        self.parent_view.refresh()

class OffersView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.main_layout = QVBoxLayout(self)
        
        header = QLabel("Tablica Ofert (Kanban)")
        header.setStyleSheet("font-size: 24px; font-weight: bold; margin: 20px;")
        self.main_layout.addWidget(header)
        
        # Columns Container
        columns_widget = QWidget()
        self.cols_layout = QHBoxLayout(columns_widget)
        self.cols_layout.setSpacing(10)
        
        # Define Columns
        self.col_todo = KanbanColumn("DO ZROBIENIA", "of_do zrobienia", self, "#ef4444") # Red
        self.col_wip = KanbanColumn("W TOKU / KALKULACJA", "przeł kontakt", self, "#3b82f6") # Blue
        self.col_sent = KanbanColumn("OFERTA WYSŁANA", "oferta_wysłana", self, "#a855f7") # Purple
        
        self.cols_layout.addWidget(self.col_todo)
        self.cols_layout.addWidget(self.col_wip)
        self.cols_layout.addWidget(self.col_sent)
        
        self.main_layout.addWidget(columns_widget)
        
        self.refresh()

    def refresh(self):
        # Clear lists
        self.col_todo.list.clear()
        self.col_wip.list.clear()
        self.col_sent.list.clear()
        
        # Fetch Data
        policies = db.get_policies_by_stage(['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana'])
        
        counts = {
            'of_do zrobienia': 0,
            'przeł kontakt': 0,
            'oferta_wysłana': 0
        }
        
        for p in policies:
            stage = p['stage']
            if stage == 'of_do zrobienia':
                self.col_todo.add_item(p)
                counts[stage] += 1
            elif stage == 'przeł kontakt':
                self.col_wip.add_item(p)
                counts[stage] += 1
            elif stage == 'oferta_wysłana':
                self.col_sent.add_item(p)
                counts[stage] += 1
                
        # Update counters
        self.col_todo.count_lbl.setText(str(counts['of_do zrobienia']))
        self.col_wip.count_lbl.setText(str(counts['przeł kontakt']))
        self.col_sent.count_lbl.setText(str(counts['oferta_wysłana']))
