
from PyQt6.QtWidgets import QDialog, QVBoxLayout, QLabel, QPushButton, QFileDialog, QProgressBar, QMessageBox, QCheckBox
from PyQt6.QtCore import Qt, QThread, pyqtSignal
import pandas as pd
from python.db import db
from python.services.data_mapper import DataMapper

class ImportWorker(QThread):
    progress = pyqtSignal(int)
    finished = pyqtSignal(str)
    
    def __init__(self, file_path, limit_rows=True):
        super().__init__()
        self.file_path = file_path
        self.limit_rows = limit_rows

    def find_header_row(self, df_preview):
        """
        Szuka indeksu wiersza, który wygląda jak nagłówek tabeli.
        Szukamy wiersza zawierającego kluczowe słowa.
        """
        keywords = ['imię', 'nazwisko', 'klient', 'co', 'produkt', 'polisa', 'telefon', 'adres']
        
        for idx, row in df_preview.iterrows():
            # Konwertuj wiersz na jeden długi string (lowercase)
            row_str = " ".join([str(val).lower() for val in row.values if pd.notna(val)])
            
            # Sprawdź czy zawiera przynajmniej 2 słowa kluczowe (żeby uniknąć fałszywych trafień)
            matches = sum(1 for kw in keywords if kw in row_str)
            if matches >= 2:
                return idx
        return 0 # Fallback: Pierwszy wiersz

    def run(self):
        try:
            # 1. Analiza pliku Excel (Sheet Detection)
            xls = pd.ExcelFile(self.file_path)
            target_sheet = None
            
            # Priorytet 1: Arkusz "POLISY" (Format systemowy)
            for sheet in xls.sheet_names:
                if "POLISY" in sheet.upper():
                    target_sheet = sheet
                    break
            
            # Priorytet 2: Skanowanie arkuszy w poszukiwaniu kolumn kluczowych
            # Ale uwaga: tutaj tylko szukamy arkusza, nagłówek ustalimy za chwilę dokładniej
            if not target_sheet:
                for sheet in xls.sheet_names:
                    preview = pd.read_excel(xls, sheet_name=sheet, nrows=20, header=None)
                    # Szukamy czy w pierwszych 20 wierszach jest coś co przypomina nagłówek
                    header_idx = self.find_header_row(preview)
                    # Jeśli znaleźliśmy nagłówek inny niż 0 lub wiersz 0 ma sensowne dane
                    if header_idx > 0 or preview.iloc[0].astype(str).str.contains('imię|klient', case=False).any():
                        target_sheet = sheet
                        print(f"DEBUG: Wykryto dane w arkuszu: {sheet} (potencjalny nagłówek w wierszu {header_idx})")
                        break
            
            # Fallback: Pierwszy arkusz
            if not target_sheet:
                target_sheet = xls.sheet_names[0]
                print(f"DEBUG: Nie wykryto struktury, używam pierwszego arkusza: {target_sheet}")

            # 2. Ustalenie wiersza nagłówkowego (Header Row Detection)
            # Czytamy "brudny" podgląd, żeby znaleźć, w którym wierszu są nazwy kolumn
            raw_preview = pd.read_excel(xls, sheet_name=target_sheet, nrows=50, header=None)
            header_row_index = self.find_header_row(raw_preview)
            
            print(f"DEBUG: Ustalono wiersz nagłówkowy na indeks: {header_row_index}")

            # 3. Właściwe Wczytywanie Danych
            nrows = 1000 if self.limit_rows else None
            
            # Wczytujemy z parametrem 'header' ustawionym na wykryty wiersz
            df = pd.read_excel(xls, sheet_name=target_sheet, header=header_row_index, nrows=nrows)
            
            # NORMALIZACJA NAGŁÓWKÓW (Usuń spacje i nowe linie z nazw kolumn)
            # Np. "Imię \n i nazwisko " -> "Imię i nazwisko"
            df.columns = df.columns.astype(str).str.replace('\n', ' ').str.strip()
            
            # Odsianie wierszy, które są puste lub są powtórzeniem nagłówka (jeśli coś poszło nie tak)
            # Usuwamy wiersze gdzie kolumna 'co' lub 'produkt' jest pusta ORAZ imię jest puste
            # (To robi też DataMapper w 'Ghost Row Check', ale tutaj czyścimy śmieci strukturalne)
            
            total = len(df)
            processed_count = 0
            new_clients_count = 0
            new_policies_count = 0
            
            # Cache klientów
            existing_clients = db.get_all_clients()
            client_map = {}
            for c in existing_clients:
                key = c['pesel'] if len(c['pesel']) > 5 else f"{c['last_name']} {c['first_name']}".lower()
                client_map[key] = c['id']

            clients_to_add = []
            policies_to_add = []
            notes_to_add = []

            print(f"DEBUG: Rozpoczynam przetwarzanie {total} wierszy z arkusza '{target_sheet}' (Start danych od wiersza {header_row_index + 1})")
            print(f"DEBUG: Znalezione kolumny (po czyszczeniu): {df.columns.tolist()}")

            for index, row in df.iterrows():
                # Mapowanie
                mapped = DataMapper.map_row(row, client_map)
                
                if mapped:
                    if mapped['client']:
                        clients_to_add.append(mapped['client'])
                        new_clients_count += 1
                        # Update cache
                        c = mapped['client']
                        key = c['pesel'] if len(c['pesel']) > 5 else f"{c['lastName']} {c['firstName']}".lower()
                        client_map[key] = c['id']
                    
                    policies_to_add.append(mapped['policy'])
                    new_policies_count += 1
                    
                    if mapped['notes']:
                        notes_to_add.extend(mapped['notes'])
                
                processed_count += 1
                if index % 10 == 0:
                    self.progress.emit(int((index / total) * 100))
            
            # Zapis do bazy
            for c in clients_to_add: db.add_client(c)
            for p in policies_to_add: db.add_policy(p)
            for n in notes_to_add: db.add_note(n)

            limit_msg = " (Limit 1000)" if self.limit_rows and total == 1000 else ""
            self.finished.emit(f"Sukces! Import z arkusza: '{target_sheet}'{limit_msg}\nNagłówek w wierszu: {header_row_index}\nPrzetworzono wierszy: {processed_count}\nDodano Klientów: {new_clients_count}\nDodano Polis: {new_policies_count}")
            
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            self.finished.emit(f"Błąd krytyczny: {str(e)}")

class ImporterDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Import Danych (XLSX)")
        self.resize(400, 250)
        self.layout = QVBoxLayout()
        self.setLayout(self.layout)
        
        self.label = QLabel("Import ze starego systemu")
        self.label.setStyleSheet("font-weight: bold; font-size: 14px;")
        self.layout.addWidget(self.label)
        
        self.chk_limit = QCheckBox("Ogranicz do 1000 wierszy (Szybki test)")
        self.chk_limit.setChecked(True)
        self.chk_limit.setToolTip("Wyłącz, aby zaimportować całą bazę")
        self.layout.addWidget(self.chk_limit)
        
        self.btn_file = QPushButton("Wybierz Plik Excel...")
        self.btn_file.clicked.connect(self.select_file)
        self.btn_file.setStyleSheet("padding: 10px; background-color: #2563eb; color: white; font-weight: bold;")
        self.layout.addWidget(self.btn_file)
        
        self.progress = QProgressBar()
        self.layout.addWidget(self.progress)
        
        self.status = QLabel("Gotowy do importu.")
        self.status.setWordWrap(True)
        self.layout.addWidget(self.status)

    def select_file(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "Otwórz XLSX", "", "Excel Files (*.xlsx *.xls)")
        if file_path:
            self.label.setText(f"Plik: ...{file_path[-30:]}")
            self.start_import(file_path)

    def start_import(self, path):
        self.status.setText("Analizowanie pliku... Proszę czekać.")
        limit = self.chk_limit.isChecked()
        
        self.worker = ImportWorker(path, limit_rows=limit)
        self.worker.progress.connect(self.progress.setValue)
        self.worker.finished.connect(self.on_finished)
        self.worker.start()
        self.btn_file.setDisabled(True)

    def on_finished(self, msg):
        self.status.setText(msg)
        self.btn_file.setDisabled(False)
        self.progress.setValue(100)
        if "Błąd" not in msg:
            QMessageBox.information(self, "Raport Importu", msg)
            self.accept()
