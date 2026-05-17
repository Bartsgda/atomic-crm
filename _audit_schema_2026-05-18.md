# Schemat remote Supabase — public vs test (2026-05-18)
> Pobrano z projektu `xqznrssrlnxqkdvisnck`. public: 20 tabel, test: 57 tabel.

## Tabele wspólne (sync kandydaci)
| Tabela | public kol | test kol | updated_at | Różnica |
|--------|-----------|----------|------------|--------|
| `activity_log` | 10 | 10 | — | = |
| `checklist_templates` ← sync | 7 | 7 | — | = |
| `companies_summary` | 21 | 21 | — | = |
| `contacts_summary` | 21 | 21 | — | = |
| `init_state` | 1 | 1 | — | = |
| `insurance_activity_log` | 8 | 8 | — | = |
| `insurance_clients` ← sync | 25 | 25 | ✓ | = |
| `insurance_feedback` ← sync | 23 | 19 | — | pub+: page_context, page_key, page_label, priority |
| `insurance_login_log` | 7 | 7 | — | = |
| `insurance_snapshots` | 7 | 7 | — | = |
| `insurance_trash` ← sync | 7 | 6 | — | pub+: v1_original_id |
| `insurers` ← sync | 11 | 11 | — | = |
| `policies` ← sync | 36 | 47 | ✓ | test+: asset_id, asset_kind, previous_policy_id, referred_by_client_id, referred_by_name, renewal_of_policy_id, supersede_reason, superseded_at, superseded_by_policy_id, vehicle_id, version_number |
| `policy_notes` ← sync | 14 | 14 | ✓ | pub+: v1_original_client_id / test+: legacy_id |
| `policy_sub_agent_shares` ← sync | 8 | 8 | — | = |
| `sub_agents` ← sync | 11 | 10 | — | pub+: v1_original_id |
| `tenant_keys` | 11 | 11 | ✓ | = |
| `tenants` | 5 | 5 | — | = |
| `terminations` ← sync | 9 | 9 | — | = |

## Tylko w test (refactor v2, nie syncowane)
- `test.client_attribute_history` — 12 kolumn
- `test.client_businesses` — 16 kolumn
- `test.flag_resolutions` — 12 kolumn
- `test.homes` — 20 kolumn
- `test.insured_persons` — 14 kolumn
- `test.policy_note_links` — 2 kolumn
- `test.policy_terminations` — 20 kolumn
- `test.slot_01` — 6 kolumn
- `test.slot_02` — 6 kolumn
- `test.slot_03` — 6 kolumn
- `test.slot_04` — 6 kolumn
- `test.slot_05` — 6 kolumn
- `test.slot_06` — 6 kolumn
- `test.slot_07` — 6 kolumn
- `test.slot_08` — 6 kolumn
- `test.slot_09` — 6 kolumn
- `test.slot_10` — 6 kolumn
- `test.slot_11` — 6 kolumn
- `test.slot_12` — 6 kolumn
- `test.slot_13` — 6 kolumn
- `test.slot_14` — 6 kolumn
- `test.slot_15` — 6 kolumn
- `test.slot_16` — 6 kolumn
- `test.slot_17` — 6 kolumn
- `test.slot_18` — 6 kolumn
- `test.slot_19` — 6 kolumn
- `test.slot_20` — 6 kolumn
- `test.slot_21` — 6 kolumn
- `test.slot_22` — 6 kolumn
- `test.slot_23` — 6 kolumn
- `test.slot_24` — 6 kolumn
- `test.slot_25` — 6 kolumn
- `test.slot_26` — 6 kolumn
- `test.slot_27` — 6 kolumn
- `test.slot_28` — 6 kolumn
- `test.slot_29` — 6 kolumn
- `test.slot_30` — 6 kolumn
- `test.vehicles` — 21 kolumn

## Tylko w public
- `public.sync_log` — 5 kolumn

## Kolumny per tabela (sync)

### `checklist_templates`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `owner_id` | bigint | YES | ✓ |
| `policy_type` | text | YES | ✓ |
| `items` | jsonb | YES | ✓ |
| `is_default` | boolean | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |

### `insurance_clients`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `owner_id` | bigint | YES | ✓ |
| `contact_id` | bigint | YES | ✓ |
| `first_name` | text | NO | ✓ |
| `last_name` | text | NO | ✓ |
| `phones` | text | YES | ✓ |
| `emails` | text | YES | ✓ |
| `street` | text | YES | ✓ |
| `city` | text | YES | ✓ |
| `zip_code` | text | YES | ✓ |
| `pesel_encrypted` | text | YES | ✓ |
| `birth_date` | text | YES | ✓ |
| `gender` | text | YES | ✓ |
| `type` | text | YES | ✓ |
| `businesses` | jsonb | YES | ✓ |
| `rodo_consent` | boolean | YES | ✓ |
| `rodo_consent_date` | timestamp with time zone | YES | ✓ |
| `source` | text | YES | ✓ |
| `legacy_id` | text | YES | ✓ |
| `is_fake` | boolean | YES | ✓ |
| `tags` | ARRAY | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
| `updated_at` | timestamp with time zone | YES | ✓ |
| `v1_original_id` | text | YES | ✓ |

