
export type FieldType = 
    | 'HEADER' 
    | 'INPUT_TEXT' 
    | 'INPUT_NUMBER' 
    | 'SELECT' 
    | 'DATE' 
    | 'TOGGLE_GROUP' 
    | 'CHECKBOX'
    | 'SECTION_BREAK';

export type FieldWidth = 'w-full' | 'w-1/2' | 'w-1/3' | 'w-1/4' | 'w-2/3';

export interface FormElementDef {
    id: string;
    type: FieldType;
    label: string;
    width: FieldWidth;
    
    // Opcje dla selectów/toggle
    options?: string[]; 
    
    // Mapowanie do bazy danych (np. homeDetails.area)
    bindingKey?: string; 
    
    // UI Config
    placeholder?: string;
    iconName?: string; // np. 'Home', 'Zap'
    isRequired?: boolean;
}

export interface FormLayout {
    elements: FormElementDef[];
    version: string;
}
