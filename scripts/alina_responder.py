import os
import sys
import argparse
from datetime import datetime
from supabase import create_client, Client
import google.generativeai as genai

# ─── Konfiguracja ─────────────────────────────────────────────────────────────

def load_env(path=".env.development.local"):
    """Wczytuje zmienne z pliku .env (zwykle wygenerowanego przez switch_env.ps1)."""
    env = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        env[parts[0].strip()] = parts[1].strip()
    return env

def get_vault_secret(name):
    """Pobiera sekret bezpośrednio z rrv jeśli nie ma go w env."""
    try:
        import subprocess
        # Używamy powershell dla lepszej obsługi rrv w tym środowisku
        cmd = f'powershell -Command "rrv get {name}"'
        val = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        # Usuń BOM i inne śmieci
        val = val.replace('\ufeff', '').strip()
        return val
    except Exception as e:
        print(f"[DEBUG] rrv get {name} failed: {e}")
        return None

# ─── AI Responder ──────────────────────────────────────────────────────────────

class AlinaResponder:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        env = load_env()
        
        url = env.get("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        key = env.get("VITE_SB_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or get_vault_secret("CRM_ALINA_SB_SECRET")
        
        if not url or not key:
            print("[ERR] Brak konfiguracji Supabase (URL lub Secret Key).")
            sys.exit(1)
            
        self.supabase: Client = create_client(url, key)
        
        # Konfiguracja Gemini - Szukanie działającego klucza
        vault_keys = [
            "GEMINI_API_KEY_1", 
            "GOOGLE_API_KEY", 
            "LEAK_GEMINI_PERSONAL",
            "LEAK_GEMINI_REDROAD",
            "GEMINI_API_KEY_2",
            "AISTUDIO2",
            "AISTUDIO3",
            "AISTUDIO4",
            "AISTUDIO5",
            "AISTUDI_API_1"
        ]
        
        gemini_key = env.get("GEMINI_API_KEY")
        self.use_ai = False
        
        # Próbujemy najpierw z env, potem z vault
        all_potential_keys = ([gemini_key] if gemini_key else []) + [get_vault_secret(k) for k in vault_keys]
        
        for k in all_potential_keys:
            if not k or len(k) < 10:
                continue
            try:
                genai.configure(api_key=k)
                self.model = genai.GenerativeModel('gemini-1.5-flash')
                # Szybki test (minimalny koszt/czas)
                self.model.generate_content("Hi", generation_config={"max_output_tokens": 1})
                self.use_ai = True
                print(f"[*] Skonfigurowano Gemini używając działającego klucza.")
                break
            except Exception as e:
                # print(f"[DEBUG] Klucz nie zadziałał: {e}")
                continue
                
        if not self.use_ai:
            print("[WARN] Brak działającego GEMINI_API_KEY. Używam szablonów tekstowych.")
            self.use_ai = False

    def generate_reply(self, message, severity):
        if not self.use_ai:
            return self.get_template_reply(severity)
            
        prompt = f"""
Jesteś profesjonalnym asystentem AI o imieniu Alina, pracującym w biurze projektowym RedRoad.
Użytkownik wysłał zgłoszenie feedback w aplikacji CRM.

Treść zgłoszenia: "{message}"
Priorytet/Typ: {severity}

Napisz krótką, uprzejmą odpowiedź po polsku (max 2-3 zdania).
Jeśli to błąd (bug/blocker) — zapewnij o przekazaniu do deweloperów.
Jeśli to pomysł (idea) — podziękuj za sugestię i powiedz, że ją rozważymy.
Jeśli to info — po prostu podziękuj.

Twoja odpowiedź:
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[ERR] Błąd Gemini: {e}")
            return self.get_template_reply(severity)

    def get_template_reply(self, severity):
        templates = {
            'blocker': "Dziękujemy za zgłoszenie krytycznego problemu. Zespół techniczny został powiadomiony i zajmie się tym natychmiast.",
            'bug': "Dziękujemy za zgłoszenie błędu. Przekazaliśmy sprawę do deweloperów.",
            'idea': "Dziękujemy za świetny pomysł! Został on dodany do naszej listy sugestii rozwojowych.",
            'info': "Dziękujemy za przesłaną informację."
        }
        return templates.get(severity, "Dziękujemy za feedback.")

    def run(self):
        print(f"[*] Rozpoczynam sprawdzanie feedbacku... ({'DRY RUN' if self.dry_run else 'LIVE'})")
        
        # Pobierz zgłoszenia bez odpowiedzi
        # Używamy schemy public zgodnie z decyzją projektową
        query = self.supabase.schema("public").table("insurance_feedback").select("*").is_("admin_reply", "null").eq("status", "open")
        res = query.execute()
        
        items = res.data or []
        if not items:
            print("[OK] Brak nowych zgłoszeń do obsłużenia.")
            return

        print(f"[*] Znaleziono {len(items)} nowych zgłoszeń.")
        
        for item in items:
            fb_id = item['id']
            msg = item['message']
            sev = item['severity']
            user_email = item.get('user_email', 'User')
            
            print(f"  - [{sev}] {user_email}: {msg[:50]}...")
            
            reply = self.generate_reply(msg, sev)
            print(f"    AI: {reply}")
            
            if not self.dry_run:
                try:
                    self.supabase.schema("public").table("insurance_feedback").update({
                        "admin_reply": reply,
                        "admin_reply_at": datetime.utcnow().isoformat(),
                        "status": "seen" # Oznaczamy jako "widziane" po odpowiedzi AI
                    }).eq("id", fb_id).execute()
                    print(f"    [OK] Zapisano odpowiedź.")
                except Exception as e:
                    print(f"    [ERR] Nie udało się zapisać: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alina AI Feedback Responder")
    parser.add_argument("--dry-run", action="store_true", help="Pokaż odpowiedzi bez zapisywania w bazie")
    args = parser.parse_args()
    
    responder = AlinaResponder(dry_run=args.dry_run)
    responder.run()
