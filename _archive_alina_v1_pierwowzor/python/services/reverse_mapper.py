
import json
from datetime import datetime
from ..models import Policy, Client
from ..utils.currency import format_currency

class ReverseMapper:
    """
    Odwzorowuje logikę crm-pro/services/reverseMapper.ts.
    Konwertuje ustrukturyzowane dane z bazy SQL/JSON na "brudny", płaski format
    zrozumiały dla starego Excela Agenta (kolumny 0-22) oraz dodaje
    kolumny systemowe (30+) dla pełnego backupu.
    """

    @staticmethod
    def fmt_date(iso_str: str) -> str:
        if not iso_str: return ''
        try:
            # Zakładamy format ISO YYYY-MM-DD lub YYYY-MM-DDTHH:MM:SS
            dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
            return dt.strftime('%Y-%m-%d')
        except:
            return str(iso_str)

    @staticmethod
    def generate_product_string(p: dict) -> str:
        """
        Rekonstruuje ciąg produktowy np. 'samochód_GD12345_Toyota Yaris'
        """
        # Jeśli mamy oryginalny string i nie mamy szczegółów, zwróć oryginał
        if p.get('originalProductString') and not p.get('vehicleBrand') and not p.get('propertyAddress'):
            return p['originalProductString']

        p_type = p.get('type', 'INNE')
        reg = p.get('vehicleReg', '')
        brand = p.get('vehicleBrand', '')
        model = p.get('vehicleModel', '')
        addr = p.get('propertyAddress', '')
        
        # Parsowanie json_data dla szczegółów
        details = {}
        if p.get('json_data'):
            try: details = json.loads(p['json_data'])
            except: pass
            
        auto_details = details.get('autoDetails', {})
        home_details = details.get('homeDetails', {})
        travel_details = details.get('travelDetails', {})
        life_details = details.get('lifeDetails', {})

        # Budowanie stringa technicznego
        tech_parts = []
        if auto_details.get('productionYear'): tech_parts.append(str(auto_details['productionYear']))
        if auto_details.get('engineCapacity'): tech_parts.append(f"{auto_details['engineCapacity']} cm3")
        if auto_details.get('fuelType'): tech_parts.append(auto_details['fuelType'])
        tech_details = " ".join(tech_parts)

        if p_type in ['OC', 'AC', 'BOTH']:
            v_type = auto_details.get('vehicleType', 'OSOBOWY')
            prefix = 'samochód'
            if v_type == 'MOTOCYKL': prefix = 'motocykl'
            elif v_type == 'CIEZAROWY': prefix = 'samochód ciężarowy'
            elif v_type == 'PRZYCZEPA': prefix = 'przyczepa'
            elif v_type == 'CIAGNIK': prefix = 'ciągnik'
            
            # Format: typ_REJ_Marka Model Info
            # replace usuwa podwójne podkreślniki
            raw = f"{prefix}_{reg}_{brand} {model} {tech_details}"
            return "_".join(filter(None, raw.split('_')))

        elif p_type == 'DOM':
            return f"dom_{addr}".strip()
            
        elif p_type == 'PODROZ':
            dest = p.get('destinationCountry') or travel_details.get('destinationCountry', '')
            days = f"_{travel_details['durationDays']} dni" if travel_details.get('durationDays') else ''
            return f"podróż_{dest}{days}".strip()
            
        elif p_type == 'ZYCIE':
            l_type = life_details.get('lifeType', 'Indywidualna')
            if l_type == 'SZKOLNA': l_type = 'NNW Szkolne'
            return f"życie_{l_type}".strip()
            
        elif p_type == 'FIRMA':
            return f"firma_{brand or addr}".strip()

        return p.get('originalProductString') or p_type

    @staticmethod
    def generate_notes_string(notes: list, policy: dict = None) -> str:
        # Sortowanie po dacie
        sorted_notes = sorted(notes, key=lambda n: n.get('created_at', ''))
        
        parts = []
        for n in sorted_notes:
            date_str = ReverseMapper.fmt_date(n.get('created_at'))
            tag = n.get('tag', 'ROZMOWA')
            content = n.get('content', '').replace('_', '-') # Escape separator
            
            tag_str = f" [{tag}]" if tag != 'ROZMOWA' else ""
            parts.append(f"[{date_str}]{tag_str} {content}")
            
        return "_".join(parts)

    @staticmethod
    def map_stage_to_legacy(stage: str) -> str:
        # Mapowanie 1:1 ze słownikiem Reacta
        # W bazie Python stage jest przechowywany jako string (enum), więc zazwyczaj pasuje
        return stage or 'inne'

    @staticmethod
    def map_policy_to_row(policy: dict, client: dict, notes: list, sub_agent_name: str = None) -> list:
        """
        Zwraca listę wartości odpowiadającą wierszowi w Excelu (23 kolumny legacy + systemowe).
        """
        row = [''] * 35 # Inicjalizacja pustego wiersza

        # 0. Imię i nazwisko / Firma
        name = '---'
        if client:
            # Sprawdź czy to firma (logika uproszczona, w Pythonie json_data w kliencie trzyma businesses)
            # Ale w db.py flattenujemy clienta, więc sprawdzamy pesel/nazwę
            name = f"{client['last_name']} {client['first_name']}"
        row[0] = name.strip()

        # 1. Data utworzenia
        row[1] = ReverseMapper.fmt_date(policy.get('created_at'))

        # 2. Etap
        row[2] = ReverseMapper.map_stage_to_legacy(policy.get('stage'))

        # 3. Kolejny kontakt / Koniec
        # W Pythonie pola mogą być null
        next_date = policy.get('end_date') # Fallback
        # Logika: jeśli jest nextContactDate w json_data...
        # Tutaj upraszczamy - bierzemy end_date jako kolumnę 3 (częsty pattern)
        row[3] = ReverseMapper.fmt_date(next_date)

        # 4. Telefon, 5. Email, 6. Adres, 7. PESEL/NIP
        if client:
            row[4] = client.get('phone', '')
            row[5] = client.get('email', '')
            row[6] = client.get('address', '')
            row[7] = client.get('pesel', '')

        # 8. CO (Produkt) - CRITICAL
        row[8] = ReverseMapper.generate_product_string(policy)

        # 9. Start, 10. Nr Polisy, 11. Gdzie (TU)
        row[9] = ReverseMapper.fmt_date(policy.get('start_date'))
        row[10] = policy.get('policy_number', '')
        row[11] = policy.get('insurer', '')

        # 12. Przypis (Składka)
        row[12] = policy.get('premium', 0.0)

        # 13. Kogo (Źródło)
        row[13] = sub_agent_name if sub_agent_name else 'Agent'

        # 14. Prowizja, 15. Rozliczenie (SubAgent)
        # Te dane są głębiej w json_data, ale w db.py nie ma kolumn na commission/subComm
        # Musimy wyciągnąć z JSON
        p_json = {}
        if policy.get('json_data'):
            try: p_json = json.loads(policy['json_data'])
            except: pass
        
        row[14] = p_json.get('commission', 0.0)
        
        sub_total = 0.0
        if p_json.get('subAgentSplits'):
            for s in p_json['subAgentSplits']:
                sub_total += float(s.get('amount', 0))
        elif p_json.get('subAgentCommission'):
            sub_total = float(p_json['subAgentCommission'])
            
        row[15] = sub_total

        # 16. Stara składka, 17. Stara polisa
        row[16] = p_json.get('oldPremium', '')
        
        old_info = []
        if p_json.get('oldInsurerName'): old_info.append(p_json['oldInsurerName'])
        if p_json.get('oldPolicyNumber'): old_info.append(p_json['oldPolicyNumber'])
        row[17] = " ".join(old_info)

        # 18. Współwłaściciel (Rekonstrukcja)
        co_owners = []
        auto_det = p_json.get('autoDetails', {})
        home_det = p_json.get('homeDetails', {})
        
        if auto_det.get('ownership') == 'LEASING': co_owners.append("Leasing")
        if auto_det.get('coOwners'):
            for co in auto_det['coOwners']: co_owners.append(co.get('name'))
        if home_det.get('coOwners'):
            for co in home_det['coOwners']: co_owners.append(co.get('name'))
        if home_det.get('assignmentBank'):
            co_owners.append(f"Cesja: {home_det['assignmentBank']}")
            
        row[18] = " + ".join(co_owners) if co_owners else (p_json.get('coOwner', ''))

        # 19. Notatki
        row[19] = ReverseMapper.generate_notes_string(notes, p_json)

        # 20. Dok, 21. Portal, 22. Płatność
        row[20] = p_json.get('documentsStatus', '')
        row[21] = p_json.get('portalStatus', '')
        payment = p_json.get('paymentStatus', '')
        row[22] = 'Opłacona' if payment == 'PAID' else ('Nieopłacona' if payment == 'UNPAID' else '')

        # --- SYSTEM ZONE (30+) ---
        row[30] = client['id'] if client else ''
        row[31] = policy['id']
        # Pełne JSONy dla backupu
        row[32] = json.dumps(dict(client)) if client else '{}'
        row[33] = policy['json_data'] # To już jest string JSON z bazy
        row[34] = json.dumps(notes) # Lista słowników -> JSON

        return row
