import { useEffect, useRef, useCallback } from 'react';

/**
 * useAutoWipe hook
 * Monitors user inactivity and triggers a callback after a specified interval.
 * Default: 8 hours for RODO compliance on shared environments.
 */

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const WARNING_BEFORE_MS = 10 * 60 * 1000; // 10 minutes warning

export function useAutoWipe(
    onWipe: () => void, 
    onWarning?: (minutesLeft: number) => void,
    timeoutMs: number = EIGHT_HOURS_MS
) {
    const timerRef = useRef<any>(null);
    const warningTimerRef = useRef<any>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        
        if (timerRef.current) clearTimeout(timerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

        // Set the main wipe timer
        timerRef.current = setTimeout(() => {
            console.warn("[Security] Inactivity limit reached. Triggering auto-wipe.");
            onWipe();
        }, timeoutMs);

        // Set the warning timer
        if (onWarning) {
            warningTimerRef.current = setTimeout(() => {
                const minutesLeft = Math.round(WARNING_BEFORE_MS / 60000);
                onWarning(minutesLeft);
            }, timeoutMs - WARNING_BEFORE_MS);
        }
    }, [onWipe, onWarning, timeoutMs]);

    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        
        const handleActivity = () => {
            // Throttle timer reset to once every 30 seconds to save battery/perf
            if (Date.now() - lastActivityRef.current > 30000) {
                resetTimer();
            }
        };

        events.forEach(event => window.addEventListener(event, handleActivity));
        
        // Start the initial timer
        resetTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            if (timerRef.current) clearTimeout(timerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        };
    }, [resetTimer]);

    // Manual reset function exposed for specific actions
    return { manuallyReset: resetTimer };
}
