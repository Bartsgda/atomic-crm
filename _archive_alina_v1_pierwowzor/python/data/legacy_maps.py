
# Sztywne mapowania dla przypadków, których regex nie ogarnia
# Odpowiednik: crm-pro/data/legacy/*.ts

LEGACY_MAPS = {
    # --- TRAVEL ---
    "podróżne_Malta 30.08-05.09.2025": { 
        "type": "PODROZ", "destinationCountry": "Malta", "travelStartDate": "2025-08-30", "travelEndDate": "2025-09-05", 
        "travelDetails": { "zone": "EUROPA", "durationDays": 7 } 
    },
    "podróż_05-13.12.2025 Włochy_600 tys": { 
        "type": "PODROZ", "destinationCountry": "Włochy", "travelStartDate": "2025-12-05", "travelEndDate": "2025-12-13",
        "travelDetails": { "zone": "EUROPA", "durationDays": 9, "sumMedical": 600000 }, "aiNote": "Wyjazd na narty"
    },

    # --- FIRMA / FLOTA ---
    "flota 60 pojazdów na 3 różne firmy_WGM3815L": {
        "type": "FIRMA", "businessType": "FLOTA", "vehicleReg": "WGM3815L",
        "autoDetails": { "vehicleType": "FLOTA", "insuranceItems": "60 pojazdów; 3 firmy;" },
        "aiNote": "Start od Iveco Plandeka (sierpień). Kontakt z Panią Patrycją."
    },
    "firma_przyczepa ThePhoenixBarber": {
        "type": "FIRMA", "businessType": "MAJATEK", "vehicleBrand": "Przyczepa", 
        "autoDetails": { "vehicleType": "PRZYCZEPA", "insuranceItems": "Gastronomiczna / Usługowa" }
    },

    # --- AUTO (Trudne przypadki) ---
    "samochód_GD707NN_Ford Focus 2,3 Ecoboost MR'15 RS, 2290 cm3, 257 kW, pierw rej 24-05-2017, benzyna_samo AC z dodatkami": {
        "type": "AC", "vehicleReg": "GD707NN", "vehicleBrand": "Ford", "vehicleModel": "Focus RS",
        "autoDetails": { "vehicleType": "OSOBOWY", "productionYear": "2017", "engineCapacity": "2290", "enginePower": "257", "fuelType": "BENZYNA", "acVariant": "ASO" }
    },

    # --- DOM ---
    "mieszkanie_Ciechanowska 3B/2_budowa 1991, parter, okna antywłamaniowe, alarm, 77,58 m2 mieszkanie i piwnica połącznona z mieszkaniem": {
        "type": "DOM", "propertyAddress": "Gdańsk, ul. Ciechanowska 3B/2",
        "homeDetails": { "objectType": "MIESZKANIE", "area": 77.58, "yearBuilt": "1991", "securityType": "ALARM" },
        "aiNote": "Parter, okna antywłamaniowe."
    }
}
