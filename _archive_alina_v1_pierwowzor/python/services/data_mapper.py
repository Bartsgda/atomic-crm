
import uuid
import json
import re
import pandas as pd
from datetime import datetime
from .legacy_parser import LegacyParser
from ..data.legacy_maps import LEGACY_MAPS

class DataMapper:
    """
    Odpowiedzialny za konwersję surowego wiersza pandas (Series) na obiekty domenowe.
    Implementuje logikę "Hybrid First" (JSON Priority -> Legacy Map -> Regex).
    """

    # Słownik aliasów - mapuje klucz logiczny na możliwe nazwy kolumn w Excelu
    COLUMN_ALIASES = {
        'name': ['Imię i nazwisk', 'Imię i nazwisko', 'Klient', 'Nazwa', 'Imię'],
        'product': ['co', 'co (produkt)', 'Produkt', 'Przedmiot', 'co?'],
        'pesel_nip': ['pesel nip regon', 'pesel', 'nip', 'regon', 'identyfikator'],
        'phone': ['nr tel', 'telefon', 'tel', 'kom'],
        'email': ['@', 'email', 'e-mail', 'mail'],
        'address': ['adres', 'ulica', 'miasto'],
        'notes': ['not', 'notatki', 'uwagi', 'opis'],
        'stage': ['etap', 'status', 'stan'],
        'insurer': ['gdzie', 'gdzie (TU)', 'tu', 'towarzystwo'],
        'policy_no': ['nr pol', 'nr polisy', 'numer polisy', 'polisa'],
        'premium': ['przyp', 'przyp (składka)', 'składka', 'przypis'],
        'commission': ['prow', 'prow (agent)', 'prowizja'],
        'sub_commission': ['rozl', 'rozl (pośrednik)', 'rozliczenie'],
        'start_date': ['start polisy', 'start', 'początek', 'od'],
        'end_date': ['koniec', 'do'],
        'old_premium': ['stara składka', 'wznowienie'],
        'old_policy': ['stara polisa', 'nr wznowienia'],
        'co_owner': ['współwł.', 'współwłaściciel', 'współużytkownik'],
        'docs': ['dok', 'dokumenty'],
        'portal': ['załączono', 'portal'],
        'payment': ['płatność', 'opłacono']
    }
    
    @staticmethod
    def _get_val(row: pd.Series, key: str, default=None):
        """Pomocnicza funkcja szukająca wartości w wierszu po liście aliasów"""
        aliases = DataMapper.COLUMN_ALIASES.get(key, [])
        candidates = aliases + [key]
        
        for col in candidates:
            if col in row.index:
                val = row[col]
                if not pd.isna(val) and val is not None:
                    return val
        return default

    @staticmethod
    def _safe_date(val):
        """Konwertuje różne formaty daty (Excel int, Timestamp, str) na ISO string YYYY-MM-DD"""
        if pd.isna(val) or val is None:
            return None
            
        try:
            # Pandas Timestamp
            if isinstance(val, (pd.Timestamp, datetime)):
                return val.strftime('%Y-%m-%d')
            
            # String parsing
            val_str = str(val).strip()
            # YYYY-MM-DD
            if re.match(r'\d{4}-\d{2}-\d{2}', val_str):
                return val_str[:10]
            # DD.MM.YYYY
            if re.match(r'\d{1,2}\.\d{1,2}\.\d{4}', val_str):
                parts = val_str.split('.')
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            
            return None
        except:
            return None

    @staticmethod
    def map_row(row: pd.Series, existing_clients_map: dict) -> dict:
        """
        Zwraca słownik { 'client': dict, 'policy': dict, 'notes': list } lub None.
        existing_clients_map: Słownik { pesel_lub_nazwisko: client_id } dla deduplikacji.
        """
        
        # Helpery
        def safe_str(val):
            return str(val).strip() if val is not None else ''
            
        def safe_float(val):
            if val is None: return 0.0
            try:
                if isinstance(val, (int, float)): return float(val)
                clean = str(val).replace(',', '.').replace(' ', '').replace('zł', '').replace('PLN', '')
                return float(clean)
            except:
                return 0.0

        # 1. Walidacja "Ghost Row" przy użyciu aliasów
        raw_name = safe_str(DataMapper._get_val(row, 'name'))
        raw_product = safe_str(DataMapper._get_val(row, 'product'))
        
        if len(raw_name) < 2 and len(raw_product) < 2:
            return None

        # --- Faza 1: Klient ---
        sys_client_json = row.get('SYS_FULL_CLIENT_JSON')
        sys_client_id = safe_str(row.get('SYS_CLIENT_ID'))
        
        client_obj = None
        client_id = None
        is_new_client = False

        if sys_client_json and isinstance(sys_client_json, str) and sys_client_json.startswith('{'):
            try:
                client_obj = json.loads(sys_client_json)
                client_id = client_obj['id']
                if client_id not in existing_clients_map.values():
                    is_new_client = True
                    key = client_obj.get('pesel') or client_obj.get('lastName', '').lower()
                    existing_clients_map[key] = client_id
            except:
                pass 
        
        if not client_obj:
            pesel_nip = safe_str(DataMapper._get_val(row, 'pesel_nip'))
            lookup_key = pesel_nip if len(pesel_nip) > 5 else raw_name.lower()
            client_id = existing_clients_map.get(lookup_key)
            
            if not client_id:
                client_id = sys_client_id if sys_client_id else f"c_loc_{uuid.uuid4().hex[:8]}"
                is_new_client = True
                existing_clients_map[lookup_key] = client_id

            if is_new_client:
                parts = raw_name.split(' ')
                last_name = parts[0]
                first_name = " ".join(parts[1:]) if len(parts) > 1 else ""
                
                client_obj = {
                    'id': client_id,
                    'firstName': first_name,
                    'lastName': last_name,
                    'pesel': pesel_nip,
                    'phone': safe_str(DataMapper._get_val(row, 'phone')),
                    'email': safe_str(DataMapper._get_val(row, 'email')),
                    'street': safe_str(DataMapper._get_val(row, 'address')),
                    'notes': safe_str(DataMapper._get_val(row, 'notes')),
                    'createdAt': datetime.now().isoformat()
                }

        # --- Faza 2: Polisa ---
        sys_policy_json = row.get('SYS_FULL_POLICY_JSON')
        policy_obj = None
        notes_obj = []
        raw_notes = safe_str(DataMapper._get_val(row, 'notes'))

        if sys_policy_json and isinstance(sys_policy_json, str) and sys_policy_json.startswith('{'):
            try:
                policy_obj = json.loads(sys_policy_json)
                sys_notes_json = row.get('SYS_FULL_NOTES_JSON')
                if sys_notes_json and isinstance(sys_notes_json, str) and sys_notes_json.startswith('['):
                    notes_obj = json.loads(sys_notes_json)
            except:
                pass 
        
        if not policy_obj:
            legacy_match = LEGACY_MAPS.get(raw_product)
            
            policy_type = 'OC'
            auto_details = {}
            home_details = {}
            travel_details = {}
            
            vehicle_reg = ''
            vehicle_brand = raw_product
            property_address = ''
            ai_note_extra = ""

            if legacy_match:
                policy_type = legacy_match.get('type', 'OC')
                vehicle_brand = legacy_match.get('vehicleBrand', raw_product)
                vehicle_reg = legacy_match.get('vehicleReg', '')
                property_address = legacy_match.get('propertyAddress', '')
                if legacy_match.get('autoDetails'): auto_details = legacy_match['autoDetails']
                if legacy_match.get('homeDetails'): home_details = legacy_match['homeDetails']
                if legacy_match.get('travelDetails'): travel_details = legacy_match['travelDetails']
                if legacy_match.get('aiNote'): ai_note_extra = legacy_match['aiNote']

            else:
                policy_type = LegacyParser.detect_policy_type(raw_product)
                if policy_type in ['OC', 'AC', 'BOTH', 'FIRMA']:
                    auto_data = LegacyParser.parse_auto_string(raw_product)
                    vehicle_reg = auto_data.get('vehicleReg', '')
                    vehicle_brand = auto_data.get('vehicleBrand', raw_product)
                    auto_details = auto_data.get('autoDetails', {})
                elif policy_type == 'DOM':
                    home_data = LegacyParser.parse_home_string(raw_product)
                    clean_addr = re.sub(r'^(dom|mieszkanie|lokal)[_ ]', '', raw_product, flags=re.IGNORECASE)
                    property_address = clean_addr
                    home_details = home_data

            raw_stage = safe_str(DataMapper._get_val(row, 'stage')).lower()
            stage = 'of_do zrobienia'
            if 'sprzeda' in raw_stage: stage = 'sprzedaż'
            elif 'przeł' in raw_stage or 'kontakt' in raw_stage: stage = 'przeł kontakt'
            elif 'oferta' in raw_stage: stage = 'oferta_wysłana'
            elif 'rez' in raw_stage: stage = 'rez po ofercie_kont za rok'

            start_date = DataMapper._safe_date(DataMapper._get_val(row, 'start_date'))
            
            # Jeśli brak daty startu, a jest to sprzedaż, weź dzisiaj. Jeśli oferta, też dzisiaj.
            if not start_date:
                start_date = datetime.now().strftime('%Y-%m-%d')

            policy_obj = {
                'id': f"p_loc_{uuid.uuid4().hex[:8]}",
                'clientId': client_id,
                'type': policy_type,
                'insurerName': safe_str(DataMapper._get_val(row, 'insurer', 'Inne')),
                'policyNumber': safe_str(DataMapper._get_val(row, 'policy_no')),
                'premium': safe_float(DataMapper._get_val(row, 'premium')),
                'commission': safe_float(DataMapper._get_val(row, 'commission')),
                'stage': stage,
                'policyStartDate': start_date,
                'policyEndDate': datetime.now().isoformat(), # TODO: Calc based on duration
                'vehicleBrand': vehicle_brand,
                'vehicleReg': vehicle_reg,
                'propertyAddress': property_address,
                'originalProductString': raw_product,
                'autoDetails': auto_details,
                'homeDetails': home_details,
                'travelDetails': travel_details
            }

            if raw_notes:
                notes_obj.append({
                    'id': f"n_imp_{uuid.uuid4().hex[:8]}",
                    'client_id': client_id,
                    'policy_id': policy_obj['id'],
                    'content': f"[IMPORT] {raw_notes}",
                    'tag': 'IMPORT',
                    'created_at': datetime.now().isoformat()
                })
            
            if ai_note_extra:
                notes_obj.append({
                    'id': f"n_ai_{uuid.uuid4().hex[:8]}",
                    'client_id': client_id,
                    'policy_id': policy_obj['id'],
                    'content': f"[AI CONTEXT] {ai_note_extra}",
                    'tag': 'IMPORT',
                    'created_at': datetime.now().isoformat()
                })

        return {
            'client': client_obj, 
            'policy': policy_obj,
            'notes': notes_obj
        }
