
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QPushButton, QFrame, QScrollArea, QSizePolicy
from PyQt6.QtCore import Qt, QPropertyAnimation, QAbstractAnimation, QParallelAnimationGroup

class CollapsibleBox(QWidget):
    def __init__(self, title="", parent=None):
        super(CollapsibleBox, self).__init__(parent)
        
        self.toggle_button = QPushButton(title)
        self.toggle_button.setObjectName("CollapsibleHeader") # Używa nowego stylu z styles.py
        self.toggle_button.setCheckable(True)
        self.toggle_button.setChecked(False)
        self.toggle_button.setCursor(Qt.CursorShape.PointingHandCursor)

        self.content_area = QScrollArea()
        self.content_area.setMaximumHeight(0)
        self.content_area.setMinimumHeight(0)
        self.content_area.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.content_area.setFrameShape(QFrame.Shape.NoFrame)
        # Content background slightly lighter than base to create "card inside card" effect
        self.content_area.setStyleSheet("background-color: #18181b; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;")

        self.toggle_animation = QParallelAnimationGroup()
        self.animation = QPropertyAnimation(self.content_area, b"maximumHeight")
        self.animation.setDuration(250)
        self.toggle_animation.addAnimation(self.animation)

        self.main_layout = QVBoxLayout(self)
        self.main_layout.setSpacing(0)
        self.main_layout.setContentsMargins(0, 5, 0, 5) # Trochę odstępu między sekcjami
        self.main_layout.addWidget(self.toggle_button)
        self.main_layout.addWidget(self.content_area)

        self.toggle_button.clicked.connect(self.on_pressed)

        # Content Layout
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(10, 10, 10, 10)
        self.content_area.setWidget(self.content_widget)
        self.content_area.setWidgetResizable(True)

    def add_widget(self, widget):
        self.content_layout.addWidget(widget)

    def add_layout(self, layout):
        self.content_layout.addLayout(layout)

    def on_pressed(self):
        checked = self.toggle_button.isChecked()
        arrow = "▼" if checked else "▶"
        text = self.toggle_button.text()
        
        # Proste parsowanie, żeby nie dodawać strzałek w nieskończoność
        clean_text = text.replace("▼ ", "").replace("▶ ", "")
        self.toggle_button.setText(f"{arrow} {clean_text}")
        
        content_height = self.content_layout.sizeHint().height()
        
        self.animation.setStartValue(0 if checked else content_height)
        self.animation.setEndValue(content_height if checked else 0)
        self.animation.start()

    def set_expanded(self, expand: bool):
        if self.toggle_button.isChecked() != expand:
            self.toggle_button.setChecked(expand)
            self.on_pressed()
