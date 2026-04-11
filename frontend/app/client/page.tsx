export default function ClientPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col pt-16">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6 z-50">
        <div className="text-xl font-black italic tracking-wider">
          STAKE<span className="text-orange-500">CLONE</span>
        </div>
        <div className="flex items-center space-x-4 bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700">
          <span className="text-sm text-zinc-400">Balance:</span>
          <span className="font-mono font-bold text-orange-400">1,500.00</span>
        </div>
      </nav>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] w-full mx-auto">
        
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-zinc-900 p-4 hidden lg:block border-r border-zinc-800 overflow-y-auto">
          <ul className="space-y-2">
            <li><button className="w-full text-left px-4 py-2 bg-zinc-800 rounded-lg font-medium text-orange-400">⚽️ Soccer</button></li>
            <li><button className="w-full text-left px-4 py-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">🎾 Tennis</button></li>
            <li><button className="w-full text-left px-4 py-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">🏀 Basketball</button></li>
            <li><button className="w-full text-left px-4 py-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">🏏 Cricket</button></li>
          </ul>
        </aside>

        {/* Center Content: Sportsbook */}
        <main className="flex-1 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-6 flex items-center">
            <span className="w-2 h-6 bg-orange-500 rounded-full mr-3"></span>
            English Premier League
          </h1>

          <div className="space-y-4">
            {/* Example Match Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
              <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between text-sm text-zinc-400">
                <span>Today, 15:00 UTC</span>
                <span className="flex items-center text-green-400"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>In-Play</span>
              </div>
              <div className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1 space-y-2 font-medium text-lg w-full">
                  <div>Arsenal</div>
                  <div>Manchester City</div>
                </div>
                
                {/* Odds Buttons */}
                <div className="flex gap-2 w-full md:w-auto">
                  <button className="flex-1 md:w-20 lg:w-24 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 py-3 rounded text-center transition-all">
                    <div className="font-bold text-blue-300">2.40</div>
                  </button>
                  <button className="flex-1 md:w-20 lg:w-24 bg-zinc-800 hover:bg-zinc-700 py-3 rounded text-center transition-all">
                    <div className="font-bold text-zinc-300">3.15</div>
                  </button>
                  <button className="flex-1 md:w-20 lg:w-24 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 py-3 rounded text-center transition-all">
                    <div className="font-bold text-blue-300">2.80</div>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Another Match Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
              <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between text-sm text-zinc-400">
                <span>Tomorrow, 14:00 UTC</span>
                <span>Scheduled</span>
              </div>
              <div className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1 space-y-2 font-medium text-lg w-full">
                  <div>Chelsea</div>
                  <div>Liverpool</div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button className="flex-1 md:w-20 lg:w-24 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 py-3 rounded text-center transition-all">
                    <div className="font-bold text-blue-300">3.20</div>
                  </button>
                  <button className="flex-1 md:w-20 lg:w-24 bg-zinc-800 hover:bg-zinc-700 py-3 rounded text-center transition-all">
                    <div className="font-bold text-zinc-300">3.50</div>
                  </button>
                  <button className="flex-1 md:w-20 lg:w-24 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 py-3 rounded text-center transition-all">
                    <div className="font-bold text-blue-300">2.10</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Betslip Container */}
        <aside className="w-80 bg-zinc-900 border-l border-zinc-800 hidden xl:flex flex-col">
          <div className="p-4 border-b border-zinc-800 font-bold flex justify-between items-center text-zinc-300">
            <span>Betslip</span>
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">0</span>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-zinc-600 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Your betslip is empty.</p>
            <p className="text-sm mt-1">Please select an outcome to place a bet.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
