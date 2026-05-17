
import re
from ..data.dictionaries import AGENT_ABBREVIATIONS, COMMON_TYPOS

class LegacyParser:
    """
    Pythonowa wersja parsera regex dla "brudnych" danych z Excela.
    Odwzorowuje logikę z crm-pro/modules/utils/legacyParser.ts
    """
    
    # REGEX PATTERNS
    PATTERNS = {
        # Wymuszamy obecność cyfry w drugiej grupie, aby "HONDA" nie wpadało jako rej.
        'REG_NUMBER': r'(?:^|[\s_])([A-Z]{1,3})\s?([A-Z0-9]*\d[A-Z0-9]*)(?:$|[\s_])',
        
        'VEHICLE_TYPE': {
            'CIEZAROWY': r'ciężarowy|ciezarowy|dostawczy|furgon|iveco|transit|sprinter|ducato|boxer|master|transporter|crafter|vito|scania|man|daf|actros',
            'MOTOCYKL': r'motocykl|motor|skuter|yamaha|honda cbr|kawasaki|suzuki|ktm|junak|vespa|piaggio',
            'QUAD': r'quad|atv|can-am|can am|bombardier|polaris',
            'CIAGNIK': r'ciągnik|ciagnik|siodłowy|rolniczy|ursus|zetor|new holland',
            'PRZYCZEPA': r'przyczepa|przyczepka|naczepa|kemping|camping',
            'AUTOBUS': r'autobus|bus \d+ os'
        },
        'FUEL': {
            'DIESEL': r'diesel|olej|tdi|hdi|dci|cdti',
            'LPG': r'lpg|gaz',
            'HYBRYDA': r'hybryda|hybrid|phev|hev',
            'ELEKTRYK': r'elektryk|electric|ev',
            'BENZYNA': r'benzyna|pb|petrol'
        },
        'SPECS': {
            # Łapie: 1870 cm3, 1.9 tdi, 2.0
            'CAPACITY': r'(\d{3,5})\s*(cm3|ccm|m3)|(\d\.\d)\s*(tdi|hdi|tsi|tfsi|cdti)',
            # Łapie: 74KW, 150KM
            'POWER': r'(\d{2,3})\s*(kw|km)',
            # Łapie: prod 2006, 2006r, samo 2006 (z ograniczeniem do 19xx/20xx)
            'YEAR': r'(?:prod\.?|rok|budowa)?\s*\b(19|20)\d{2}\b'
        },
        'HOME': {
            'KEYWORDS': r'dom|mieszkanie|lokal|budowa|działka|nieruchomość|ul\.|al\.|garaz|garaż|domek|kamienica',
            'AREA': r'(\d+([.,]\d{1,2})?)\s*(m2|mkw|metr)'
        },
        'TRAVEL': {
            'KEYWORDS': r'podróż|podroz|wyjazd|turyst|narty|urlop'
        },
        'COMPANY': {
            'KEYWORDS': r'firma|biznes|ocpd|flota|mienie|działalno|przedsiębiorc|zawodow|nzoz|medycz'
        }
    }

    @staticmethod
    def normalize_input(raw: str) -> str:
        """
        Kluczowa funkcja czyszcząca. Zamienia skróty (poj, prod) na pełne nazwy.
        """
        if not raw: return ''
        text = raw

        # 1. Regexy kontekstowe (całe frazy)
        text = re.sub(r'\bpoj(?:emno[sś][cć]|\.)?(?:\s+silnika)?\b', 'poj. silnika', text, flags=re.IGNORECASE)
        text = re.sub(r'\bpierw(?:sza|sz[ay])?(?:\s+reje?s?t?r?a?c?j?a?\.?|\s+rej\.?)?\b', 'pierw rej', text, flags=re.IGNORECASE)
        text = re.sub(r'\bprod(?:ukcj[ia])?\.?(?!\.)\b', 'prod.', text, flags=re.IGNORECASE)
        
        # 2. Naprawa spacji przy liczbach (prod.2008 -> prod. 2008)
        text = re.sub(r'(pierw rej|prod\.)(\d)', r'\1 \2', text, flags=re.IGNORECASE)
        text = re.sub(r'(poj\. silnika)(\d)', r'\1 \2', text, flags=re.IGNORECASE)

        # 3. Słownikowa zamiana słów
        def replace_word(match):
            word = match.group(0)
            lower = word.lower().rstrip('.')
            
            if lower in AGENT_ABBREVIATIONS: return AGENT_ABBREVIATIONS[lower]
            if lower in COMMON_TYPOS: return COMMON_TYPOS[lower]
            return word

        return re.sub(r'([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ.]+)', replace_word, text)

    @staticmethod
    def detect_policy_type(raw: str) -> str:
        """Wykrywa typ polisy na podstawie stringa produktowego (Priorytetyzacja)"""
        if not raw: return 'OC'
        text_lower = raw.lower()

        # 1. Nieruchomości (Silne słowa kluczowe)
        if re.search(LegacyParser.PATTERNS['HOME']['KEYWORDS'], text_lower):
            return 'DOM'
        
        # 2. Podróże
        if re.search(LegacyParser.PATTERNS['TRAVEL']['KEYWORDS'], text_lower):
            return 'PODROZ'
            
        # 3. Firma
        if re.search(LegacyParser.PATTERNS['COMPANY']['KEYWORDS'], text_lower):
            return 'FIRMA'

        # 4. Fallback -> Auto (OC/AC/BOTH)
        if 'ac' in text_lower or 'autocasco' in text_lower:
            # Uproszczenie: jeśli jest AC, to zazwyczaj pakiet (BOTH) lub AC.
            # Dla bezpieczeństwa oznaczamy jako AC, a DataMapper może to poprawić.
            return 'AC'
        
        return 'OC'

    @staticmethod
    def parse_auto_string(raw: str) -> dict:
        if not raw: return {}
        
        # Normalizacja
        processing_text = LegacyParser.normalize_input(raw)
        
        # Safety guard
        detected_type = LegacyParser.detect_policy_type(raw)
        if detected_type in ['DOM', 'PODROZ']:
            return {}

        result = {
            'vehicleReg': '',
            'vehicleBrand': '',
            'autoDetails': {}
        }

        # 1. Rejestracja
        reg_match = re.search(LegacyParser.PATTERNS['REG_NUMBER'], processing_text, re.IGNORECASE)
        if reg_match:
            candidate = (reg_match.group(1) + reg_match.group(2)).upper()
            # Odrzuć jeśli to rok (rzadki przypadek rej jak rok)
            if not re.match(r'^(19|20)\d{2}$', candidate) and len(candidate) >= 4:
                result['vehicleReg'] = candidate
                processing_text = processing_text.replace(reg_match.group(0), ' ')

        # 2. Dane techniczne
        text_lower = processing_text.lower()
        
        # Typ
        for v_type, pattern in LegacyParser.PATTERNS['VEHICLE_TYPE'].items():
            if re.search(pattern, text_lower):
                result['autoDetails']['vehicleType'] = v_type
                break
        
        # Paliwo
        for f_type, pattern in LegacyParser.PATTERNS['FUEL'].items():
            if re.search(pattern, text_lower):
                result['autoDetails']['fuelType'] = f_type
                break

        # Pojemność
        cap_match = re.search(LegacyParser.PATTERNS['SPECS']['CAPACITY'], processing_text, re.IGNORECASE)
        if cap_match:
            val = cap_match.group(1) or cap_match.group(3)
            if val:
                result['autoDetails']['engineCapacity'] = val.replace('.', '')
                processing_text = processing_text.replace(cap_match.group(0), ' ')

        # Moc
        power_match = re.search(LegacyParser.PATTERNS['SPECS']['POWER'], processing_text, re.IGNORECASE)
        if power_match:
            result['autoDetails']['enginePower'] = power_match.group(1)
            processing_text = processing_text.replace(power_match.group(0), ' ')

        # Rok
        year_match = re.search(LegacyParser.PATTERNS['SPECS']['YEAR'], processing_text, re.IGNORECASE)
        if year_match:
            result['autoDetails']['productionYear'] = year_match.group(1)
            # Nie usuwamy roku całkowicie, bo może być częścią modelu (np. Astra 2005)

        # 3. Marka (Cleaning - usuwanie śmieci)
        clean_brand = processing_text
        
        # Usuń słowa kluczowe
        junk_pattern = r'samochód[\s]+|pojazd[\s]+|motocykl[\s]+|autobus[\s]+|przyczepa[\s]+|przyczepka[\s]+|quad[\s]+|ciężarowy[\s]+|ciezarowy[\s]+|osobowy[\s]+'
        clean_brand = re.sub(junk_pattern, ' ', clean_brand, flags=re.IGNORECASE)
        
        # Usuń parametry ubezpieczeniowe
        tech_junk = r'oc\/ac|oc|ac|nnw|ass|szyby|pakiet|kosztorys|serwis|pełen|opony|samo ac|komunikacyjne|benzyna|diesel|olej napędowy'
        clean_brand = re.sub(tech_junk, ' ', clean_brand, flags=re.IGNORECASE)
        
        clean_brand = re.sub(r'[,/+]', ' ', clean_brand)
        clean_brand = re.sub(r'\s+', ' ', clean_brand).strip()
        
        # Prefiksy
        clean_brand = re.sub(r'^samo\s', '', clean_brand, flags=re.IGNORECASE)
        clean_brand = re.sub(r'^osob\s', '', clean_brand, flags=re.IGNORECASE)

        if result['vehicleReg']:
            clean_brand = clean_brand.replace(result['vehicleReg'], '')

        result['vehicleBrand'] = clean_brand.strip() or raw
        
        return result

    @staticmethod
    def parse_home_string(raw: str) -> dict:
        if not raw: return {}
        text = LegacyParser.normalize_input(raw).lower()
        result = {}

        if 'budowa' in text or 'budowie' in text: result['objectType'] = 'BUDOWA'
        elif 'letniskowy' in text: result['objectType'] = 'LETNISKOWY'
        elif 'mieszkanie' in text or 'lokal' in text: result['objectType'] = 'MIESZKANIE'
        elif 'dom' in text: result['objectType'] = 'DOM'
        
        area_match = re.search(LegacyParser.PATTERNS['HOME']['AREA'], text)
        if area_match:
            result['area'] = float(area_match.group(1).replace(',', '.'))

        year_match = re.search(LegacyParser.PATTERNS['SPECS']['YEAR'], text)
        if year_match:
            # W TypeScript: group(1) or group(0). W Python re group 0 to całe dopasowanie.
            # Regex: (?:...)\b(19|20)\d{2}\b -> group 1 to rok
            result['yearBuilt'] = year_match.group(1) or year_match.group(0)

        return result
