
export interface Insurer {
  id: string;
  name: string; // Krótka nazwa (np. Warta)
  currentLegalEntity: string; // Pełna nazwa prawna
  email: string;
  address: string;
  zipCode: string;
  city: string;
  isBrandOnly: boolean; // Czy to tylko marka (np. HDI -> Warta)
}

// PEŁNA LISTA RYNKU UBEZPIECZENIOWEGO W POLSCE
export const INSURERS: Insurer[] = [
  // --- GIGANCIE ---
  {
    id: "pzu",
    name: "PZU",
    currentLegalEntity: "Powszechny Zakład Ubezpieczeń S.A.",
    email: "kontakt@pzu.pl",
    address: "ul. Postępu 18A",
    zipCode: "02-676",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "warta",
    name: "Warta",
    currentLegalEntity: "TUiR WARTA S.A.",
    email: "wypowiedzeniaoc@warta.pl",
    address: "Rondo I. Daszyńskiego 1",
    zipCode: "00-843",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "ergo-hestia",
    name: "Ergo Hestia",
    currentLegalEntity: "Sopockie Towarzystwo Ubezpieczeń ERGO HESTIA S.A.",
    email: "poczta@ergohestia.pl",
    address: "ul. Hestii 1",
    zipCode: "81-731",
    city: "Sopot",
    isBrandOnly: false
  },
  
  // --- GRUPA VIENNA (VIG) ---
  {
    id: "wiener",
    name: "Wiener",
    currentLegalEntity: "Wiener TU S.A. VIG",
    email: "kontakt@wiener.pl",
    address: "ul. Wołoska 22A",
    zipCode: "02-675",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "compensa",
    name: "Compensa",
    currentLegalEntity: "Compensa TU S.A. VIG",
    email: "dokumenty@compensa.pl",
    address: "Al. Jerozolimskie 162",
    zipCode: "02-342",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "interrisk",
    name: "Interrisk",
    currentLegalEntity: "InterRisk TU S.A. VIG",
    email: "bok@interrisk.pl",
    address: "Al. Jerozolimskie 162",
    zipCode: "02-342",
    city: "Warszawa",
    isBrandOnly: false
  },

  // --- MIĘDZYNARODOWE ---
  {
    id: "generali",
    name: "Generali",
    currentLegalEntity: "Generali T.U. S.A.",
    email: "kontakt@generali.pl",
    address: "ul. Senatorska 18",
    zipCode: "00-082",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "allianz",
    name: "Allianz",
    currentLegalEntity: "TUiR Allianz Polska S.A.",
    email: "szkody@allianz.pl",
    address: "ul. Rodziny Hiszpańskich 1",
    zipCode: "02-685",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "uniqa",
    name: "Uniqa",
    currentLegalEntity: "UNIQA TU S.A.",
    email: "centrala@uniqa.pl",
    address: "ul. Chłodna 51",
    zipCode: "00-867",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "link4",
    name: "Link4",
    currentLegalEntity: "LINK4 T.U. S.A.",
    email: "bok@link4.pl",
    address: "ul. Postępu 15",
    zipCode: "02-676",
    city: "Warszawa",
    isBrandOnly: false
  },

  // --- MARKI I DIRECT (Często potrzebne do wypowiedzeń) ---
  {
    id: "hdi",
    name: "HDI",
    currentLegalEntity: "TUiR WARTA S.A.",
    email: "wypowiedzeniaoc@warta.pl",
    address: "Rondo I. Daszyńskiego 1",
    zipCode: "00-843",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "mtu",
    name: "MTU",
    currentLegalEntity: "STU ERGO HESTIA S.A.",
    email: "poczta@mtu.pl",
    address: "ul. Hestii 1",
    zipCode: "81-731",
    city: "Sopot",
    isBrandOnly: true
  },
  {
    id: "mtu24",
    name: "MTU24",
    currentLegalEntity: "STU ERGO HESTIA S.A.",
    email: "poczta@mtu.pl",
    address: "ul. Hestii 1",
    zipCode: "81-731",
    city: "Sopot",
    isBrandOnly: true
  },
  {
    id: "proama",
    name: "Proama",
    currentLegalEntity: "Generali T.U. S.A.",
    email: "centrumklienta@proama.pl",
    address: "ul. Senatorska 18",
    zipCode: "00-082",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "axa",
    name: "AXA",
    currentLegalEntity: "UNIQA TU S.A.",
    email: "centrala@uniqa.pl",
    address: "ul. Chłodna 51",
    zipCode: "00-867",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "aviva",
    name: "Aviva",
    currentLegalEntity: "TUiR Allianz Polska S.A.",
    email: "bok@allianz.pl",
    address: "ul. Rodziny Hiszpańskich 1",
    zipCode: "02-685",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "liberty",
    name: "Liberty",
    currentLegalEntity: "AXA Ubezpieczenia TUiR S.A. (obecnie UNIQA)",
    email: "centrala@uniqa.pl",
    address: "ul. Chłodna 51",
    zipCode: "00-867",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "you-can-drive",
    name: "You Can Drive",
    currentLegalEntity: "STU ERGO HESTIA S.A.",
    email: "poczta@ergohestia.pl",
    address: "ul. Hestii 1",
    zipCode: "81-731",
    city: "Sopot",
    isBrandOnly: true
  },
  {
    id: "trasti",
    name: "Trasti",
    currentLegalEntity: "Triglav osiguranje d.d. S.A. Oddział w Polsce",
    email: "kontakt@trasti.pl",
    address: "ul. Hrubieszowska 2",
    zipCode: "01-209",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "beesafe",
    name: "Beesafe",
    currentLegalEntity: "Compensa TU S.A. VIG",
    email: "kontakt@beesafe.pl",
    address: "Al. Jerozolimskie 162",
    zipCode: "02-342",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "pevno",
    name: "Pevno",
    currentLegalEntity: "PEVNO Sp. z o.o. (MGA)",
    email: "kontakt@pevno.pl",
    address: "ul. Konstruktorska 11",
    zipCode: "02-673",
    city: "Warszawa",
    isBrandOnly: false
  },

  // --- MNIEJSZE / SPECJALISTYCZNE ---
  {
    id: "tuz",
    name: "TUZ",
    currentLegalEntity: "TUZ TUW",
    email: "centrala@tuz.pl",
    address: "ul. Poleczki 35",
    zipCode: "02-822",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "balcia",
    name: "Balcia",
    currentLegalEntity: "Balcia Insurance SE",
    email: "info@balcia.pl",
    address: "Al. Jerozolimskie 136",
    zipCode: "02-305",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "euroins",
    name: "Euroins",
    currentLegalEntity: "Euroins Insurance Group",
    email: "reklamacje@eins.pl",
    address: "ul. Puławska 543",
    zipCode: "02-884",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "wefox",
    name: "Wefox",
    currentLegalEntity: "Wefox Insurance AG",
    email: "polska@wefox.com",
    address: "Złota 59",
    zipCode: "00-120",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "tuw",
    name: "TUW",
    currentLegalEntity: "Towarzystwo Ubezpieczeń Wzajemnych „TUW”",
    email: "centrala@tuw.pl",
    address: "ul. Raabego 13",
    zipCode: "02-793",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "pocztowe",
    name: "Pocztowe",
    currentLegalEntity: "Pocztowe Towarzystwo Ubezpieczeń Wzajemnych",
    email: "info@ubezpieczeniapocztowe.pl",
    address: "ul. Mickiewicza 19",
    zipCode: "26-600",
    city: "Radom",
    isBrandOnly: false
  },
  {
    id: "saltus",
    name: "Saltus",
    currentLegalEntity: "SALTUS TUW",
    email: "info@saltus.pl",
    address: "ul. Władysława IV 22",
    zipCode: "81-743",
    city: "Sopot",
    isBrandOnly: false
  },
  {
    id: "agro",
    name: "Agro Ubezpieczenia",
    currentLegalEntity: "Pocztowe TUW",
    email: "info@agroubezpieczenia.pl",
    address: "ul. Mickiewicza 19",
    zipCode: "26-600",
    city: "Radom",
    isBrandOnly: true
  },
  
  // --- ŻYCIOWE / INNE ---
  {
    id: "nn",
    name: "Nationale-Nederlanden",
    currentLegalEntity: "Nationale-Nederlanden TUnŻ S.A.",
    email: "info@nn.pl",
    address: "ul. Topiel 12",
    zipCode: "00-342",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "prudential",
    name: "Prudential",
    currentLegalEntity: "Prudential International Assurance plc S.A. Oddział w Polsce",
    email: "bok@prudential.pl",
    address: "ul. Puławska 182",
    zipCode: "02-670",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "unum",
    name: "Unum",
    currentLegalEntity: "Unum Życie TUiR S.A.",
    email: "kontakt@unum.pl",
    address: "ul. Łucka 2/4/6",
    zipCode: "00-845",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "aegon",
    name: "Aegon",
    currentLegalEntity: "Aegon TUnŻ S.A.",
    email: "kontakt@aegon.pl",
    address: "ul. Wołoska 5",
    zipCode: "02-675",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "metlife",
    name: "MetLife",
    currentLegalEntity: "Nationale-Nederlanden TUnŻ S.A.",
    email: "info@nn.pl",
    address: "ul. Topiel 12",
    zipCode: "00-342",
    city: "Warszawa",
    isBrandOnly: true
  },
  {
    id: "signal-iduna",
    name: "Signal Iduna",
    currentLegalEntity: "SIGNAL IDUNA Polska TU S.A.",
    email: "info@signal-iduna.pl",
    address: "ul. Siedmiogrodzka 9",
    zipCode: "01-204",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "lloyds",
    name: "Lloyd's",
    currentLegalEntity: "Lloyd's Insurance Company S.A. Oddział w Polsce",
    email: "lloydspolska@lloyds.com",
    address: "ul. Emilii Plater 53",
    zipCode: "00-113",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "colonnade",
    name: "Colonnade",
    currentLegalEntity: "Colonnade Insurance S.A. Oddział w Polsce",
    email: "info@colonnade.pl",
    address: "ul. Marszałkowska 126",
    zipCode: "00-008",
    city: "Warszawa",
    isBrandOnly: false
  },
  {
    id: "leadenhall",
    name: "Leadenhall",
    currentLegalEntity: "Leadenhall Insurance S.A.",
    email: "biuro@leadenhall.pl",
    address: "ul. rtm. Witolda Pileckiego 63",
    zipCode: "02-781",
    city: "Warszawa",
    isBrandOnly: false
  }
];
