import React from 'react';

/**
 * Piaskownica designu Sahara (Inspiracja ze Stitcha)
 * Cechy: Szeroki Sidebar (w-64), Kafelkowy Dashboard, Ciepłe kolory (Sahara palette)
 */
const DesignSahara: React.FC = () => {
  // Symulacja danych kafli
  const stats = [
    { label: 'Aktywne Projekty', value: '12', icon: 'account_tree', color: 'bg-primary-container' },
    { label: 'Oczekujące Oferty', value: '4', icon: 'description', color: 'bg-tertiary-container' },
    { label: 'Wysłane Pisma', value: '124', icon: 'mail', color: 'bg-secondary-container' },
    { label: 'System Health', value: 'OK', icon: 'check_circle', color: 'bg-tertiary-fixed-dim' },
  ];

  return (
    <div className="flex h-screen bg-[#fff8f6] font-['Manrope'] text-[#241914] overflow-hidden">
      {/* --- Sidebar (Szeroki) --- */}
      <nav className="w-64 bg-[#fff8f6] border-r border-[#dec1b4] flex flex-col p-6 space-y-8 z-50">
        <div className="flex items-center space-x-3 mb-8">
          <span className="material-symbols-outlined text-4xl text-[#9e4200]">dataset</span>
          <div>
            <div className="font-['EB_Garamond'] text-2xl font-bold text-[#9e4200]">RedRoad</div>
            <div className="text-[10px] uppercase tracking-widest text-[#574239]">Alina CRM v2</div>
          </div>
        </div>

        <ul className="flex flex-col space-y-2 flex-1">
          <li>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 bg-[#ffeae1] text-[#9e4200] rounded-xl font-bold">
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 text-[#574239] hover:bg-[#fff1eb] rounded-xl transition-colors">
              <span className="material-symbols-outlined">groups</span>
              <span>Klienci</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 text-[#574239] hover:bg-[#fff1eb] rounded-xl transition-colors">
              <span className="material-symbols-outlined">article</span>
              <span>Oferty</span>
            </a>
          </li>
          <li>
            <a href="#" className="flex items-center space-x-3 px-4 py-3 text-[#574239] hover:bg-[#fff1eb] rounded-xl transition-colors">
              <span className="material-symbols-outlined">mail</span>
              <span>Pisma</span>
            </a>
          </li>
        </ul>

        <div className="pt-8 border-t border-[#dec1b4]">
          <button className="w-full bg-[#c15814] text-white py-3 rounded-xl hover:bg-[#9e4200] transition-colors flex items-center justify-center space-x-2 font-bold shadow-lg shadow-orange-200">
            <span className="material-symbols-outlined">add</span>
            <span>Nowe Zdarzenie</span>
          </button>
        </div>
      </nav>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#fff8f6]/80 backdrop-blur-md border-b border-[#dec1b4] flex items-center justify-between px-8">
          <div className="flex items-center space-x-4">
             <h1 className="font-['EB_Garamond'] text-2xl font-medium italic text-[#9e4200]">Dashboard Operacyjny</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-[#ffeae1] px-4 py-1.5 rounded-full flex items-center space-x-2 border border-[#dec1b4]">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-xs font-semibold text-[#574239]">System Online</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f3ded6] border border-[#dec1b4] flex items-center justify-center">
               <span className="material-symbols-outlined text-[#8a7267]">person</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Quick Actions / Kafle */}
            <section>
              <h2 className="text-[#241914] font-['EB_Garamond'] text-2xl font-bold mb-6">Szybki dostęp</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* AKCJA: DODAJ KLIENTA */}
                <button className="group bg-white border-2 border-dashed border-[#dec1b4] hover:border-[#c15814] rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 transition-all hover:shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-[#fff1eb] group-hover:bg-[#c15814] flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-[#c15814] group-hover:text-white">person_add</span>
                  </div>
                  <span className="font-bold text-[#574239] group-hover:text-[#c15814]">Dodaj Klienta</span>
                </button>

                {stats.map((s, i) => (
                  <div key={i} className="bg-white border border-[#dec1b4] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-lg ${s.color.replace('bg-', 'bg-opacity-20 ')}`}>
                        <span className={`material-symbols-outlined ${s.color.replace('bg-', 'text-')}`}>{s.icon}</span>
                      </div>
                      <span className="text-2xl font-bold text-[#241914]">{s.value}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#574239]">{s.label}</div>
                    <div className="mt-4 w-full h-1 bg-[#fff1eb] rounded-full overflow-hidden">
                      <div className={`h-full ${s.color.replace('container', '')}`} style={{width: '60%'}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ostatnie Zgłoszenia (Kafle poziome) */}
            <section>
               <h2 className="text-[#241914] font-['EB_Garamond'] text-2xl font-bold mb-6">Ostatni Feedback (Alina)</h2>
               <div className="space-y-4">
                  {[
                    { user: 'redroadai@gmail.com', msg: 'brakuje + aby dodac klienta szybko', sev: 'bug' },
                    { user: 'alinakwidzinska@gmail.com', msg: 'wszystko się rozmyło po kliknięciu', sev: 'error' }
                  ].map((f, i) => (
                    <div key={i} className="bg-white border border-[#dec1b4] rounded-2xl p-5 flex items-center justify-between hover:bg-[#fff8f6] transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={`w-2 h-12 rounded-full ${f.sev === 'bug' ? 'bg-[#c15814]' : 'bg-[#ba1a1a]'}`}></div>
                        <div>
                          <div className="font-bold text-[#241914]">{f.user}</div>
                          <div className="text-sm text-[#574239]">{f.msg}</div>
                        </div>
                      </div>
                      <button className="px-4 py-2 text-[#9e4200] font-bold text-sm hover:bg-[#ffeae1] rounded-lg transition-colors">
                        Odpowiedz
                      </button>
                    </div>
                  ))}
               </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default DesignSahara;
