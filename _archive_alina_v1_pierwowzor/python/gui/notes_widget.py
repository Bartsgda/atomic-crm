
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, 
                             QPushButton, QListWidget, QListWidgetItem, QLabel)
from PyQt6.QtCore import Qt
from datetime import datetime
import uuid
from python.db import db

class NotesWidget(QWidget):
    def __init__(self, client_id, parent=None):
        super().__init__(parent)
        self.client_id = client_id
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        
        # Header
        self.layout.addWidget(QLabel("Oś Czasu / Historia"))
        
        # List of notes
        self.list_widget = QListWidget()
        self.list_widget.setStyleSheet("background-color: #27272a; border-radius: 8px;")
        self.layout.addWidget(self.list_widget)
        
        # Add new note area
        input_layout = QVBoxLayout()
        self.inp_content = QTextEdit()
        self.inp_content.setPlaceholderText("Wpisz notatkę (rozmowa, ustalenia)...")
        self.inp_content.setMaximumHeight(80)
        input_layout.addWidget(self.inp_content)
        
        btn_add = QPushButton("Dodaj Notatkę")
        btn_add.setStyleSheet("background-color: #2563eb; color: white; font-weight: bold;")
        btn_add.clicked.connect(self.add_note)
        input_layout.addWidget(btn_add)
        
        self.layout.addLayout(input_layout)
        
        self.refresh_notes()

    def refresh_notes(self):
        self.list_widget.clear()
        notes = db.get_client_notes(self.client_id)
        
        for note in notes:
            date_str = note['created_at'][:16].replace('T', ' ')
            text = f"[{date_str}] {note['tag']}\n{note['content']}"
            
            item = QListWidgetItem(text)
            # Stylowanie itemu można rozbudować
            self.list_widget.addItem(item)

    def add_note(self):
        content = self.inp_content.toPlainText().strip()
        if not content: return
        
        data = {
            'id': f"n_loc_{uuid.uuid4().hex[:8]}",
            'client_id': self.client_id,
            'policy_id': None,
            'content': content,
            'tag': 'ROZMOWA',
            'created_at': datetime.now().isoformat()
        }
        
        db.add_note(data)
        self.inp_content.clear()
        self.refresh_notes()
