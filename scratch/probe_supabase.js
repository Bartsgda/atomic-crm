import { createClient } from '@supabase/supabase-js';

async function checkProject(name, url, key) {
    console.log(`\n--- Checking Project: ${name} (${url}) ---`);
    if (!url || !key || url.includes('TWOJA_BAZA')) {
        console.log('Skipping: Invalid URL or Key');
        return;
    }
    const supabase = createClient(url, key);
    
    const tables = ['insurance_snapshots', 'insurance_feedback', 'sales', 'deals', 'contacts'];
    
    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`Table [${table}]: ERROR (${error.message})`);
            } else {
                console.log(`Table [${table}]: OK (Rows: ${count})`);
            }
        } catch (e) {
            console.log(`Table [${table}]: EXCEPTION (${e.message})`);
        }
    }
}

// Klucze pobierane z rrv vault. Uruchom z PowerShell:
//   $env:CRM_ALINA_SB_SECRET = (rrv get CRM_ALINA_SB_SECRET)
//   $env:SUPABASE_SECRET = (rrv get SUPABASE_SECRET)   # brain project (fdij...)
//   node scratch/probe_supabase.js
async function run() {
    await checkProject(
        'ALINA_PROD',
        'https://xqznrssrlnxqkdvisnck.supabase.co',
        process.env.CRM_ALINA_SB_SECRET
    );

    // VAULT_TEST = brain project (fdij...). Uzywa SUPABASE_SECRET z vault.
    await checkProject(
        'BRAIN',
        'https://fdijzgzcbibwvguygaof.supabase.co',
        process.env.SUPABASE_SECRET
    );
}

run();

