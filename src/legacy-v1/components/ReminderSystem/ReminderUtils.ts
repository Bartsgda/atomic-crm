
import { format, addDays, isValid, parseISO } from 'date-fns';

// FORMAT: [YYYY-MM-DD HH:mm]_STATUS_TRESC
const REMINDER_REGEX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]_(PRZYPOMNIENIE|UKOŃCZONE|ANULOWANE)_(.*)/s;

export type ReminderStatus = 'PRZYPOMNIENIE' | 'UKOŃCZONE' | 'ANULOWANE';

export const ReminderUtils = {
    /**
     * Tworzy sformatowaną treść notatki z przypomnieniem
     */
    createContent: (text: string, date: Date): string => {
        const timeStr = format(date, 'yyyy-MM-dd HH:mm');
        const cleanText = text.trim() || "Przypomnienie";
        return `[${timeStr}]_PRZYPOMNIENIE_${cleanText}`;
    },

    /**
     * Parsuje treść notatki, aby sprawdzić czy jest przypomnieniem
     */
    parse: (content: string) => {
        const match = content.match(REMINDER_REGEX);
        if (!match) return null;

        return {
            dateStr: match[1],
            status: match[2] as ReminderStatus,
            text: match[3].trim(),
            fullMatch: match[0]
        };
    },

    /**
     * Zmienia status w treści notatki (np. z PRZYPOMNIENIE na UKOŃCZONE)
     */
    toggleStatus: (content: string): string => {
        const parsed = ReminderUtils.parse(content);
        if (!parsed) return content;

        const newStatus = parsed.status === 'PRZYPOMNIENIE' ? 'UKOŃCZONE' : 'PRZYPOMNIENIE';
        return `[${parsed.dateStr}]_${newStatus}_${parsed.text}`;
    },

    /**
     * Oblicza datę na podstawie skrótu (1d, 2d...)
     */
    calcDate: (days: number): Date => {
        const d = addDays(new Date(), days);
        // Domyślnie ustawiamy na 10:00 rano
        d.setHours(10, 0, 0, 0);
        return d;
    }
};
