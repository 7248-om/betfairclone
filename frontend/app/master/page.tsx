export default function MasterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-blue-400">
            Master Agent Dashboard
          </h1>
          <p className="text-slate-400 mt-2">Manage your clients and oversee betting activity.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agent Balance Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Agent Balance</span>
            </h2>
            <div className="text-4xl font-bold font-mono tracking-tight mb-2">
              50,000<span className="text-blue-500 text-lg ml-1">VC</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">Available to distribute</p>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Request Funds
            </button>
          </div>

          {/* Client Management Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl md:col-span-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Your Clients</span>
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-800/50">
                <div>
                  <div className="font-medium">Client_001</div>
                  <div className="text-xs text-slate-400">Active Bets: 3</div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <div className="font-mono">1,500 VC</div>
                    <div className="text-xs text-slate-500">Balance</div>
                  </div>
                  <button className="bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm rounded transition-colors">
                    Transfer
                  </button>
                  <button className="bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm rounded transition-colors">
                    View Bets
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
