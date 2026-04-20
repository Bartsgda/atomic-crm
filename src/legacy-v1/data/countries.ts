
export interface CountryInfo {
    name: string;
    code: string;
    flag: string;
    currency: string;
    region: 'UE' | 'EUROPA' | 'AFRYKA' | 'AZJA' | 'AMERYKA_PN' | 'AMERYKA_PD' | 'AUSTRALIA';
    tips: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

export const COUNTRIES_DATA: CountryInfo[] = [
    // --- UNIA EUROPEJSKA (EKUZ) ---
    { name: 'Austria', code: 'AT', flag: '🇦🇹', currency: 'EUR', region: 'UE', tips: 'EKUZ działa. Akcja górska płatna (wymagane ubezp. narciarskie!).', riskLevel: 'LOW' },
    { name: 'Belgia', code: 'BE', flag: '🇧🇪', currency: 'EUR', region: 'UE', tips: 'EKUZ działa. Wysoki standard.', riskLevel: 'LOW' },
    { name: 'Bułgaria', code: 'BG', flag: '🇧🇬', currency: 'BGN', region: 'UE', tips: 'Popularne kurorty bezpieczne. Uważać na kradzieże.', riskLevel: 'LOW' },
    { name: 'Chorwacja', code: 'HR', flag: '🇭🇷', currency: 'EUR', region: 'UE', tips: 'EKUZ działa. Warto dokupić Auto Assistance na dojazd.', riskLevel: 'LOW' },
    { name: 'Cypr', code: 'CY', flag: '🇨🇾', currency: 'EUR', region: 'UE', tips: 'Ruch lewostronny! Uważać na strefę turecką (brak ochrony EKUZ).', riskLevel: 'LOW' },
    { name: 'Czechy', code: 'CZ', flag: '🇨🇿', currency: 'CZK', region: 'UE', tips: 'EKUZ działa. Kary za brak winiet są wysokie.', riskLevel: 'LOW' },
    { name: 'Dania', code: 'DK', flag: '🇩🇰', currency: 'DKK', region: 'UE', tips: 'Bardzo drogie leczenie stomatologiczne.', riskLevel: 'LOW' },
    { name: 'Francja', code: 'FR', flag: '🇫🇷', currency: 'EUR', region: 'UE', tips: 'Współpłacenie pacjenta (ticket modérateur) - EKUZ nie pokrywa wszystkiego.', riskLevel: 'LOW' },
    { name: 'Grecja', code: 'GR', flag: '🇬🇷', currency: 'EUR', region: 'UE', tips: 'Na wyspach utrudniony dostęp do szpitali. Assistance medyczny kluczowy.', riskLevel: 'LOW' },
    { name: 'Hiszpania', code: 'ES', flag: '🇪🇸', currency: 'EUR', region: 'UE', tips: 'Szpitale publiczne vs prywatne - uważać gdzie wiezie karetka.', riskLevel: 'LOW' },
    { name: 'Holandia', code: 'NL', flag: '🇳🇱', currency: 'EUR', region: 'UE', tips: 'Wysokie koszty ratownictwa.', riskLevel: 'LOW' },
    { name: 'Irlandia', code: 'IE', flag: '🇮🇪', currency: 'EUR', region: 'UE', tips: 'Ruch lewostronny.', riskLevel: 'LOW' },
    { name: 'Litwa', code: 'LT', flag: '🇱🇹', currency: 'EUR', region: 'UE', tips: 'Bezpiecznie i blisko.', riskLevel: 'LOW' },
    { name: 'Niemcy', code: 'DE', flag: '🇩🇪', currency: 'EUR', region: 'UE', tips: 'EKUZ działa. Bardzo wysokie koszty transportu medycznego do PL.', riskLevel: 'LOW' },
    { name: 'Polska', code: 'PL', flag: '🇵🇱', currency: 'PLN', region: 'UE', tips: 'Brak dodatkowych wymagań.', riskLevel: 'LOW' },
    { name: 'Portugalia', code: 'PT', flag: '🇵🇹', currency: 'EUR', region: 'UE', tips: 'Wysokie ryzyko pożarów w lecie.', riskLevel: 'LOW' },
    { name: 'Słowacja', code: 'SK', flag: '🇸🇰', currency: 'EUR', region: 'UE', tips: 'Akcje ratownicze w górach PŁATNE (nawet z EKUZ). Polisa góry obowiązkowa.', riskLevel: 'LOW' },
    { name: 'Słowenia', code: 'SI', flag: '🇸🇮', currency: 'EUR', region: 'UE', tips: 'Winiety obowiązkowe.', riskLevel: 'LOW' },
    { name: 'Włochy', code: 'IT', flag: '🇮🇹', currency: 'EUR', region: 'UE', tips: 'Narty: Obowiązkowe OC na stoku (mandaty!). Kask dla dzieci.', riskLevel: 'LOW' },
    { name: 'Węgry', code: 'HU', flag: '🇭🇺', currency: 'HUF', region: 'UE', tips: 'EKUZ działa.', riskLevel: 'LOW' },
    { name: 'Malta', code: 'MT', flag: '🇲🇹', currency: 'EUR', region: 'UE', tips: 'Ruch lewostronny.', riskLevel: 'LOW' },
    { name: 'Szwecja', code: 'SE', flag: '🇸🇪', currency: 'SEK', region: 'UE', tips: 'Wysokie koszty życia i usług.', riskLevel: 'LOW' },

    // --- EUROPA (POZOSTAŁE) ---
    { name: 'Wielka Brytania', code: 'GB', flag: '🇬🇧', currency: 'GBP', region: 'EUROPA', tips: 'EKUZ ograniczony. Paszport wymagany. Bardzo drogja stomatologia.', riskLevel: 'MEDIUM' },
    { name: 'Norwegia', code: 'NO', flag: '🇳🇴', currency: 'NOK', region: 'EUROPA', tips: 'Bardzo wysokie koszty leczenia i transportu.', riskLevel: 'MEDIUM' },
    { name: 'Szwajcaria', code: 'CH', flag: '🇨🇭', currency: 'CHF', region: 'EUROPA', tips: 'Ekstremalnie drogie leczenie. Helikopter ratunkowy to fortuna.', riskLevel: 'HIGH' },
    { name: 'Turcja', code: 'TR', flag: '🇹🇷', currency: 'TRY', region: 'EUROPA', tips: 'EKUZ NIE DZIAŁA. Polisa z wysokim KL (min 50k EUR) konieczna. Szpitale prywatne.', riskLevel: 'MEDIUM' },
    { name: 'Ukraina', code: 'UA', flag: '🇺🇦', currency: 'UAH', region: 'EUROPA', tips: 'Strefa wojny - ubezpieczenia zazwyczaj wyłączone (klauzula wojenna).', riskLevel: 'EXTREME' },
    { name: 'Czarnogóra', code: 'ME', flag: '🇲🇪', currency: 'EUR', region: 'EUROPA', tips: 'EKUZ nie działa. Tanie leczenie, ale niski standard.', riskLevel: 'MEDIUM' },
    { name: 'Albania', code: 'AL', flag: '🇦🇱', currency: 'ALL', region: 'EUROPA', tips: 'Zalecane prywatne ubezpieczenie. Coraz popularniejsza.', riskLevel: 'MEDIUM' },
    { name: 'Islandia', code: 'IS', flag: '🇮🇸', currency: 'ISK', region: 'EUROPA', tips: 'Bardzo drogo. Warunki pogodowe zmienne.', riskLevel: 'MEDIUM' },

    // --- AFRYKA (POPULARNE) ---
    { name: 'Egipt', code: 'EG', flag: '🇪🇬', currency: 'EGP', region: 'AFRYKA', tips: 'Zemsta Faraona (leki). Nurkowanie = Sporty Wysokiego Ryzyka! Wiza.', riskLevel: 'MEDIUM' },
    { name: 'Tunezja', code: 'TN', flag: '🇹🇳', currency: 'TND', region: 'AFRYKA', tips: 'Standard szpitali różny. Warto mieć dobre Assistance.', riskLevel: 'MEDIUM' },
    { name: 'Maroko', code: 'MA', flag: '🇲🇦', currency: 'MAD', region: 'AFRYKA', tips: 'Leczenie prywatne na dobrym poziomie, ale płatne z góry.', riskLevel: 'MEDIUM' },
    { name: 'Tanzania (Zanzibar)', code: 'TZ', flag: '🇹🇿', currency: 'TZS', region: 'AFRYKA', tips: 'Malaria (profilaktyka). Koszty transportu chorego bardzo wysokie. Wiza.', riskLevel: 'HIGH' },
    { name: 'Kenia', code: 'KE', flag: '🇰🇪', currency: 'KES', region: 'AFRYKA', tips: 'Safari = Sporty Ryzykowne? Sprawdź OWU. Szczepienia.', riskLevel: 'HIGH' },

    // --- AZJA ---
    { name: 'Tajlandia', code: 'TH', flag: '🇹🇭', currency: 'THB', region: 'AZJA', tips: 'Wypadki na skuterach (wymagane prawko kat. A!). Denga.', riskLevel: 'HIGH' },
    { name: 'Wietnam', code: 'VN', flag: '🇻🇳', currency: 'VND', region: 'AZJA', tips: 'Zatrucia pokarmowe. Ruch drogowy chaotyczny.', riskLevel: 'MEDIUM' },
    { name: 'Indonezja (Bali)', code: 'ID', flag: '🇮🇩', currency: 'IDR', region: 'AZJA', tips: 'Skutery, surfing (sporty ryzykowne). Denga.', riskLevel: 'MEDIUM' },
    { name: 'Chiny', code: 'CN', flag: '🇨🇳', currency: 'CNY', region: 'AZJA', tips: 'Wiza. Cenzura internetu (VPN). Leczenie drogie dla obcokrajowców.', riskLevel: 'HIGH' },
    { name: 'Japonia', code: 'JP', flag: '🇯🇵', currency: 'JPY', region: 'AZJA', tips: 'Bardzo drogie leczenie. Bariera językowa (Assistance z tłumaczem).', riskLevel: 'HIGH' },
    { name: 'Indie', code: 'IN', flag: '🇮🇳', currency: 'INR', region: 'AZJA', tips: 'Zatrucia pokarmowe. Niski standard higieny publicznej.', riskLevel: 'MEDIUM' },
    { name: 'Zjedn. Emiraty Arabskie (Dubaj)', code: 'AE', flag: '🇦🇪', currency: 'AED', region: 'AZJA', tips: 'Leczenie na poziomie USA - ekstremalnie drogie. KL min. 100k EUR.', riskLevel: 'HIGH' },
    { name: 'Gruzja', code: 'GE', flag: '🇬🇪', currency: 'GEL', region: 'AZJA', tips: 'Turystyka górska wymaga rozszerzeń. Psy bezpańskie.', riskLevel: 'MEDIUM' },

    // --- AMERYKA PÓŁNOCNA ---
    { name: 'USA', code: 'US', flag: '🇺🇸', currency: 'USD', region: 'AMERYKA_PN', tips: 'KRYTYCZNE: Suma KL min. 200 000 USD (zalecane 500k+). Doba w szpitalu ~10k USD.', riskLevel: 'EXTREME' },
    { name: 'Kanada', code: 'CA', flag: '🇨🇦', currency: 'CAD', region: 'AMERYKA_PN', tips: 'Podobnie jak USA - bardzo wysokie koszty leczenia.', riskLevel: 'EXTREME' },
    { name: 'Meksyk', code: 'MX', flag: '🇲🇽', currency: 'MXN', region: 'AMERYKA_PN', tips: 'Bezpieczeństwo w niektórych rejonach. Szpitale prywatne dla turystów.', riskLevel: 'HIGH' },
    { name: 'Dominikana', code: 'DO', flag: '🇩🇴', currency: 'DOP', region: 'AMERYKA_PN', tips: 'Zagrożenie dengą. Szpitale prywatne wymagają płatności/karty.', riskLevel: 'MEDIUM' },

    // --- INNE ---
    { name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD', region: 'AUSTRALIA', tips: 'Odległość = drogi transport medyczny. Jadowite zwierzęta.', riskLevel: 'HIGH' },
];
