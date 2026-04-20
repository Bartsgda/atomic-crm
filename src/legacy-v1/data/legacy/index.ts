
import { TRAVEL_MAP } from './travel';
import { PROPERTY_MAP } from './property';
import { LIFE_MAP } from './life';
import { AUTO_MAP } from './auto';
import { TRAILER_MAP } from './trailer';
import { QUAD_MAP } from './quad';
import { BUSINESS_MAP } from './business';
import { CleanData } from './types';

// Scalamy wszystkie mapy w jedną dla DataMappera
export const LEGACY_RECOGNITION_MAP: Record<string, CleanData> = {
    ...TRAVEL_MAP,
    ...PROPERTY_MAP,
    ...LIFE_MAP,
    ...AUTO_MAP,
    ...TRAILER_MAP,
    ...QUAD_MAP,
    ...BUSINESS_MAP
};
