import sys
import os
sys.path.append(os.getcwd())
from scripts.alina_responder import AlinaResponder
import json

r = AlinaResponder(dry_run=True)
res = r.supabase.schema("public").table("insurance_feedback").select("*").order("created_at", desc=True).limit(5).execute()
print(json.dumps(res.data, indent=2))
