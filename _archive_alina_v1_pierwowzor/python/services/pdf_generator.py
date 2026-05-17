
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
import os
from datetime import datetime

# Rejestracja czcionki (można użyć systemowej lub dołączonej, tutaj fallback na standard)
# W produkcji warto dodać plik .ttf (np. Arial) do folderu fonts/
# pdfmetrics.registerFont(TTFont('Arial', 'arial.ttf'))

class PdfGenerator:
    @staticmethod
    def generate_termination(client_data, policy_data, insurer_data, output_path):
        """
        Generuje PDF z wypowiedzeniem OC.
        client_data: { 'firstName', 'lastName', 'address', 'city', 'pesel' }
        policy_data: { 'policyNumber', 'vehicleBrand', 'vehicleReg' }
        insurer_data: { 'name', 'address', 'city', 'zip' }
        """
        c = canvas.Canvas(output_path, pagesize=A4)
        width, height = A4
        
        # Helpery
        left_margin = 25 * mm
        top_margin = height - 25 * mm
        line_height = 5 * mm
        
        c.setFont("Helvetica", 11) # Fallback font

        # 1. Miejscowość, Data
        c.drawRightString(width - 25*mm, top_margin, f"{client_data.get('city', '.......')}, dnia {datetime.now().strftime('%d.%m.%Y')} r.")
        
        cursor = top_margin - 20*mm

        # 2. Nadawca (Lewa strona)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(left_margin, cursor, "NADAWCA:")
        cursor -= line_height
        c.setFont("Helvetica", 11)
        c.drawString(left_margin, cursor, f"{client_data.get('firstName')} {client_data.get('lastName')}")
        cursor -= line_height
        c.drawString(left_margin, cursor, f"{client_data.get('address')}")
        cursor -= line_height
        c.drawString(left_margin, cursor, f"PESEL: {client_data.get('pesel')}")

        # 3. Adresat (Prawa strona)
        cursor = top_margin - 20*mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(width/2 + 10*mm, cursor, "ADRESAT:")
        cursor -= line_height
        c.setFont("Helvetica", 11)
        c.drawString(width/2 + 10*mm, cursor, insurer_data.get('name', 'TU...'))
        cursor -= line_height
        c.drawString(width/2 + 10*mm, cursor, insurer_data.get('address', '...'))
        cursor -= line_height
        c.drawString(width/2 + 10*mm, cursor, f"{insurer_data.get('zip')} {insurer_data.get('city')}")

        # 4. Tytuł
        cursor -= 30*mm
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width/2, cursor, "WYPOWIEDZENIE UMOWY UBEZPIECZENIA OC")
        
        cursor -= 10*mm
        c.setFont("Helvetica", 10)
        c.drawString(left_margin, cursor, "Na podstawie art. 28 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych,")
        cursor -= line_height
        c.drawString(left_margin, cursor, "Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli")
        cursor -= line_height
        c.drawString(left_margin, cursor, "Komunikacyjnych, wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów")
        cursor -= line_height
        c.drawString(left_margin, cursor, "mechanicznych na koniec okresu ubezpieczenia.")

        # 5. Przedmiot
        cursor -= 20*mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(left_margin, cursor, f"Numer Polisy: {policy_data.get('policyNumber')}")
        cursor -= line_height
        c.drawString(left_margin, cursor, f"Pojazd: {policy_data.get('vehicleBrand')}")
        cursor -= line_height
        c.drawString(left_margin, cursor, f"Nr Rejestracyjny: {policy_data.get('vehicleReg')}")

        # 6. Podpis
        cursor -= 40*mm
        c.line(width - 80*mm, cursor, width - 25*mm, cursor)
        cursor -= 5*mm
        c.setFont("Helvetica", 9)
        c.drawRightString(width - 25*mm, cursor, "(Podpis Ubezpieczającego)")

        # 7. Stopka
        c.setFont("Helvetica", 8)
        c.drawCentredString(width/2, 15*mm, "Dokument wygenerowany w systemie Drogowiec CRM Pro")

        c.save()
        return output_path