### `insurance_feedback`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `user_id` | uuid | YES | ✓ |
| `user_email` | text | YES | ✓ |
| `route` | text | YES | ✓ |
| `element_selector` | text | YES | ✓ |
| `element_label` | text | YES | ✓ |
| `message` | text | NO | ✓ |
| `severity` | text | NO | ✓ |
| `screenshot_b64` | text | YES | ✓ |
| `viewport_w` | integer | YES | ✓ |
| `viewport_h` | integer | YES | ✓ |
| `user_agent` | text | YES | ✓ |
| `status` | text | NO | ✓ |
| `created_at` | timestamp with time zone | NO | ✓ |
| `resolved_at` | timestamp with time zone | YES | ✓ |
| `page_key` | text | YES | ✗ pub only |
| `page_label` | text | YES | ✗ pub only |
| `page_context` | jsonb | YES | ✗ pub only |
| `admin_reply` | text | YES | ✓ |
| `admin_reply_at` | timestamp with time zone | YES | ✓ |
| `admin_reply_by` | uuid | YES | ✓ |
| `priority` | smallint | YES | ✗ pub only |

### `insurance_trash`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `type` | text | NO | ✓ |
| `data` | jsonb | NO | ✓ |
| `deleted_at` | timestamp with time zone | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
| `v1_original_id` | text | YES | ✗ pub only |

### `insurers`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | YES | ✓ |
| `name` | text | NO | ✓ |
| `short_name` | text | YES | ✓ |
| `contact_name` | text | YES | ✓ |
| `contact_phone` | text | YES | ✓ |
| `contact_email` | text | YES | ✓ |
| `is_visible` | boolean | YES | ✓ |
| `is_custom` | boolean | YES | ✓ |
| `is_global` | boolean | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |

### `policies`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `client_id` | uuid | NO | ✓ |
| `owner_id` | bigint | YES | ✓ |
| `type` | text | YES | ✓ |
| `stage` | text | YES | ✓ |
| `insurer_id` | uuid | YES | ✓ |
| `insurer_name` | text | YES | ✓ |
| `policy_number` | text | YES | ✓ |
| `premium` | numeric | YES | ✓ |
| `commission` | numeric | YES | ✓ |
| `commission_rate` | numeric | YES | ✓ |
| `payment_status` | text | YES | ✓ |
| `policy_start_date` | date | YES | ✓ |
| `policy_end_date` | date | YES | ✓ |
| `next_contact_date` | date | YES | ✓ |
| `vehicle_brand` | text | YES | ✓ |
| `vehicle_model` | text | YES | ✓ |
| `vehicle_reg` | text | YES | ✓ |
| `auto_details` | jsonb | YES | ✓ |
| `home_details` | jsonb | YES | ✓ |
| `life_details` | jsonb | YES | ✓ |
| `travel_details` | jsonb | YES | ✓ |
| `firma_details` | jsonb | YES | ✓ |
| `original_product_string` | text | YES | ✓ |
| `ai_note` | text | YES | ✓ |
| `checklist` | jsonb | YES | ✓ |
| `calculations` | jsonb | YES | ✓ |
| `termination_id` | uuid | YES | ✓ |
| `source` | text | YES | ✓ |
| `legacy_id` | text | YES | ✓ |
| `is_fake` | boolean | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
| `updated_at` | timestamp with time zone | YES | ✓ |
| `v1_original_id` | text | YES | ✓ |
| `v1_original_client_id` | text | YES | ✓ |
| `vehicle_id` | uuid | — | test only |
| `renewal_of_policy_id` | uuid | — | test only |
| `referred_by_name` | text | — | test only |
| `referred_by_client_id` | uuid | — | test only |
| `asset_kind` | text | — | test only |
| `asset_id` | uuid | — | test only |
| `previous_policy_id` | uuid | — | test only |
| `version_number` | integer | — | test only |
| `superseded_by_policy_id` | uuid | — | test only |
| `superseded_at` | timestamp with time zone | — | test only |
| `supersede_reason` | text | — | test only |

### `policy_notes`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `client_id` | uuid | YES | ✓ |
| `linked_policy_ids` | ARRAY | YES | ✓ |
| `content` | text | NO | ✓ |
| `tag` | text | YES | ✓ |
| `reminder_date` | timestamp with time zone | YES | ✓ |
| `reminder_status` | text | YES | ✓ |
| `history` | jsonb | YES | ✓ |
| `created_by` | bigint | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
| `updated_at` | timestamp with time zone | YES | ✓ |
| `v1_original_id` | text | YES | ✓ |
| `v1_original_client_id` | text | YES | ✗ pub only |
| `legacy_id` | text | — | test only |

### `policy_sub_agent_shares`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `policy_id` | uuid | NO | ✓ |
| `sub_agent_id` | uuid | NO | ✓ |
| `rate` | numeric | YES | ✓ |
| `amount` | numeric | YES | ✓ |
| `note` | text | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |

### `sub_agents`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `owner_id` | bigint | YES | ✓ |
| `name` | text | NO | ✓ |
| `phone` | text | YES | ✓ |
| `email` | text | YES | ✓ |
| `default_rates` | jsonb | YES | ✓ |
| `group_prefix` | text | YES | ✓ |
| `notes` | text | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
| `v1_original_id` | text | YES | ✗ pub only |

### `terminations`
| Kolumna | typ | nullable | w test |
|---------|-----|----------|--------|
| `id` | uuid | NO | ✓ |
| `tenant_id` | uuid | NO | ✓ |
| `policy_id` | uuid | NO | ✓ |
| `sent_date` | date | YES | ✓ |
| `document_date` | date | YES | ✓ |
| `pdf_storage_path` | text | YES | ✓ |
| `article` | text | YES | ✓ |
| `created_by` | bigint | YES | ✓ |
| `created_at` | timestamp with time zone | YES | ✓ |
