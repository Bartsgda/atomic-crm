
import sqlite3
import json
from typing import List, Dict, Any
from datetime import datetime, timedelta

class Database:
    def __init__(self, db_name="drogowiec_crm.db"):
        # CRITICAL FIX: Pozwól na dostęp z innych wątków (np. ImportWorker)
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.create_tables()

    def create_tables(self):
        cursor = self.conn.cursor()
        
        # KLIENCI
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            pesel TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            notes TEXT,
            created_at TEXT
        )
        ''')

        # POLISY
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS policies (
            id TEXT PRIMARY KEY,
            client_id TEXT,
            type TEXT,
            insurer TEXT,
            policy_number TEXT,
            premium REAL,
            stage TEXT,
            start_date TEXT,
            end_date TEXT,
            object_desc TEXT,
            created_at TEXT,
            json_data TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )
        ''')

        # NOTATKI
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            client_id TEXT,
            policy_id TEXT,
            content TEXT,
            tag TEXT,
            created_at TEXT,
            reminder_date TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )
        ''')
        
        # INSURER CONFIGS
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS insurer_configs (
            name TEXT PRIMARY KEY,
            manager_name TEXT,
            manager_phone TEXT,
            manager_email TEXT,
            is_active INTEGER DEFAULT 1
        )
        ''')

        # TERMINATIONS
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS terminations (
            id TEXT PRIMARY KEY,
            client_id TEXT,
            policy_id TEXT,
            client_name TEXT,
            item_description TEXT,
            sent_at TEXT,
            actual_date TEXT,
            local_path TEXT,
            cloud_link TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )
        ''')

        # SUB AGENTS (POŚREDNICY) - NOWA TABELA
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sub_agents (
            id TEXT PRIMARY KEY,
            name TEXT,
            phone TEXT,
            email TEXT,
            default_rates_json TEXT
        )
        ''')
        
        # --- MIGRACJE (Soft Alter) ---
        try:
            cursor.execute("ALTER TABLE notes ADD COLUMN reminder_date TEXT")
        except sqlite3.OperationalError:
            pass 

        try:
            cursor.execute("ALTER TABLE policies ADD COLUMN created_at TEXT")
        except sqlite3.OperationalError:
            pass
            
        self.conn.commit()

    # --- CLIENTS ---
    def add_client(self, data: Dict[str, Any]):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO clients (id, first_name, last_name, pesel, phone, email, address, notes, created_at)
            VALUES (:id, :firstName, :lastName, :pesel, :phone, :email, :street, :notes, :createdAt)
        ''', data)
        self.conn.commit()

    def get_all_clients(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM clients ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]

    def get_client(self, client_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    # --- POLISY ---
    def add_policy(self, data: Dict[str, Any]):
        cursor = self.conn.cursor()
        json_dump = json.dumps(data)
        
        # Ensure created_at exists
        created_at = data.get('createdAt') or datetime.now().isoformat()
        
        params = {
            'id': data.get('id'),
            'client_id': data.get('clientId'),
            'type': data.get('type'),
            'insurer': data.get('insurerName'),
            'policy_number': data.get('policyNumber'),
            'premium': data.get('premium', 0),
            'stage': data.get('stage'),
            'start_date': data.get('policyStartDate'),
            'end_date': data.get('policyEndDate'),
            'object_desc': f"{data.get('vehicleBrand', '')} {data.get('vehicleReg', '')}".strip() or data.get('propertyAddress', ''),
            'created_at': created_at,
            'json_data': json_dump
        }
        cursor.execute('''
            INSERT OR REPLACE INTO policies (id, client_id, type, insurer, policy_number, premium, stage, start_date, end_date, object_desc, created_at, json_data)
            VALUES (:id, :client_id, :type, :insurer, :policy_number, :premium, :stage, :start_date, :end_date, :object_desc, :created_at, :json_data)
        ''', params)
        self.conn.commit()
    
    def update_policy_stage(self, policy_id, new_stage):
        cursor = self.conn.cursor()
        cursor.execute("UPDATE policies SET stage = ? WHERE id = ?", (new_stage, policy_id))
        self.conn.commit()

    def get_client_policies(self, client_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM policies WHERE client_id = ?", (client_id,))
        return [dict(row) for row in cursor.fetchall()]

    def get_policies_by_stage(self, stages: List[str]):
        cursor = self.conn.cursor()
        placeholders = ','.join('?' for _ in stages)
        query = f"SELECT * FROM policies WHERE stage IN ({placeholders}) ORDER BY start_date ASC"
        cursor.execute(query, stages)
        return [dict(row) for row in cursor.fetchall()]
        
    def get_all_policies(self):
        cursor = self.conn.cursor()
        # Teraz kolumna created_at istnieje dzięki migracji
        cursor.execute("SELECT * FROM policies ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]

    # --- NOTES ---
    def add_note(self, data: Dict[str, Any]):
        cursor = self.conn.cursor()
        params = {
            'id': data.get('id'),
            'client_id': data.get('clientId'),
            'policy_id': data.get('linkedPolicyIds', [None])[0] if data.get('linkedPolicyIds') else None,
            'content': data.get('content'),
            'tag': data.get('tag'),
            'created_at': data.get('createdAt'),
            'reminder_date': data.get('reminderDate')
        }
        cursor.execute('''
            INSERT OR REPLACE INTO notes (id, client_id, policy_id, content, tag, created_at, reminder_date)
            VALUES (:id, :client_id, :policy_id, :content, :tag, :created_at, :reminder_date)
        ''', params)
        self.conn.commit()

    def get_client_notes(self, client_id):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM notes WHERE client_id = ? ORDER BY created_at DESC", (client_id,))
        return [dict(row) for row in cursor.fetchall()]

    # --- TERMINATIONS ---
    def add_termination(self, data: Dict[str, Any]):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO terminations (id, client_id, policy_id, client_name, item_description, sent_at, actual_date, local_path, cloud_link)
            VALUES (:id, :clientId, :policyId, :clientName, :itemDescription, :sentAt, :actualDate, :localPath, :cloudLink)
        ''', data)
        self.conn.commit()

    def get_terminations(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM terminations ORDER BY sent_at DESC")
        return [dict(row) for row in cursor.fetchall()]

    def delete_termination(self, term_id):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM terminations WHERE id = ?", (term_id,))
        self.conn.commit()
    
    # --- SUB AGENTS ---
    def add_sub_agent(self, data: Dict[str, Any]):
        cursor = self.conn.cursor()
        params = {
            'id': data.get('id'),
            'name': data.get('name'),
            'phone': data.get('phone'),
            'email': data.get('email'),
            'default_rates_json': json.dumps(data.get('defaultRates', {}))
        }
        cursor.execute('''
            INSERT OR REPLACE INTO sub_agents (id, name, phone, email, default_rates_json)
            VALUES (:id, :name, :phone, :email, :default_rates_json)
        ''', params)
        self.conn.commit()

    def get_sub_agents(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM sub_agents ORDER BY name ASC")
        agents = []
        for row in cursor.fetchall():
            d = dict(row)
            try:
                d['defaultRates'] = json.loads(d['default_rates_json']) if d['default_rates_json'] else {}
            except:
                d['defaultRates'] = {}
            agents.append(d)
        return agents
        
    def delete_sub_agent(self, agent_id):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM sub_agents WHERE id = ?", (agent_id,))
        self.conn.commit()

    # --- INSURERS ---
    def get_insurer_configs(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM insurer_configs")
        result = {}
        for row in cursor.fetchall():
            result[row['name']] = dict(row)
        return result

    def upsert_insurer_config(self, name, manager_name, manager_phone, manager_email, is_active=1):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO insurer_configs (name, manager_name, manager_phone, manager_email, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, manager_name, manager_phone, manager_email, is_active))
        self.conn.commit()

    # --- DASHBOARD & CALENDAR ---
    def get_calendar_events(self, date_str: str):
        cursor = self.conn.cursor()
        events = []
        cursor.execute('''
            SELECT p.*, c.first_name, c.last_name 
            FROM policies p
            JOIN clients c ON p.client_id = c.id
            WHERE p.end_date LIKE ? AND p.stage IN ('sprzedaż', 'sprzedany')
        ''', (f"{date_str}%",))
        for row in cursor.fetchall():
            events.append({
                "type": "RENEWAL",
                "title": f"Koniec Polisy: {row['object_desc']}",
                "subtitle": f"{row['insurer']} | {row['first_name']} {row['last_name']}",
                "id": row['id'],
                "client_id": row['client_id']
            })
        cursor.execute('''
            SELECT n.*, c.first_name, c.last_name 
            FROM notes n
            LEFT JOIN clients c ON n.client_id = c.id
            WHERE n.reminder_date LIKE ?
        ''', (f"{date_str}%",))
        for row in cursor.fetchall():
            client_name = f"{row['first_name']} {row['last_name']}" if row['first_name'] else "System"
            events.append({
                "type": "TASK",
                "title": f"Zadanie: {row['tag']}",
                "subtitle": f"{client_name} | {row['content'][:50]}...",
                "id": row['id'],
                "client_id": row['client_id']
            })
        return events

    def get_dashboard_stats(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT SUM(premium) FROM policies WHERE stage IN ('sprzedaż', 'sprzedany')")
        total_premium = cursor.fetchone()[0] or 0
        cursor.execute("SELECT COUNT(*) FROM policies WHERE stage IN ('of_do zrobienia', 'przeł kontakt', 'oferta_wysłana')")
        active_leads = cursor.fetchone()[0] or 0
        cursor.execute("SELECT COUNT(*) FROM policies WHERE stage IN ('sprzedaż', 'sprzedany')")
        sold_count = cursor.fetchone()[0] or 0
        cursor.execute("SELECT COUNT(*) FROM clients")
        total_clients = cursor.fetchone()[0]
        return {
            "total_premium": total_premium,
            "active_leads": active_leads,
            "sold_count": sold_count,
            "total_clients": total_clients,
            "estimated_commission": total_premium * 0.15 
        }

db = Database()
