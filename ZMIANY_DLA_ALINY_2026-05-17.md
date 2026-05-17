# Co nowego w CRM — wersja z 17 maja 2026

> _Tekst do wklejenia Alinie (Messenger / SMS / mail). Nieformalny, bez technicznego żargonu._
> **Wysyłasz po deploymencie — lokalny dist/ jest gotowy, deploy zrobi Bartek.**

---

Cześć! Wgrałam nową wersję CRM. Wejdź jak zwykle i zrób **Ctrl+Shift+R** (lub na telefonie: wyczyść cache przeglądarki dla tej strony) — żeby złapać nowe pliki.

## ✅ Co naprawione

- **Aplikacja trzyma zalogowanie prawidłowo po uśpieniu kompa** — wcześniej po zamknięciu i ponownym otwarciu laptopa mogłaś być „zalogowana" bez wpisywania hasła, co nie było OK. Teraz po 30 minutach bez aktywności lub po budzeniu ze snu aplikacja grzecznie pyta o hasło od nowa.

- **Import XLSX: Bartku naprawił kilka rzeczy** *(dot. Ciebie jeśli kiedyś importujesz nowe polisy z Excela)*:
  - Zduplikowane polisy przy ponownym imporcie — już nie dublują się wpisy
  - Pośrednicy (Hejka, Beata, Osip…) poprawnie przypisywani przy imporcie
  - Adresy: `ul./os./al.` rozpoznawane bez błędów
  - Daty notatek: pobiera faktyczną datę ze XLSX, nie datę importu

- **Imieniny na pulpicie** — drobna poprawka, wyświetla się zawsze, nie tylko po odświeżeniu.

## 🆕 Nowości (od 15 maja, które widzisz po raz pierwszy)

- **Chmurka „Do uzupełnienia" (prawy dolny róg)** — sama zlicza rzeczy które warto uzupełnić: brakujące numery rejestracyjne, NIP firmy, niepełne polisy. Klikasz w pozycję → otwiera od razu właściwą kartę.
  - **✅ Zrobione** — gdy uzupełnisz
  - **⏰ Pomiń dziś** — wraca jutro z rana
  - **🚫 Pomiń trwale** — nie interesuje mnie to pole

- **Flagi „TODO" przy polisach** — przy liście klientów i na karcie polisy widać teraz małe znaczniki co brakuje. Dzięki temu w kilka sekund wiesz co wymaga Twojej uwagi bez przeglądania każdej polisy osobno.

- **Dzień + data + imieniny na górze Pulpitu** — np. *„Sobota · 17 maja 2026 · 🎂 Imieniny: Sławomir, Wiesław"*. Przydaje się przy gratulacjach.

## 🟡 Co wisi (czekam na Ciebie)

W panelu zgłoszeń (ikona oka 👁 prawy dolny róg → „Moje zgłoszenia") masz odpowiedzi przy każdym Twoim punkcie. Trzy wciąż *„W toku"*:

1. **„ASS muszę z palca też wpisywać"** — nie widzę jeszcze o którym polu mówisz. Pokaż mi przy okazji telefonem?
2. **„Dzielony ekran — coś się przewija pod spodem"** — potrzebuję zobaczyć na jakim ekranie. Screena lub filmik?
3. **„Mały element na środku Panelu Ofert"** — Panel Ofert zmienił się od tamtego screena. Możesz zrobić nowy jeśli wciąż przeszkadza?

## 🔜 W planie

- **„Start rozmowy" → data/godzina + status + komentarz** — zamiast guzika proste pola. (Zgłosiłaś 14.05)
- **Mobilny kalendarz** — kompaktowy z kropkami i klikiem w dzień.

---

🤍 Jak coś działa źle albo nieoczywiście — zgłoś przez 👁 w prawym dolnym rogu. Każde czytam.
