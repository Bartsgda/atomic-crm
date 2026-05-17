
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QCalendarWidget, 
                             QListWidget, QListWidgetItem, QFrame, QSplitter)
from PyQt6.QtCore import Qt, QDate
from python.db import db

class CalendarView(QWidget):
    def __init__(self, main_window_ref=None, parent=None):
        super().__init__(parent)
        self.main_window = main_window_ref
        
        self.layout = QHBoxLayout(self)
        
        # Splitter Layout
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # --- LEFT: Calendar Widget ---
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        
        header = QLabel("Terminarz")
        header.setStyleSheet("font-size: 24px; font-weight: bold; margin-bottom: 10px;")
        left_layout.addWidget(header)
        
        self.calendar = QCalendarWidget()
        self.calendar.setStyleSheet("""
            QCalendarWidget QAbstractItemView:enabled {
                background-color: #27272a; 
                color: white;
                selection-background-color: #dc2626;
                selection-color: white;
            }
            QCalendarWidget QWidget { alternate-background-color: #27272a; }
        """)
        self.calendar.clicked.connect(self.on_date_selected)
        left_layout.addWidget(self.calendar)
        left_layout.addStretch()
        
        # --- RIGHT: Agenda List ---
        right_panel = QFrame()
        right_panel.setStyleSheet("background-color: #18181b; border-left: 1px solid #3f3f46;")
        right_layout = QVBoxLayout(right_panel)
        
        self.lbl_selected_date = QLabel("Agenda na dziś")
        self.lbl_selected_date.setStyleSheet("font-size: 18px; font-weight: bold; color: #a1a1aa;")
        right_layout.addWidget(self.lbl_selected_date)
        
        self.event_list = QListWidget()
        self.event_list.setStyleSheet("background-color: #18181b; border: none;")
        self.event_list.itemDoubleClicked.connect(self.on_event_double_click)
        right_layout.addWidget(self.event_list)
        
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([400, 600])
        
        self.layout.addWidget(splitter)
        
        # Initial Load
        self.on_date_selected(QDate.currentDate())

    def on_date_selected(self, qdate):
        date_str = qdate.toString("yyyy-MM-dd")
        self.lbl_selected_date.setText(f"Agenda: {date_str}")
        self.load_events(date_str)

    def load_events(self, date_str):
        self.event_list.clear()
        events = db.get_calendar_events(date_str)
        
        if not events:
            item = QListWidgetItem("Brak zadań na ten dzień.")
            item.setFlags(Qt.ItemFlag.NoItemFlags) # Disabled
            self.event_list.addItem(item)
            return

        for ev in events:
            # Format text
            prefix = "🔴 KONIEC POLISY" if ev['type'] == 'RENEWAL' else "🔵 ZADANIE"
            text = f"{prefix}\n{ev['title']}\n{ev['subtitle']}"
            
            item = QListWidgetItem(text)
            item.setData(Qt.ItemDataRole.UserRole, ev) # Store full object
            
            # Basic styling via QSS on ListWidget is hard per item, so we use prefix/text
            self.event_list.addItem(item)

    def on_event_double_click(self, item):
        data = item.data(Qt.ItemDataRole.UserRole)
        if not data: return
        
        client_id = data.get('client_id')
        if client_id and self.main_window:
            self.main_window.open_client_details(client_id)
