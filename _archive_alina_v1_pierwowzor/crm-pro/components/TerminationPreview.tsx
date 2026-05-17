
import React from 'react';
import { Client, Policy, TerminationBasis } from '../types';
import { LEGAL_TEXTS } from '../constants';
import { INSURERS } from '../towarzystwa';
import { format } from 'date-fns';
// Fix: Use specific subpath for locale 'pl' to avoid barrel export issues
import { pl } from 'date-fns/locale/pl';

interface Props {
  client: Client;
  policy: Policy;
}

export const TerminationPreview: React.FC<Props> = ({ client, policy }) => {
  const legalInfo = LEGAL_TEXTS[policy.terminationBasis] || LEGAL_TEXTS[TerminationBasis.OTHER];

  // Find detailed insurer info
  const insurerDetails = INSURERS.find(i => i.name === policy.insurerName);
  const displayInsurerName = insurerDetails ? insurerDetails.currentLegalEntity : policy.insurerName;

  const today = format(new Date(), 'dd MMMM yyyy', { locale: pl });

  // Determine if we should show the double insurance section
  const isDoubleInsurance = policy.terminationBasis === TerminationBasis.ART_28A;
  
  // Custom text for OWU/AC if provided, else default clause
  const mainClause = policy.terminationBasis === TerminationBasis.OWU && policy.owuText 
    ? policy.owuText 
    : legalInfo.clause;

  return (
    <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[20mm] text-black font-serif text-[12pt] leading-relaxed relative print:w-full print:max-w-none">
      {/* Date Place */}
      <div className="text-right mb-12">
        {client.city}, dnia {today} r.
      </div>

      {/* Header Grid */}
      <div className="grid grid-cols-2 gap-8 mb-16">
        {/* Sender */}
        <div>
          <h3 className="font-bold uppercase text-[10pt] mb-2 text-gray-500 print:text-black">Nadawca:</h3>
          <p className="font-bold text-lg">{client.firstName} {client.lastName}</p>
          <p>{client.street}</p>
          <p>{client.zipCode} {client.city}</p>
          <p className="mt-1">PESEL: {client.pesel}</p>
          {/* Fix: Access phones array instead of non-existent phone property */}
          {client.phones?.[0] && <p>Tel: {client.phones[0]}</p>}
        </div>

        {/* Receiver */}
        <div>
          <h3 className="font-bold uppercase text-[10pt] mb-2 text-gray-500 print:text-black">Adresat (Ubezpieczyciel):</h3>
          <p className="font-bold text-lg leading-tight mb-1">{displayInsurerName}</p>
          {insurerDetails ? (
              <>
                  <p>{insurerDetails.address}</p>
                  <p>{insurerDetails.zipCode} {insurerDetails.city}</p>
                  {insurerDetails.isBrandOnly && (
                      <p className="mt-2 text-xs italic text-gray-500 print:hidden">
                          (Pismo kierowane do podmiotu prawnego właściciela marki: {insurerDetails.name})
                      </p>
                  )}
              </>
          ) : (
              <p className="text-gray-400 print:hidden italic">[Adres ubezpieczyciela - uzupełnij ręcznie jeśli wymagane]</p>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-2xl font-bold uppercase tracking-wide border-b-2 border-black inline-block pb-1">
          Wypowiedzenie Umowy {policy.type}
        </h1>
        <p className="text-sm mt-2 italic text-gray-600 print:text-black">{legalInfo.title}</p>
      </div>

      {/* Body Content */}
      <div className="space-y-6 text-justify">
        <p>
          {mainClause}
        </p>

        <div className="my-8 border-l-4 border-gray-200 print:border-l-2 print:border-black pl-4 py-2">
          <p><strong>Numer Polisy:</strong> {policy.policyNumber}</p>
          <p><strong>Marka/Przedmiot:</strong> {policy.vehicleBrand}</p>
          <p><strong>Nr rejestracyjny/Adres:</strong> {policy.vehicleReg}</p>
          {policy.vehicleVin && <p><strong>VIN:</strong> {policy.vehicleVin}</p>}
        </div>

        {/* Art 28a Logic */}
        {isDoubleInsurance && (
          <div className="mt-6">
            <p>
              Jednocześnie oświadczam, że pojazd posiada ubezpieczenie w innym Towarzystwie Ubezpieczeń:
            </p>
            <div className="mt-2 pl-4">
               <p><strong>Nazwa zakładu:</strong> {policy.otherInsurerName || '...........................................'}</p>
               <p><strong>Numer polisy:</strong> {policy.otherPolicyNumber || '...........................................'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Signatures Footer */}
      <div className="mt-24 grid grid-cols-2 gap-8">
        <div className="text-center">
            {/* Empty for layout balance */}
        </div>
        <div className="text-center">
          <div className="border-b border-black mb-2 h-16"></div>
          <p className="font-bold">{client.firstName} {client.lastName}</p>
          <p className="text-xs">(Podpis ubezpieczającego)</p>
        </div>
      </div>

      {/* Legal Footer Note (Small print) */}
      <div className="absolute bottom-[15mm] left-[20mm] right-[20mm] text-[8pt] text-gray-500 text-center border-t pt-2 print:text-black print:bottom-0 print:left-0 print:right-0">
        <p>Dokument wygenerowano w systemie Insurance Master.</p>
        {policy.type === 'OC' && (
          <p>Podstawa prawna: Ustawa z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych.</p>
        )}
        {policy.type === 'AC' && (
           <p>Wypowiedzenie umowy dobrowolnej na podstawie Ogólnych Warunków Ubezpieczenia (OWU).</p>
        )}
      </div>
    </div>
  );
};
