"""
crm_alina_reply.py — odpowiedz Claude'a na insurance_feedback przez Supabase.

ZASTAPILO `alina_responder.py` (2026-05-06) — bubel z AI generation.

Workflow Bartka:
  1. Claude w sesji `rr-claude --crm` (lub `--alina`) wola `python crm_alina_reply.py --list-open`.
  2. Widzi otwarte zgloszenia (id, user_email, message, severity, created_at).
  3. Pisze odpowiedz po polsku (kontekst CRM-Alina + zglaszany problem).
  4. Wola: `python crm_alina_reply.py --id <feedback_id> --reply "tekst odpowiedzi"`.
  5. Skrypt robi UPDATE insurance_feedback SET admin_reply, admin_replied_at, admin_replied_by.

Bez AI generation, bez fikcyjnych odpowiedzi. Jest tylko transport miedzy Claude a Supabase.

Sekrety z rrv vault:
  - CRM_ALINA_SUPABASE_URL
  - CRM_ALINA_SB_SECRET (service_role key)

Wymagania: pip install supabase
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone


def get_vault_secret(name: str) -> str:
    """Pobierz sekret z rrv vault (PowerShell call)."""
    cmd = ["powershell", "-NoProfile", "-Command", f"rrv get {name}"]
    try:
        val = subprocess.check_output(cmd, timeout=10).decode("utf-8").strip()
        return val.replace("﻿", "").strip()
    except subprocess.CalledProcessError as e:
        sys.exit(f"[BLAD] rrv get {name} zwrocilo {e.returncode}: {e.output}")
    except subprocess.TimeoutExpired:
        sys.exit(f"[BLAD] rrv get {name} timeout (vault zablokowany?)")


def _supabase_client():
    """Klient Supabase z rrv vault. Lazy import bo supabase moze nie byc zainstalowany w kazdym env."""
    try:
        from supabase import create_client
    except ImportError:
        sys.exit("[BLAD] pip install supabase  (brak modulu)")

    url = get_vault_secret("CRM_ALINA_SUPABASE_URL")
    key = get_vault_secret("CRM_ALINA_SB_SECRET")
    return create_client(url, key)


def cmd_list_open(args: argparse.Namespace) -> int:
    """Lista otwartych zgloszen (admin_reply IS NULL)."""
    supabase = _supabase_client()
    res = (supabase.table("insurance_feedback")
           .select("id, user_email, severity, message, created_at, admin_reply")
           .is_("admin_reply", "null")
           .order("created_at", desc=True)
           .limit(args.limit)
           .execute())

    items = res.data or []
    if not items:
        print("[OK] Brak otwartych zgloszen.")
        return 0

    print(f"[INFO] {len(items)} otwartych zgloszen (top {args.limit}):\n")
    for item in items:
        date = (item.get("created_at") or "")[:16]
        sev = item.get("severity", "info")
        user = item.get("user_email", "???")
        msg = (item.get("message") or "").strip()
        print(f"  [{item['id']}] {date}  {sev:<8}  {user}")
        # Wciecie tresci dla czytelnosci
        for line in msg.splitlines() or [""]:
            print(f"        {line}")
        print()
    return 0


def cmd_list_all(args: argparse.Namespace) -> int:
    """Lista wszystkich zgloszen (otwarte + zamkniete) jako JSON dla AI parsowania."""
    supabase = _supabase_client()
    res = (supabase.table("insurance_feedback")
           .select("id, user_email, severity, message, admin_reply, admin_replied_at, admin_replied_by, created_at")
           .order("created_at", desc=True)
           .limit(args.limit)
           .execute())
    print(json.dumps(res.data or [], ensure_ascii=False, indent=2, default=str))
    return 0


def cmd_reply(args: argparse.Namespace) -> int:
    """UPDATE insurance_feedback z admin_reply."""
    if not args.reply.strip():
        sys.exit("[BLAD] --reply puste")

    supabase = _supabase_client()

    # Sprawdz czy zgloszenie istnieje + czy juz nie ma reply (idempotencja)
    res = (supabase.table("insurance_feedback")
           .select("id, user_email, message, admin_reply")
           .eq("id", args.id)
           .execute())
    if not res.data:
        sys.exit(f"[BLAD] insurance_feedback id={args.id} nie istnieje")

    existing = res.data[0]
    if existing.get("admin_reply") and not args.force:
        print(f"[WARN] Zgloszenie {args.id} ma juz admin_reply:")
        print(f"       {existing['admin_reply'][:200]}...")
        print(f"       Uzyj --force jezeli chcesz nadpisac.")
        return 1

    # UPDATE
    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {
        "admin_reply": args.reply,
        "admin_replied_at": now_iso,
    }
    if args.replied_by:
        update_data["admin_replied_by"] = args.replied_by

    upd = (supabase.table("insurance_feedback")
           .update(update_data)
           .eq("id", args.id)
           .execute())

    if upd.data:
        print(f"[OK] insurance_feedback id={args.id} zaktualizowane:")
        print(f"     user: {existing.get('user_email')}")
        print(f"     reply: {args.reply[:200]}{'...' if len(args.reply) > 200 else ''}")
        return 0
    else:
        sys.exit(f"[BLAD] UPDATE id={args.id} nie zwrocil danych")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="crm_alina_reply — UPDATE insurance_feedback (bez AI generation, transport Claude→Supabase)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Workflow:\n"
            "  1) python crm_alina_reply.py --list-open       # zobacz otwarte zgloszenia\n"
            "  2) (Claude pisze odpowiedz w sesji)\n"
            "  3) python crm_alina_reply.py --id 123 --reply \"...\"   # UPDATE\n"
        )
    )
    sub = parser.add_subparsers(dest="cmd")

    p_list = sub.add_parser("list-open", aliases=["list"], help="Lista otwartych zgloszen (admin_reply NULL)")
    p_list.add_argument("--limit", type=int, default=20, help="Max wynikow (domyslnie 20)")
    p_list.set_defaults(func=cmd_list_open)

    p_all = sub.add_parser("list-all", help="Wszystkie zgloszenia jako JSON (AI parsowanie)")
    p_all.add_argument("--limit", type=int, default=50)
    p_all.set_defaults(func=cmd_list_all)

    p_reply = sub.add_parser("reply", help="UPDATE insurance_feedback.admin_reply")
    p_reply.add_argument("--id", type=int, required=True, help="ID zgloszenia (FK insurance_feedback.id)")
    p_reply.add_argument("--reply", type=str, required=True, help="Tekst odpowiedzi (PL)")
    p_reply.add_argument("--replied-by", type=str, default="claude_code",
                         help="Kto odpowiedzial (default: claude_code)")
    p_reply.add_argument("--force", action="store_true",
                         help="Nadpisz istniejacy admin_reply (idempotencja off)")
    p_reply.set_defaults(func=cmd_reply)

    # Backward-compat shortcuts
    parser.add_argument("--list-open", action="store_const", dest="shortcut", const="list-open")
    parser.add_argument("--list-all", action="store_const", dest="shortcut", const="list-all")
    parser.add_argument("--id", type=int, help="(shortcut) UPDATE: id zgloszenia")
    parser.add_argument("--reply", type=str, help="(shortcut) UPDATE: tekst odpowiedzi")
    parser.add_argument("--replied-by", type=str, default="claude_code")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()

    if args.cmd:
        return args.func(args)

    # Shortcuts
    if args.shortcut == "list-open":
        return cmd_list_open(args)
    if args.shortcut == "list-all":
        return cmd_list_all(args)
    if args.id and args.reply:
        return cmd_reply(args)

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
