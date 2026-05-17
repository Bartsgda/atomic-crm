
/**
 * Globalne narzędzie do obsługi walut.
 * Wymusza 2 miejsca po przecinku w całym systemie.
 */

export const roundCurrency = (value: number | string | undefined): number => {
    if (!value) return 0.00;
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    if (isNaN(num)) return 0.00;
    // Technika epsilonowa dla precyzji zmiennoprzecinkowej
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const formatCurrency = (value: number | string | undefined): string => {
    const rounded = roundCurrency(value);
    return rounded.toFixed(2);
};

export const calculateRate = (premium: number, commission: number): number => {
    if (!premium || premium === 0) return 0;
    const rate = (commission / premium) * 100;
    // Rate zaokrąglamy do 1 miejsca po przecinku (np. 12.5%)
    return Math.round((rate + Number.EPSILON) * 10) / 10;
};
