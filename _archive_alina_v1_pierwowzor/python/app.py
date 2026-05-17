
import sys
import os

# Dodanie ścieżki głównej do sys.path, aby importy z 'python.' działały
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PyQt6.QtWidgets import QApplication
from python.gui.main_window import MainWindow

def main():
    app = QApplication(sys.argv)
    
    # Tworzenie i wyświetlanie głównego okna
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
