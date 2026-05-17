
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Podświetla element, na którym wykonywana jest akcja (Visual Debugging)
 */
const highlight = async (element: HTMLElement) => {
    const originalTransition = element.style.transition;
    const originalOutline = element.style.outline;
    const originalTransform = element.style.transform;
    
    element.style.transition = 'all 0.15s ease-in-out';
    element.style.outline = '4px solid rgba(220, 38, 38, 0.6)'; // Red-600 with opacity
    element.style.transform = 'scale(1.02)';
    element.style.zIndex = '9999';
    
    await sleep(300);
    
    element.style.outline = originalOutline;
    element.style.transform = originalTransform;
    element.style.transition = originalTransition;
    element.style.zIndex = '';
};

/**
 * React 16+ nadpisuje setter wartości dla inputów. 
 * Aby zasymulować wpisanie tekstu przez JS, musimy dostać się do natywnego settera prototypu.
 */
export const simulateType = async (selector: string, value: string, delay: number = 50) => {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
        console.warn(`[AutoTester] Nie znaleziono elementu: ${selector}`);
        return false;
    }

    // Scroll & Highlight
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await highlight(element);
    
    // Focus
    element.focus();
    
    // Set Value via Native Prototype (Bypassing React Tracker)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (element.tagName === 'TEXTAREA' && nativeTextAreaSetter) {
        nativeTextAreaSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }

    // Dispatch Events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    await sleep(delay);
    return true;
};

export const simulateClick = async (selector: string | Element, delay: number = 100) => {
    let element: Element | null;
    
    if (typeof selector === 'string') {
        element = document.querySelector(selector);
    } else {
        element = selector;
    }

    if (!element) {
        console.warn(`[AutoTester] Nie znaleziono przycisku: ${selector}`);
        return false;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await highlight(element as HTMLElement);
    
    (element as HTMLElement).click();
    await sleep(delay);
    return true;
};

export const simulateSelect = async (selector: string, value: string, delay: number = 50) => {
    const element = document.querySelector(selector) as HTMLSelectElement;
    if (!element) return false;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await highlight(element);

    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(delay);
    return true;
};

export const simulateCheckbox = async (selector: string, checked: boolean, delay: number = 50) => {
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element) return false;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Checkbox is small, highlight parent label if possible
    const target = element.parentElement || element;
    await highlight(target);

    if (element.checked !== checked) {
        element.click(); // Kliknięcie w checkbox wyzwala natywne zdarzenia Reacta
    }
    await sleep(delay);
    return true;
};
