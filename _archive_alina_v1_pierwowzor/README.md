# Insurance Master CRM Pro (v4.7)

> CRM dla agenta ubezpieczeniowego Aliny — local-first React + Vite + Gemini AI.  
> Kod aplikacji: `crm-pro/`. Root (`/`) = tylko Vite bridge + config.

## Dokumentacja

- [`crm-pro/README.md`](crm-pro/README.md) — centrum dokumentacji
- [`MASTER_MANUAL.md`](MASTER_MANUAL.md) — zasady i procesy biznesowe
- [`crm-pro/ROADMAP.md`](crm-pro/ROADMAP.md) — status i backlog

## Szybki start

```bash
npm install
# Dodaj GEMINI_API_KEY do .env.local
npm run dev
```

## Deployment na Hostido

Deploy CRM-Alina na `https://redroad.pl/alina/` odbywa się przez CRM-Atomic.  
Skrypt: `C:\BartsGda4\CRM-Atomic\scripts\ftp_deploy.py` (wymaga vault rrv).  
Szczegóły: [`C:\BartsGda4\CRM-Atomic\scripts\FTP_TOOLS.md`](../CRM-Atomic/scripts/FTP_TOOLS.md).
