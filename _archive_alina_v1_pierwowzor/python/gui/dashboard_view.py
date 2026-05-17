
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame, 
                             QGridLayout, QScrollArea)
from PyQt6.QtCore import Qt
from python.db import db

class StatCard(QFrame):
    def __init__(self, title, value, subtext, color_class="neutral", parent=None):
        super().__init__(parent)
        self.setObjectName("StatCard")
        
        # Styling map
        colors = {
            "neutral": ("#27272a", "#a1a1aa", "#ffffff"), # zinc-800
            "emerald": ("#064e3b", "#6ee7b7", "#ffffff"), # emerald-900
            "blue":    ("#1e3a8a", "#93c5fd", "#ffffff"), # blue-900
            "amber":   ("#78350f", "#fcd34d", "#ffffff")  # amber-900
        }
        bg, sub_col, val_col = colors.get(color_class, colors["neutral"])
        
        self.setStyleSheet(f"""
            QFrame#StatCard {{
                background-color: {bg};
                border-radius: 16px;
                border: 1px solid {bg};
            }}
        """)
        
        layout = QVBoxLayout(self)
        
        lbl_title = QLabel(title)
        lbl_title.setStyleSheet(f"color: {sub_col}; font-size: 10px; font-weight: bold; text-transform: uppercase;")
        layout.addWidget(lbl_title)
        
        lbl_value = QLabel(str(value))
        lbl_value.setStyleSheet(f"color: {val_col}; font-size: 24px; font-weight: 900;")
        layout.addWidget(lbl_value)
        
        if subtext:
            lbl_sub = QLabel(subtext)
            lbl_sub.setStyleSheet(f"color: {sub_col}; font-size: 11px;")
            layout.addWidget(lbl_sub)

class DashboardView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # Scroll Area wrap
        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0,0,0,0)
        
        header = QLabel("Pulpit Agenta")
        header.setStyleSheet("font-size: 24px; font-weight: bold; margin: 20px;")
        self.main_layout.addWidget(header)
        
        # Stats Grid
        self.stats_container = QWidget()
        self.stats_layout = QGridLayout(self.stats_container)
        self.stats_layout.setContentsMargins(20, 0, 20, 20)
        self.stats_layout.setSpacing(15)
        
        self.main_layout.addWidget(self.stats_container)
        self.main_layout.addStretch()
        
        self.refresh()

    def refresh(self):
        # Clear existing widgets in grid
        for i in reversed(range(self.stats_layout.count())): 
            self.stats_layout.itemAt(i).widget().setParent(None)
            
        data = db.get_dashboard_stats()
        
        # 1. Total Premium (Emerald)
        card_prem = StatCard("Wartość Portfela", f"{data['total_premium']:,.2f} PLN", "Przypis brutto", "emerald")
        self.stats_layout.addWidget(card_prem, 0, 0)
        
        # 2. Commission (Emerald/Blue)
        card_comm = StatCard("Szacowana Prowizja", f"{data['estimated_commission']:,.2f} PLN", "Około 15%", "emerald")
        self.stats_layout.addWidget(card_comm, 0, 1)
        
        # 3. Active Leads (Amber)
        card_leads = StatCard("Otwarte Leady", str(data['active_leads']), "W toku / Oferty", "amber")
        self.stats_layout.addWidget(card_leads, 0, 2)
        
        # 4. Sold Count (Blue)
        card_sold = StatCard("Sprzedaż (Szt.)", str(data['sold_count']), "Polisy zakończone", "blue")
        self.stats_layout.addWidget(card_sold, 1, 0)
        
        # 5. Clients (Neutral)
        card_clients = StatCard("Baza Klientów", str(data['total_clients']), "Wszyscy w bazie", "neutral")
        self.stats_layout.addWidget(card_clients, 1, 1)
