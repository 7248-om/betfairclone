export default function AdminPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Main Admin Portal
          </h1>
          <p className="text-neutral-400 mt-2">Manage the platform economy and master agents.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Minting Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Treasury</span>
            </h2>
            <div className="text-4xl font-bold font-mono tracking-tight mb-2">
              1,000,000<span className="text-emerald-500 text-lg ml-1">VC</span>
            </div>
            <p className="text-sm text-neutral-500 mb-6">Total Uncirculated Virtual Coins</p>
            <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Mint Coins
            </button>
          </div>

          {/* Master Agents Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl md:col-span-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Master Agents</span>
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-neutral-800/50 p-3 rounded-lg border border-neutral-800/50">
                <div>
                  <div className="font-medium">Master_Europe</div>
                  <div className="text-xs text-neutral-500">35 Active Clients</div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <div className="font-mono">50,000 VC</div>
                    <div className="text-xs text-neutral-500">Balance</div>
                  </div>
                  <button className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1 text-sm rounded transition-colors">
                    Fund
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
