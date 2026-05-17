import React from 'react';
import { PolicyFormModal } from './PolicyFormModal';
import { Client, Policy, PolicyType } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialPolicy?: Policy;
    initialClient?: Client;
    initialType?: PolicyType;
    onSave: (client: Client, policy: Policy) => void;
    // displayMode?: 'modal' | 'floating'; // Removed
    aiDiffs?: any;
    clients?: Client[]; 
    onAddNewClient?: () => void;
}

export const PolicyWindowHost: React.FC<Props> = (props) => {
    return <PolicyFormModal {...props} />;
};