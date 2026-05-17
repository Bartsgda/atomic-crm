
import React from 'react';
import { createRoot } from 'react-dom/client';
// IMPORTUJEMY APLIKACJĘ Z KATALOGU CRM-PRO
import App from './crm-pro/App';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error("Missing #root element");
}

const root = createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
