
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// --- DIAGNOSTIC BOOTLOADER ---
console.log("🚀 [BOOT] System startuje...");

const rootElement = document.getElementById('root');

if (!rootElement) {
    document.body.innerHTML = '<div style="color:red; font-size: 24px; font-weight: bold; padding: 20px;">BŁĄD KRYTYCZNY: Nie znaleziono elementu #root w index.html</div>';
    throw new Error("Missing #root element");
}

try {
    const root = createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
    console.log("✅ [BOOT] React zamontowany pomyślnie.");
} catch (error: any) {
    console.error("🔥 [BOOT] CRITICAL RENDER ERROR:", error);
    // Fallback UI w przypadku błędu samego Reacta
    rootElement.innerHTML = `
        <div style="font-family: sans-serif; padding: 40px; background: #fff0f0; border: 2px solid red; margin: 20px; border-radius: 10px;">
            <h1 style="color: #dc2626;">AWARIA SYSTEMU (CRITICAL CRASH)</h1>
            <p>Aplikacja napotkała błąd podczas uruchamiania.</p>
            <div style="background: #1f2937; color: #f87171; padding: 20px; border-radius: 8px; font-family: monospace; margin-top: 20px;">
                ${error?.message || 'Nieznany błąd'}
                <br/><br/>
                ${error?.stack || ''}
            </div>
        </div>
    `;
}

// Globalny handler błędów dla pewności
window.onerror = function(message, source, lineno, colno, error) {
    console.error("🌍 [GLOBAL ERROR]", { message, source, lineno, error });
    return false;
};
