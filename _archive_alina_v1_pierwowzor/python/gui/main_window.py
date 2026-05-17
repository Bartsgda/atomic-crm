
from PyQt6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QFrame, QStackedWidget, QLabel, QTableWidget, QTableWidgetItem, QHeaderView, QSplitter
from PyQt6.QtCore import Qt
from python.db import db
from python.gui.styles import DARK_THEME
from python.gui.importer_dialog import ImporterDialog
from python.gui.policy_form import PolicyForm
from python.gui.client_form import ClientForm
from python.gui.notes_widget import NotesWidget
# NEW VIEWS
from python.gui.dashboard_view import DashboardView
from python.gui.offers_view import OffersView
from python.gui.calendar_view import CalendarView
from python.gui.insurers_view import InsurersView
from python.gui.terminations_view import TerminationsView
from python.gui.subagents_view import SubAgentsView
from python.gui.raw_data_view import RawDataView # ADDED

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Drogowiec CRM Pro (Desktop)")
        self.resize(1280, 800)
        self.setStyleSheet(DARK_THEME)
        
        # State
        self.current_client_id = None
        
        # Main Layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QHBoxLayout(main_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 1. Sidebar
        sidebar = QFrame()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(250)
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 20, 0, 20)
        sidebar_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        # Logo
        title = QLabel("DROGOWIEC CRM")
        title.setStyleSheet("font-size: 18px; font-weight: 900; color: white; padding: 20px;")
        sidebar_layout.addWidget(title)

        # Nav Buttons
        self.btn_dashboard = self.create_nav_button("Pulpit", 0)
        self.btn_clients = self.create_nav_button("Klienci", 1)
        self.btn_policies = self.create_nav_button("Polisy (Wszystkie)", 2)
        self.btn_offers = self.create_nav_button("Tablica Ofert", 4)
        self.btn_calendar = self.create_nav_button("Terminarz", 5)
        self.btn_subagents = self.create_nav_button("Pośrednicy", 8) 
        self.btn_terminations = self.create_nav_button("Wypowiedzenia", 7)
        self.btn_insurers = self.create_nav_button("Towarzystwa", 6)
        self.btn_raw_data = self.create_nav_button("XLSX Master View", 9) # NEW INDEX 9
        
        sidebar_layout.addWidget(self.btn_dashboard)
        sidebar_layout.addWidget(self.btn_clients)
        sidebar_layout.addWidget(self.btn_offers)
        sidebar_layout.addWidget(self.btn_calendar)
        sidebar_layout.addWidget(self.btn_subagents) 
        sidebar_layout.addWidget(self.btn_terminations)
        sidebar_layout.addWidget(self.btn_insurers)
        sidebar_layout.addWidget(self.btn_policies)
        
        # Divider
        line = QFrame()
        line.setFrameShape(QFrame.Shape.HLine)
        line.setFrameShadow(QFrame.Shadow.Sunken)
        line.setStyleSheet("background-color: #3f3f46; margin: 10px 0;")
        sidebar_layout.addWidget(line)
        
        sidebar_layout.addWidget(self.btn_raw_data)
        
        sidebar_layout.addStretch()
        
        # Tools
        btn_import = QPushButton("Importuj XLSX")
        btn_import.setObjectName("NavButton")
        btn_import.clicked.connect(self.open_import)
        sidebar_layout.addWidget(btn_import)

        layout.addWidget(sidebar)

        # 2. Content Area
        self.stack = QStackedWidget()
        layout.addWidget(self.stack)

        # Initialize Views
        self.view_dashboard = DashboardView()
        self.view_offers = OffersView()
        self.view_calendar = CalendarView(main_window_ref=self)
        self.view_insurers = InsurersView()
        self.view_terminations = TerminationsView()
        self.view_subagents = SubAgentsView()
        self.view_raw_data = RawDataView() # NEW
        
        self.stack.addWidget(self.view_dashboard)       # 0
        self.stack.addWidget(self.create_clients_view()) # 1
        self.stack.addWidget(self.create_policies_view()) # 2
        self.stack.addWidget(self.create_client_details_view()) # 3
        self.stack.addWidget(self.view_offers)          # 4
        self.stack.addWidget(self.view_calendar)        # 5
        self.stack.addWidget(self.view_insurers)        # 6
        self.stack.addWidget(self.view_terminations)    # 7
        self.stack.addWidget(self.view_subagents)       # 8
        self.stack.addWidget(self.view_raw_data)        # 9

    def create_nav_button(self, text, index):
        btn = QPushButton(text)
        btn.setCheckable(True)
        btn.setAutoExclusive(True)
        btn.setObjectName("NavButton")
        if index == 0: btn.setChecked(True)
        btn.clicked.connect(lambda: self.switch_view(index))
        return btn

    def switch_view(self, index):
        self.stack.setCurrentIndex(index)
        if index == 0: self.view_dashboard.refresh()
        if index == 1: self.refresh_clients()
        if index == 4: self.view_offers.refresh()
        if index == 5: self.view_calendar.on_date_selected(self.view_calendar.calendar.selectedDate())
        if index == 6: self.view_insurers.refresh_table()
        if index == 7: self.view_terminations.refresh_table()
        if index == 8: self.view_subagents.refresh()
        if index == 9: self.view_raw_data.refresh()

    # --- VIEWS CREATION (Clients/Policies/Details) ---
    def create_clients_view(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        
        top_bar = QHBoxLayout()
        header = QLabel("Baza Klientów")
        header.setStyleSheet("font-size: 24px; font-weight: bold;")
        btn_add = QPushButton("+ Dodaj Klienta")
        btn_add.setObjectName("ActionButton")
        btn_add.clicked.connect(self.open_new_client_form)
        
        top_bar.addWidget(header)
        top_bar.addStretch()
        top_bar.addWidget(btn_add)
        layout.addLayout(top_bar)

        self.client_table = QTableWidget()
        self.client_table.setColumnCount(6)
        self.client_table.setHorizontalHeaderLabels(["Imię", "Nazwisko", "PESEL", "Telefon", "Adres", "ID"])
        self.client_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.client_table.setColumnHidden(5, True)
        self.client_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.client_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        
        self.client_table.cellDoubleClicked.connect(self.on_client_double_click)
        
        layout.addWidget(self.client_table)
        return page

    def create_policies_view(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.addWidget(QLabel("Wszystkie Polisy (Lista globalna)"))
        return page

    def create_client_details_view(self):
        page = QWidget()
        self.client_details_layout = QVBoxLayout(page)
        
        self.lbl_client_name = QLabel("Imię Nazwisko")
        self.lbl_client_name.setStyleSheet("font-size: 28px; font-weight: 900; color: white;")
        self.client_details_layout.addWidget(self.lbl_client_name)
        
        toolbar = QHBoxLayout()
        btn_back = QPushButton("← Wróć")
        btn_back.clicked.connect(lambda: self.switch_view(1))
        
        btn_edit_client = QPushButton("Edytuj Dane")
        btn_edit_client.clicked.connect(self.edit_current_client)
        
        btn_new_policy = QPushButton("+ Nowa Polisa")
        btn_new_policy.setObjectName("ActionButton")
        btn_new_policy.clicked.connect(self.open_new_policy_form)
        
        toolbar.addWidget(btn_back)
        toolbar.addWidget(btn_edit_client)
        toolbar.addStretch()
        toolbar.addWidget(btn_new_policy)
        self.client_details_layout.addLayout(toolbar)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        self.notes_container = QWidget()
        self.notes_layout = QVBoxLayout(self.notes_container)
        splitter.addWidget(self.notes_container)
        
        policies_widget = QWidget()
        policies_layout = QVBoxLayout(policies_widget)
        policies_layout.addWidget(QLabel("Portfel Polis"))
        
        self.policy_table = QTableWidget()
        self.policy_table.setColumnCount(6)
        self.policy_table.setHorizontalHeaderLabels(["Typ", "Przedmiot", "Nr Rej", "Towarzystwo", "Składka", "Koniec"])
        self.policy_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.policy_table.cellDoubleClicked.connect(self.on_policy_double_click)
        policies_layout.addWidget(self.policy_table)
        
        splitter.addWidget(policies_widget)
        splitter.setSizes([400, 800])
        
        self.client_details_layout.addWidget(splitter)
        
        return page

    # --- LOGIC (Clients/Policies) ---
    
    def refresh_clients(self):
        clients = db.get_all_clients()
        self.client_table.setRowCount(len(clients))
        for row, c in enumerate(clients):
            self.client_table.setItem(row, 0, QTableWidgetItem(c['first_name']))
            self.client_table.setItem(row, 1, QTableWidgetItem(c['last_name']))
            self.client_table.setItem(row, 2, QTableWidgetItem(c['pesel']))
            self.client_table.setItem(row, 3, QTableWidgetItem(c['phone']))
            self.client_table.setItem(row, 4, QTableWidgetItem(c['address']))
            self.client_table.setItem(row, 5, QTableWidgetItem(c['id']))

    def on_client_double_click(self, row, column):
        client_id = self.client_table.item(row, 5).text()
        self.open_client_details(client_id)

    def open_client_details(self, client_id):
        self.current_client_id = client_id
        
        client = db.get_client(client_id)
        if client:
            self.lbl_client_name.setText(f"{client['first_name']} {client['last_name']}")
            
            for i in range(self.notes_layout.count()):
                w = self.notes_layout.itemAt(i).widget()
                if w: w.deleteLater()
            
            self.notes_widget = NotesWidget(client_id)
            self.notes_layout.addWidget(self.notes_widget)
            
            self.refresh_client_policies(client_id)
            self.stack.setCurrentIndex(3)

    def open_new_client_form(self):
        form = ClientForm(parent=self)
        if form.exec():
            self.refresh_clients()

    def edit_current_client(self):
        if not self.current_client_id: return
        client = db.get_client(self.current_client_id)
        form = ClientForm(client_data=client, parent=self)
        if form.exec():
            self.open_client_details(self.current_client_id)

    def refresh_client_policies(self, client_id):
        policies = db.get_client_policies(client_id)
        self.policy_table.setRowCount(len(policies))
        
        self.current_client_policies = policies 
        
        for row, p in enumerate(policies):
            import json
            details = {}
            if p['json_data']:
                try: details = json.loads(p['json_data'])
                except: pass
            
            p_type = p['type']
            reg = details.get('vehicleReg', '')
            brand = details.get('vehicleBrand', '') or p['object_desc']
            
            self.policy_table.setItem(row, 0, QTableWidgetItem(p_type))
            self.policy_table.setItem(row, 1, QTableWidgetItem(brand))
            self.policy_table.setItem(row, 2, QTableWidgetItem(reg))
            self.policy_table.setItem(row, 3, QTableWidgetItem(p['insurer']))
            self.policy_table.setItem(row, 4, QTableWidgetItem(str(p['premium'])))
            self.policy_table.setItem(row, 5, QTableWidgetItem(p['end_date'][:10] if p['end_date'] else ''))

    def open_new_policy_form(self):
        if not self.current_client_id: return
        form = PolicyForm(self.current_client_id, parent=self)
        if form.exec():
            self.refresh_client_policies(self.current_client_id)

    def on_policy_double_click(self, row, column):
        policy = self.current_client_policies[row]
        import json
        full_data = {}
        if policy['json_data']:
            try: full_data = json.loads(policy['json_data'])
            except: pass
        
        full_data['id'] = policy['id']
        full_data['premium'] = policy['premium']
        
        form = PolicyForm(self.current_client_id, policy_data=full_data, parent=self)
        if form.exec():
            self.refresh_client_policies(self.current_client_id)

    def open_import(self):
        dialog = ImporterDialog(self)
        if dialog.exec():
            self.view_dashboard.refresh()
            self.refresh_clients()
            self.view_raw_data.refresh()
