
# --- INSURERS (from towarzystwa.ts) ---
INSURERS = {
    "PZU": {"legal": "Powszechny Zakład Ubezpieczeń S.A.", "brand_only": False},
    "Warta": {"legal": "TUiR WARTA S.A.", "brand_only": False},
    "Ergo Hestia": {"legal": "Sopockie Towarzystwo Ubezpieczeń ERGO HESTIA S.A.", "brand_only": False},
    "Wiener": {"legal": "Wiener TU S.A. VIG", "brand_only": False},
    "Compensa": {"legal": "Compensa TU S.A. VIG", "brand_only": False},
    "Interrisk": {"legal": "InterRisk TU S.A. VIG", "brand_only": False},
    "Generali": {"legal": "Generali T.U. S.A.", "brand_only": False},
    "Allianz": {"legal": "TUiR Allianz Polska S.A.", "brand_only": False},
    "Uniqa": {"legal": "UNIQA TU S.A.", "brand_only": False},
    "Link4": {"legal": "LINK4 T.U. S.A.", "brand_only": False},
    "HDI": {"legal": "TUiR WARTA S.A.", "brand_only": True},
    "MTU": {"legal": "STU ERGO HESTIA S.A.", "brand_only": True},
    "Proama": {"legal": "Generali T.U. S.A.", "brand_only": True},
    "Trasti": {"legal": "Triglav osiguranje d.d. S.A.", "brand_only": False},
    "Balcia": {"legal": "Balcia Insurance SE", "brand_only": False},
    "Wefox": {"legal": "Wefox Insurance AG", "brand_only": False},
    "TUZ": {"legal": "TUZ TUW", "brand_only": False}
}

# --- NORMALIZATION (from normalizationDictionary.ts) ---
# Służy do czyszczenia danych z Excela przed parsowaniem regexem

AGENT_ABBREVIATIONS = {
    'produkcji': 'prod.',
    'produkcja': 'prod.',
    'prod': 'prod.',
    
    'pojemnosc': 'poj. silnika',
    'pojemność': 'poj. silnika',
    'poj': 'poj. silnika',
    
    'pierwsza': 'pierw',
    'rejestracja': 'rej',
    'rejestracyjna': 'rej',
    'rejestr': 'rej',
    'rej.': 'rej',

    'samoch': 'samochód',
    'samoch.': 'samochód',
    'osob': 'osobowy',
    'osob.': 'osobowy',
    'ciez': 'ciężarowy',
    'cięż': 'ciężarowy',
    'przycz': 'przyczepa',
    'nacz': 'naczepa',
    'moto': 'motocykl',
    'skut': 'skuter',
    
    'mieszk': 'mieszkanie',
    'miesz': 'mieszkanie',
    'lok': 'lokal',
    'bud': 'budynek',
    'gosp': 'gospodarczy',
    'ruch': 'ruchomości',
    
    'podr': 'podróż',
    'wyj': 'wyjazd',
    'zagr': 'zagraniczny',
    
    'ubezp': 'ubezpieczenie',
    'ub': 'ubezpieczenie',
    'pol': 'polisa',
    'kont': 'kontynuacja',
    'wzn': 'wznowienie',
    'szk': 'szkoda'
}

COMMON_TYPOS = {
    'samochod': 'samochód',
    'samocho': 'samochód',
    'osobwy': 'osobowy',
    'ciezarowy': 'ciężarowy',
    'podroz': 'podróż',
    'podrozne': 'podróżne',
    'podrózne': 'podróżne',
    'majatek': 'majątek',
    'garaz': 'garaż',
    'garazowy': 'garażowy',
    'dzialalnosc': 'działalność',
    'dzial': 'działalność',
    'spolka': 'spółka',
    'cywilna': 'cywilna',
    'odpowiedzialnosc': 'odpowiedzialność',
    
    'watra': 'Warta',
    'alians': 'Allianz',
    'alianz': 'Allianz',
    'ergohestia': 'Ergo Hestia',
    'compensa': 'Compensa',
    'generalli': 'Generali'
}
