import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  FileText,
  AlertTriangle,
  RefreshCcw,
  Trello,
  Calendar,
  Car,
  Home,
  Heart,
  Plane,
  ShieldAlert,
  Building2,
  Banknote,
  Plus,
  ChevronRight,
  Clock,
  TrendingUp,
  Bell,
  UserPlus,
  Shield,
  FileEdit,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { AppState, PolicyType, SystemLogEntry } from "../types";

// ── palette ──────────────────────────────────────────────────────────────────
const G = "#d4af37";
const G_D = "#f2ca50";
const G10 = "rgba(212,175,55,0.10)";
const G15 = "rgba(212,175,55,0.15)";
const G25 = "rgba(212,175,55,0.25)";
const S = "#1e1f23";
const SH = "#292a2e";

const DAYS = [
  "Niedziela",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
];
const MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

const IMIENINY: Record<string, string> = {
  "01-01": "Marii, Mieszka", "01-02": "Izydora, Makarego", "01-03": "Genowefy, Daniela",
  "01-04": "Anieli, Tytusa", "01-05": "Edwarda, Szymona", "01-06": "Kacpra, Melchiora",
  "01-07": "Juliana, Lucjana", "01-08": "Seweryna", "01-09": "Marcjanny, Marcelego",
  "01-10": "Wilhelma, Danuty", "01-11": "Honoraty", "01-12": "Ernesta, Benedykty",
  "01-13": "Bogumiły, Weroniki", "01-14": "Feliksa, Niny", "01-15": "Arnolda, Pawła",
  "01-16": "Marcelego, Włodzimierza", "01-17": "Antoniego", "01-18": "Piotra",
  "01-19": "Henryka, Mariusza", "01-20": "Fabioli, Sebastiana", "01-21": "Agnieszki",
  "01-22": "Anastazji, Wincentego", "01-23": "Ildefonsa, Rajmunda", "01-24": "Tymoteusza, Felicji",
  "01-25": "Pawła, Elwiry", "01-26": "Pauliny, Tymoteusza", "01-27": "Przybysława, Anieli",
  "01-28": "Tomasza, Radomysła", "01-29": "Józefa, Józefy", "01-30": "Macieja, Martyny",
  "01-31": "Marceli, Marceliny",
  "02-01": "Brygidy, Ignacego", "02-02": "Marii, Piotra", "02-03": "Błażeja, Oskara",
  "02-04": "Andrzeja, Weroniki", "02-05": "Agaty, Adelajdy", "02-06": "Bogdana, Doroty",
  "02-07": "Ryszarda, Teodora", "02-08": "Hieronima, Sebastiana", "02-09": "Apolonii, Sabiny",
  "02-10": "Jacka, Elwiry", "02-11": "Lucjana, Eulalii", "02-12": "Eulalii, Damiana",
  "02-13": "Grzegorza, Katarzyny", "02-14": "Walentego, Cyryla", "02-15": "Faustyna, Jowity",
  "02-16": "Julianny, Danieli", "02-17": "Zbigniewa, Aleksego", "02-18": "Szymona, Konstancji",
  "02-19": "Konrada, Arnolda", "02-20": "Leona, Eucherego", "02-21": "Eleonory, Wiktora",
  "02-22": "Marty, Piotra", "02-23": "Romany, Polikarpa", "02-24": "Macieja, Sergiusza",
  "02-25": "Cezarego, Wiktora", "02-26": "Aleksandra, Mirosławy", "02-27": "Gabriela, Leandra",
  "02-28": "Macieja, Romany", "02-29": "Romana",
  "03-01": "Albina, Antoniny", "03-02": "Heleny, Karola", "03-03": "Kingi, Maryny",
  "03-04": "Kazimierza, Eugeniusza", "03-05": "Oliwii, Adriana", "03-06": "Rozalii, Wiktora",
  "03-07": "Tomasza, Felicyty", "03-08": "Beaty, Renaty", "03-09": "Franciszki, Dominiki",
  "03-10": "Cypriana, Aleksandra", "03-11": "Konstantego, Benedykty", "03-12": "Grzegorza, Alojzego",
  "03-13": "Bożeny, Krystyny", "03-14": "Leontyny, Matyldy", "03-15": "Klemensa, Longina",
  "03-16": "Izydora, Hieronima", "03-17": "Patryka, Gertrudy", "03-18": "Edwarda, Cyryla",
  "03-19": "Józefa, Bogdana", "03-20": "Klaudii, Joachima", "03-21": "Benedykta, Lubomiry",
  "03-22": "Katarzyny, Bogusława", "03-23": "Pelagii, Feliksa", "03-24": "Gabriela, Marka",
  "03-25": "Marii, Wiesława", "03-26": "Emanueli, Larysy", "03-27": "Lidii, Ernesta",
  "03-28": "Anieli, Jana", "03-29": "Eustachego, Wiktoryna", "03-30": "Leonarda, Amelii",
  "03-31": "Balbiny, Gwidona",
  "04-01": "Hugona, Ireny", "04-02": "Franciszka, Klary", "04-03": "Ryszarda, Benigna",
  "04-04": "Izydora, Benedykty", "04-05": "Ireny, Wincentego", "04-06": "Celestyna, Izoldy",
  "04-07": "Donata, Jana", "04-08": "Julii, Cezaryny", "04-09": "Marii, Dymitra",
  "04-10": "Michała, Apolonii", "04-11": "Leona, Filipa", "04-12": "Juliusza, Zenona",
  "04-13": "Przemysława, Martyny", "04-14": "Bernarda, Waltera", "04-15": "Anastazji, Wacława",
  "04-16": "Cecylii, Józefiny", "04-17": "Rudolfa, Roberta", "04-18": "Bogusławy, Apoloniusza",
  "04-19": "Adolfa, Tymona", "04-20": "Agnieszki, Czesława", "04-21": "Anzelma, Konrada",
  "04-22": "Łukasza, Kai", "04-23": "Jerzego, Wojciecha", "04-24": "Grzegorza, Horacego",
  "04-25": "Marka", "04-26": "Marzeny, Klaudiusza", "04-27": "Zyty, Teofila",
  "04-28": "Walerii, Piotra", "04-29": "Katarzyny, Rity", "04-30": "Mariana, Julii",
  "05-01": "Józefa, Filipa", "05-02": "Zygmunta, Atanazego", "05-03": "Marii, Aleksandry",
  "05-04": "Moniki, Floriana", "05-05": "Ireny, Juliana", "05-06": "Filipa, Jakuba",
  "05-07": "Gizeli, Benedykta", "05-08": "Stanisława, Wiktora", "05-09": "Grzegorza, Bożydara",
  "05-10": "Izydora, Antoniny", "05-11": "Franciszka, Igi", "05-12": "Dominika, Pankracego",
  "05-13": "Serwacego, Roberta", "05-14": "Bonifacego, Macieja", "05-15": "Zofii, Izydora",
  "05-16": "Andrzeja, Brendana", "05-17": "Paschalisa, Brunona", "05-18": "Jana, Eryka",
  "05-19": "Celestyna, Joanny", "05-20": "Bernardyna, Bazylego", "05-21": "Tymoteusza, Wiktora",
  "05-22": "Julii, Romy", "05-23": "Iwony, Dezyderego", "05-24": "Joanny, Zuzanny",
  "05-25": "Urbana, Bedy", "05-26": "Filipa, Jana", "05-27": "Jana Pawła, Augustyna",
  "05-28": "Justyny, Germana", "05-29": "Benedykty, Urszuli", "05-30": "Ferdynanda, Joanny",
  "05-31": "Petroneli, Anieli",
  "06-01": "Jakuba, Filipa", "06-02": "Marianny, Erazma", "06-03": "Leszka, Tamary",
  "06-04": "Franciszka, Kwiryna", "06-05": "Bonifacego, Walburgi", "06-06": "Norberta, Pauliny",
  "06-07": "Roberta, Wiesławy", "06-08": "Seweryna, Medarda", "06-09": "Felicjana, Efrema",
  "06-10": "Małgorzaty, Bogumiła", "06-11": "Barnaby, Jana", "06-12": "Jana, Onufrego",
  "06-13": "Antoniego", "06-14": "Bazylego, Elizeusza", "06-15": "Wita, Jolanty",
  "06-16": "Alicji, Lutosławy", "06-17": "Aliny, Marcjana", "06-18": "Marka, Elżbiety",
  "06-19": "Juliana, Romy", "06-20": "Bogna, Rafaela", "06-21": "Alojzego, Radosława",
  "06-22": "Pauliny, Jana", "06-23": "Wandy, Zenona", "06-24": "Jana Chrzciciela",
  "06-25": "Łucji, Dobrosława", "06-26": "Jana, Pawła", "06-27": "Cyryla, Maryli",
  "06-28": "Ireneusza, Leona", "06-29": "Piotra, Pawła", "06-30": "Marceliny, Emilii",
  "07-01": "Tomasza, Haliny", "07-02": "Marii, Urbana", "07-03": "Tomasza Apostoła",
  "07-04": "Zygmunta, Ulryka", "07-05": "Antoniego, Kajetana", "07-06": "Dominiki, Izaaka",
  "07-07": "Cyryla, Klaudii", "07-08": "Elżbiety, Prokopa", "07-09": "Wincentego, Hieronima",
  "07-10": "Sylwany, Weroniki", "07-11": "Benedykta, Olgi", "07-12": "Jana, Gwidona",
  "07-13": "Henryka, Małgorzaty", "07-14": "Kamila, Bonawentury", "07-15": "Wiktora, Henryka",
  "07-16": "Marii, Eustachego", "07-17": "Aleksego, Jadwigi", "07-18": "Sławy, Szymona",
  "07-19": "Wincentego, Arseniusza", "07-20": "Czesława, Fryderyka", "07-21": "Daniela, Wawrzyńca",
  "07-22": "Marii Magdaleny", "07-23": "Brygidy, Apolinarego", "07-24": "Kingi, Krystyny",
  "07-25": "Jakuba, Krzysztofa", "07-26": "Anny, Joachima", "07-27": "Lilii, Celestyna",
  "07-28": "Wiktora, Nazarego", "07-29": "Marty, Serafiny", "07-30": "Piotra, Julity",
  "07-31": "Ignacego, Heleny",
  "08-01": "Alfonsa, Justyna", "08-02": "Gustawa, Euzebiego", "08-03": "Lidii, Eugeniusza",
  "08-04": "Dominika, Jana", "08-05": "Oswalda, Marii", "08-06": "Sławy, Przemysława",
  "08-07": "Kajetana, Donata", "08-08": "Cyriaka, Dominika", "08-09": "Jana, Romy",
  "08-10": "Wawrzyńca", "08-11": "Zuzanny, Klary", "08-12": "Liliany, Klairy",
  "08-13": "Hipolita, Kacpra", "08-14": "Euzebiusza, Alfonsa", "08-15": "Marii, Stanisława",
  "08-16": "Joachima, Rocha", "08-17": "Anszara, Jacka", "08-18": "Ilarii, Heleny",
  "08-19": "Jana, Eudesa", "08-20": "Bernarda, Filiberta", "08-21": "Piusa, Joanny",
  "08-22": "Tymoteusza, Filipa", "08-23": "Filipa, Benedykty", "08-24": "Bartłomieja, Jerzego",
  "08-25": "Ludwika, Patrycji", "08-26": "Zefiryna, Aleksandra", "08-27": "Józefa, Moniki",
  "08-28": "Augustyna, Herminii", "08-29": "Jana, Sabiny", "08-30": "Feliksa, Rosy",
  "08-31": "Raimunda, Józefy",
  "09-01": "Idziego, Bronisława", "09-02": "Juliana, Stefana", "09-03": "Grzegorza, Szymona",
  "09-04": "Rozalii, Idziego", "09-05": "Doroty, Wawrzyńca", "09-06": "Beaty, Eugeniusza",
  "09-07": "Reginy, Melchiora", "09-08": "Marii, Adriana", "09-09": "Piotra, Sergiusza",
  "09-10": "Łukasza, Pulcherii", "09-11": "Protusa, Jacka", "09-12": "Gwidona, Radzimira",
  "09-13": "Jana, Amato", "09-14": "Wawrzyńca, Radosława", "09-15": "Marii, Nikodema",
  "09-16": "Kornelii, Cypriana", "09-17": "Roberta, Justyny", "09-18": "Ireny, Józefy",
  "09-19": "Januarego, Konstancji", "09-20": "Eustachego, Filipiny", "09-21": "Mateusza",
  "09-22": "Tomasza, Maurycego", "09-23": "Tekli, Linusa", "09-24": "Tomasza, Ruperta",
  "09-25": "Aureli, Władysławy", "09-26": "Justyny, Cypriana", "09-27": "Wincentego, Kosmy",
  "09-28": "Wacława, Wencesława", "09-29": "Michała, Gabriela, Rafała", "09-30": "Hieronima, Honoriusza",
  "10-01": "Remigiusza, Teresy", "10-02": "Leodegara, Teofila", "10-03": "Wincentego, Gerarda",
  "10-04": "Franciszka z Asyżu", "10-05": "Faustyny, Brunona", "10-06": "Brunona, Anny",
  "10-07": "Marii Różańcowej", "10-08": "Brygidy, Pelagii", "10-09": "Dionizego, Jana",
  "10-10": "Daniela, Franciszki", "10-11": "Aleksandra, Brunona", "10-12": "Maksymiliana, Wilhelma",
  "10-13": "Edwarda, Honorata", "10-14": "Kalixta, Damiana", "10-15": "Teresy",
  "10-16": "Jana, Jadwigi", "10-17": "Edwarda, Ignacego", "10-18": "Łukasza, Justyny",
  "10-19": "Jana, Pawła z Krzyża", "10-20": "Jana, Ireny", "10-21": "Urszuli, Celiny",
  "10-22": "Filipa, Korduli", "10-23": "Jana, Marleny", "10-24": "Rafała, Antoniego",
  "10-25": "Darii, Krysty", "10-26": "Lucjana, Ewarysta", "10-27": "Sabiny, Wiktora",
  "10-28": "Szymona, Judy", "10-29": "Narcyza, Eulalii", "10-30": "Alfonsa, Zenobii",
  "10-31": "Urbana, Krzysztofa",
  "11-01": "Wszystkich Świętych", "11-02": "Bolesława, Dusz Czyść.", "11-03": "Marcina, Huberta",
  "11-04": "Karola, Emeryty", "11-05": "Elżbiety, Floriana", "11-06": "Feliksa, Leonarda",
  "11-07": "Ernesta, Józefaty", "11-08": "Seweryna, Gotfryda", "11-09": "Teodora, Wiktora",
  "11-10": "Leona, Andrzeja", "11-11": "Marcina", "11-12": "Renaty, Witolda",
  "11-13": "Beniamina, Mikołaja", "11-14": "Serafina, Wawrzyńca", "11-15": "Alberta, Leopolda",
  "11-16": "Edmunda, Małgorzaty", "11-17": "Elżbiety, Grzegorza", "11-18": "Romana, Odyty",
  "11-19": "Elżbiety, Maksymiliana", "11-20": "Edmunda, Rafała", "11-21": "Janusza, Gelasiusa",
  "11-22": "Cecylii", "11-23": "Klemensa, Kolumbana", "11-24": "Emilii, Flory",
  "11-25": "Katarzyny", "11-26": "Sylwestra, Leonarda", "11-27": "Wirgiliusza, Ody",
  "11-28": "Jozafata, Stefana", "11-29": "Saturnina, Błażeja", "11-30": "Andrzeja",
  "12-01": "Eligiusza, Blanki", "12-02": "Bibianny, Cecylii", "12-03": "Franciszka",
  "12-04": "Barbary", "12-05": "Kryspiny, Sabiny", "12-06": "Mikołaja",
  "12-07": "Ambrożego, Marka", "12-08": "Marii, Beatrycze", "12-09": "Wiesławy, Leokadii",
  "12-10": "Danieli, Julii", "12-11": "Damazego, Sabiny", "12-12": "Aleksandra, Joanny",
  "12-13": "Łucji", "12-14": "Jana, Filipa", "12-15": "Niny, Celiny",
  "12-16": "Aliny, Albiny", "12-17": "Olimpii, Łazarza", "12-18": "Bogusławy, Gracjana",
  "12-19": "Dariusza, Urbana", "12-20": "Dominiki, Bogusława", "12-21": "Tomasza",
  "12-22": "Zenona, Flawiana", "12-23": "Wiktora, Sławomira", "12-24": "Adama, Ewy",
  "12-25": "Anastazji, Bożeny", "12-26": "Szczepana, Dionizego", "12-27": "Jana Ewangelisty",
  "12-28": "Innocentych", "12-29": "Dawida, Tomasza", "12-30": "Dawida, Łukasza",
  "12-31": "Sylwestra",
};

const TYPE_LABEL: Record<string, string> = {
  OC: "OC",
  AC: "AC",
  BOTH: "OC+AC",
  DOM: "Dom",
  ZYCIE: "Życie",
  PODROZ: "Turyst.",
  FIRMA: "Firma",
  INNE: "Inne",
};

const LOG_ICON: Record<string, React.ElementType> = {
  ADD_POLICY: Shield,
  UPDATE_POLICY: FileEdit,
  DELETE_POLICY: Trash2,
  ADD_CLIENT: UserPlus,
  UPDATE_CLIENT: FileEdit,
  DELETE_CLIENT: Trash2,
  ADD_NOTE: FileText,
};

// ── props ─────────────────────────────────────────────────────────────────────
interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onCategorySelect: (
    id: string,
    types: PolicyType[] | undefined,
    sortByDate: boolean,
  ) => void;
}

// ── component ─────────────────────────────────────────────────────────────────
export const LuxuryDashboard: React.FC<Props> = ({
  state,
  onNavigate,
  onCategorySelect,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const greeting =
    h < 12 ? "Dzień dobry" : h < 18 ? "Dzień dobry" : "Dobry wieczór";
  const dayName = DAYS[now.getDay()];
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayImieniny = IMIENINY[mmdd] ?? null;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    const renewals = (state.policies ?? []).filter((p) => {
      if (!p.policyEndDate || p.type === "PODROZ") return false;
      const d = differenceInDays(new Date(p.policyEndDate), today);
      return d >= -7 && d <= 30;
    }).length;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const newThisMonth = (state.policies ?? []).filter((p) => {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      return d && d >= monthStart;
    }).length;
    return [
      {
        label: "Klientów",
        value: state.clients?.length ?? 0,
        Icon: Users,
        color: "#60a5fa",
      },
      {
        label: "Polis",
        value: state.policies?.length ?? 0,
        Icon: FileText,
        color: G,
      },
      {
        label: "Wznowień (30d)",
        value: renewals,
        Icon: RefreshCcw,
        color: renewals > 0 ? "#fb923c" : G,
      },
      {
        label: "Wypowiedzeń",
        value: state.terminations?.length ?? 0,
        Icon: AlertTriangle,
        color: (state.terminations?.length ?? 0) > 0 ? "#f87171" : "#5a5950",
      },
    ];
  }, [state]);

  // ── Urgent renewals ────────────────────────────────────────────────────────
  const urgent = useMemo(() => {
    const today = new Date();
    return (state.policies ?? [])
      .filter((p) => {
        if (!p.policyEndDate) return false;
        const d = differenceInDays(new Date(p.policyEndDate), today);
        return d >= -3 && d <= 21;
      })
      .sort(
        (a, b) =>
          new Date(a.policyEndDate).getTime() -
          new Date(b.policyEndDate).getTime(),
      )
      .slice(0, 6)
      .map((p) => {
        const client = (state.clients ?? []).find((c) => c.id === p.clientId);
        const diff = differenceInDays(new Date(p.policyEndDate), today);
        return { policy: p, client, diff };
      });
  }, [state.policies, state.clients]);

  // ── Nav tiles ─────────────────────────────────────────────────────────────
  const goTo = (
    catId: string,
    types: PolicyType[] | undefined,
    sortBy: boolean,
    page: string,
  ) => {
    onCategorySelect(catId, types, sortBy);
    onNavigate(page);
  };

  const recentData = useMemo(() => {
    const byCreated = <T extends { createdAt?: string }>(arr: T[]) =>
      [...arr].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
    const cliName = (clientId: string) => {
      const c = (state.clients ?? []).find((x) => x.id === clientId);
      return c ? `${c.firstName} ${c.lastName}` : null;
    };
    const polNames = (types: string[]) =>
      byCreated((state.policies ?? []).filter((p) => types.includes(p.type)))
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—");
    const today = new Date();
    return {
      clients: byCreated(state.clients ?? [])
        .slice(0, 3)
        .map((c) => `${c.firstName} ${c.lastName}`),
      offers: byCreated(
        (state.policies ?? []).filter((p) =>
          [
            "of_do zrobienia",
            "przeł kontakt",
            "oferta_wysłana",
            "ucięty kontakt",
          ].includes(p.stage),
        ),
      )
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—"),
      vehicles: polNames(["OC", "AC", "BOTH"]),
      property: polNames(["DOM"]),
      life: polNames(["ZYCIE"]),
      travel: polNames(["PODROZ"]),
      terminations: byCreated((state.terminations ?? []) as any[])
        .slice(0, 3)
        .map((t: any) => cliName(t.clientId) ?? t.policyNumber ?? "—"),
      renewals: [...(state.policies ?? [])]
        .filter((p) => {
          const d = differenceInDays(new Date(p.policyEndDate), today);
          return d >= 0 && d <= 30;
        })
        .sort(
          (a, b) =>
            new Date(a.policyEndDate).getTime() -
            new Date(b.policyEndDate).getTime(),
        )
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—"),
    };
  }, [state.clients, state.policies, state.terminations]);

  const tiles = [
    {
      id: "clients",
      label: "Klienci",
      Icon: Users,
      count: state.clients?.length ?? 0,
      recent: recentData.clients,
      onAdd: () => onNavigate("clients", { autoCreate: true }),
      onClick: () => onNavigate("clients"),
    },
    {
      id: "offers",
      label: "Tablica",
      Icon: Trello,
      count: (state.policies ?? []).filter((p) =>
        [
          "of_do zrobienia",
          "przeł kontakt",
          "oferta_wysłana",
          "ucięty kontakt",
        ].includes(p.stage),
      ).length,
      recent: recentData.offers,
      onClick: () => {
        onCategorySelect("offers", undefined, false);
        onNavigate("offers");
      },
    },
    {
      id: "calendar",
      label: "Terminarz",
      Icon: Calendar,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("calendar"),
    },
    {
      id: "vehicles",
      label: "Pojazdy",
      Icon: Car,
      count: (state.policies ?? []).filter((p) =>
        ["OC", "AC", "BOTH"].includes(p.type),
      ).length,
      recent: recentData.vehicles,
      onAdd: () => onNavigate("new", { initialType: "OC" }),
      onClick: () =>
        goTo(
          "vehicles",
          ["OC", "AC", "BOTH"] as PolicyType[],
          false,
          "dashboard",
        ),
    },
    {
      id: "property",
      label: "Majątek",
      Icon: Home,
      count: (state.policies ?? []).filter((p) => p.type === "DOM").length,
      recent: recentData.property,
      onAdd: () => onNavigate("new", { initialType: "DOM" }),
      onClick: () =>
        goTo("property", ["DOM"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "life",
      label: "Życiowe",
      Icon: Heart,
      count: (state.policies ?? []).filter((p) => p.type === "ZYCIE").length,
      recent: recentData.life,
      onAdd: () => onNavigate("new", { initialType: "ZYCIE" }),
      onClick: () =>
        goTo("life", ["ZYCIE"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "travel",
      label: "Turyst.",
      Icon: Plane,
      count: (state.policies ?? []).filter((p) => p.type === "PODROZ").length,
      recent: recentData.travel,
      onAdd: () => onNavigate("new", { initialType: "PODROZ" }),
      onClick: () =>
        goTo("travel", ["PODROZ"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "terminations",
      label: "Wypow.",
      Icon: ShieldAlert,
      count: state.terminations?.length ?? 0,
      recent: recentData.terminations,
      onClick: () => onNavigate("terminations"),
    },
    {
      id: "renewals",
      label: "Wznowienia",
      Icon: RefreshCcw,
      count: kpis[2].value,
      recent: recentData.renewals,
      onClick: () =>
        goTo(
          "renewals",
          ["OC", "AC", "BOTH", "DOM", "ZYCIE", "FIRMA", "INNE"] as PolicyType[],
          true,
          "dashboard",
        ),
    },
    {
      id: "insurers",
      label: "Towarzystwa",
      Icon: Building2,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("insurers"),
    },
    {
      id: "finance",
      label: "Finanse",
      Icon: Banknote,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("finance"),
    },
  ];

  // ── Recent logs ───────────────────────────────────────────────────────────
  const recent = useMemo(
    () =>
      [...(state.logs ?? [])]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 8),
    [state.logs],
  );

  const relTime = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
    if (diff < 1) return "przed chwilą";
    if (diff < 60) return `${diff} min temu`;
    const hh = Math.floor(diff / 60);
    if (hh < 24) return `${hh} godz. temu`;
    return `${Math.floor(hh / 24)} dni temu`;
  };

  // ── urgency color ─────────────────────────────────────────────────────────
  const urgColor = (d: number) =>
    d <= 0 ? "#ef4444" : d <= 3 ? "#f97316" : d <= 7 ? "#eab308" : G;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-10"
      style={{
        background: "#121317",
        color: "#e3e2e7",
        fontFamily: "'Manrope',sans-serif",
      }}
    >
      {/* ── 1. HEADER: data + godzina ─────────────────────────────────── */}
      <div
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: `1px solid ${G15}` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase mb-0.5"
              style={{ color: G, letterSpacing: "0.2em" }}
            >
              {greeting}
            </p>
            <p className="text-sm font-semibold" style={{ color: "#b0aea8" }}>
              {dayName}, {dateStr}
            </p>
            {todayImieniny && (
              <p className="text-xs mt-0.5" style={{ color: "#e879a0" }}>
                Imieniny: {todayImieniny}
              </p>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: G10, border: `1px solid ${G15}` }}
          >
            <Clock size={12} style={{ color: G }} />
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: G }}
            >
              {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. KPI strip ──────────────────────────────────────────────── */}
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: S, border: `1px solid ${G15}` }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: G10 }}
            >
              <Icon size={18} strokeWidth={1.5} style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-black leading-none" style={{ color }}>
                {value}
              </p>
              <p
                className="text-[11px] font-bold uppercase tracking-wider mt-0.5"
                style={{ color: "#5a5950" }}
              >
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. PILNE: wygasające polisy ────────────────────────────────── */}
      {urgent.length > 0 && (
        <div className="px-4 mb-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(251,146,60,0.25)" }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                background: "rgba(251,146,60,0.08)",
                borderBottom: "1px solid rgba(251,146,60,0.15)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "#fb923c" }} />
                <span
                  className="text-xs font-black uppercase tracking-wider"
                  style={{ color: "#fb923c" }}
                >
                  Do Działania — Wygasające Polisy
                </span>
              </div>
              <button
                onClick={() =>
                  goTo(
                    "renewals",
                    [
                      "OC",
                      "AC",
                      "BOTH",
                      "DOM",
                      "ZYCIE",
                      "FIRMA",
                      "INNE",
                    ] as PolicyType[],
                    true,
                    "dashboard",
                  )
                }
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "#78716c" }}
              >
                Wszystkie →
              </button>
            </div>
            {/* rows */}
            <div style={{ background: "#18191d" }}>
              {urgent.map(({ policy: p, client, diff }) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() =>
                    onNavigate("client-details", {
                      client,
                      highlightPolicyId: p.id,
                    })
                  }
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: urgColor(diff) }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-semibold truncate block"
                      style={{ color: "#e3e2e7" }}
                    >
                      {client
                        ? `${client.firstName} ${client.lastName}`
                        : "Nieznany klient"}
                    </span>
                    <span className="text-[11px]" style={{ color: "#5a5950" }}>
                      {p.policyNumber || "—"} · {TYPE_LABEL[p.type] ?? p.type}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-bold"
                      style={{ color: urgColor(diff) }}
                    >
                      {diff <= 0
                        ? "PRZETERMINOWANA"
                        : diff === 1
                          ? "jutro"
                          : `${diff} dni`}
                    </p>
                    <p className="text-[11px]" style={{ color: "#5a5950" }}>
                      {new Date(p.policyEndDate).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. NAWIGACJA: kafle ───────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <p
          className="text-[11px] font-black uppercase mb-2 px-0.5"
          style={{ color: "#4d4635", letterSpacing: "0.15em" }}
        >
          Nawigacja
        </p>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              onClick={tile.onClick}
              className="relative cursor-pointer rounded-xl p-3 transition-all duration-200"
              style={{ background: S, border: `1px solid ${G15}` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = SH;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = S;
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <tile.Icon size={18} strokeWidth={1.5} style={{ color: G }} />
                {"onAdd" in tile && tile.onAdd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      (tile as any).onAdd();
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ border: `1px solid ${G25}`, color: G }}
                  >
                    <Plus size={9} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              {tile.count > 0 && (
                <div className="absolute top-2 left-8">
                  <span
                    className="text-[10px] font-bold px-1 py-px rounded-full"
                    style={{ background: G, color: "#1c1500" }}
                  >
                    {tile.count}
                  </span>
                </div>
              )}
              <p
                className="text-xs font-bold uppercase tracking-wide leading-tight"
                style={{ color: "#b0aea8" }}
              >
                {tile.label}
              </p>
              {tile.recent.length > 0 && (
                <div
                  style={{
                    borderTop: "1px solid rgba(212,175,55,0.07)",
                    marginTop: 6,
                    paddingTop: 5,
                  }}
                >
                  {tile.recent.map((name, i) => (
                    <p
                      key={i}
                      className="text-[11px] truncate leading-relaxed"
                      style={{ color: "#8a7f6e" }}
                    >
                      {name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. OSTATNIE DZIAŁANIA ─────────────────────────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[11px] font-black uppercase px-0.5"
            style={{ color: "#4d4635", letterSpacing: "0.15em" }}
          >
            Ostatnie działania
          </p>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${G15}` }}
        >
          {recent.length === 0 ? (
            <div
              className="py-8 text-center text-sm"
              style={{ color: "#5a5950", background: S }}
            >
              Brak aktywności
            </div>
          ) : (
            recent.map((log, i) => {
              const Icon = LOG_ICON[log.action] ?? Bell;
              const isDel = log.action.startsWith("DELETE");
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    background: i % 2 === 0 ? S : "#1a1b1f",
                    borderBottom:
                      i < recent.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isDel ? "rgba(239,68,68,0.1)" : G10 }}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      style={{ color: isDel ? "#ef4444" : G }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium leading-snug truncate"
                      style={{ color: "#d0cec8" }}
                    >
                      {log.details}
                    </p>
                    <p className="text-[11px]" style={{ color: "#4d4635" }}>
                      {log.entity}
                    </p>
                  </div>
                  <p
                    className="text-[11px] flex-shrink-0"
                    style={{ color: "#4d4635" }}
                  >
                    {relTime(log.timestamp)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
