import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { usePlaceBet } from "../hooks/usePlaceBet";

interface BetSlipProps {
  matchId: string | null;
  matchName: string | null;
  runnerId: string | null;
  runnerName: string | null;
  odds: number | null;
  onClose: () => void;
}

export default function BetSlip({
  matchId,
  matchName,
  runnerId,
  runnerName,
  odds,
  onClose,
}: BetSlipProps) {
  const { user } = useAuthStore();
  const { placeBet, isPlacing, error: betError } = usePlaceBet();

  const [stake, setStake] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-clear states when a new selection is passed in
  useEffect(() => {
    setStake("");
    setSuccessMsg(null);
  }, [matchId, runnerId]);

  if (!matchId || !runnerId) return null;

  const handleStakeClick = (amount: number) => {
    setStake((prev) => (parseFloat(prev || "0") + amount).toString());
  };

  const handlePlaceBet = async () => {
    if (!stake || isNaN(Number(stake)) || Number(stake) <= 0) return;
    try {
      await placeBet(matchId, runnerId, Number(stake));
      setSuccessMsg("Bet placed successfully!");
      setStake("");
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 2000);
    } catch (err) {
      // hook already handles error state
    }
  };

  const potentialPayout = (Number(stake || 0) * (odds || 0)).toFixed(2);
  const risk = Number(stake || 0).toFixed(2);
  
  // Chip configuration based on user preferences or fallbacks
  const chips = user?.stakePreferences?.length
    ? user.stakePreferences
    : [100, 500, 1000, 5000];

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl flex flex-col z-50 text-[var(--text-primary)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--teal-dark)] text-white">
        <h2 className="text-lg font-bold uppercase tracking-wider">Bet Slip</h2>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1"
          disabled={isPlacing}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Match Info */}
        <div className="bg-[var(--bg-elevated)] p-3 rounded border border-[var(--border-light)] shadow-sm">
          <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold">{matchName}</p>
          <div className="flex justify-between items-end mt-2">
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">To Win</p>
              <p className="text-lg font-bold text-[var(--teal-dark)]">{runnerName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-secondary)]">Odds</p>
              <p className="text-xl font-bold font-mono text-[var(--text-primary)]">{odds?.toFixed(2) || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Stake Input */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase mb-1">
            Stake Amount (VC)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">
              $
            </span>
            <input
              type="number"
              min="1"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="0"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xl text-[var(--text-primary)] font-mono p-3 pl-8 focus:border-[var(--teal)] focus:ring-1 focus:ring-[var(--teal)] outline-none transition-all"
              disabled={isPlacing || !!successMsg}
            />
          </div>
        </div>

        {/* Quick Chips */}
        <div className="grid grid-cols-4 gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleStakeClick(chip)}
              disabled={isPlacing || !!successMsg}
              className="bg-[var(--teal-muted)] hover:bg-[var(--teal)] text-[var(--teal-dark)] hover:text-white border border-[var(--border-light)] font-mono text-xs font-bold py-2 rounded transition-colors disabled:opacity-50"
            >
              +{chip}
            </button>
          ))}
          <button
            onClick={() => setStake("")}
            disabled={isPlacing || !!successMsg || !stake}
            className="col-span-4 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 text-xs py-1.5 font-bold rounded transition-all mt-1"
          >
            CLEAR STAKE
          </button>
        </div>

        {/* Messages */}
        {betError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded">
            {betError}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold text-center p-3 rounded">
            {successMsg}
          </div>
        )}
      </div>

      {/* Footer / Summary */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-[var(--text-secondary)]">Total Stake:</span>
          <span className="text-[var(--text-primary)] font-mono">{risk} VC</span>
        </div>
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-[var(--text-secondary)]">Potential Return:</span>
          <span className="text-[var(--teal-dark)] font-mono font-black text-lg">{potentialPayout} VC</span>
        </div>

        {user ? (
          <button
            onClick={handlePlaceBet}
            disabled={isPlacing || !!successMsg || !stake || Number(stake) <= 0 || Number(stake) > user.balance}
            className={`w-full py-3 rounded uppercase tracking-wider font-bold transition-all shadow-md text-sm ${
              isPlacing
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : successMsg
                ? "bg-emerald-500 text-white"
                : Number(stake) > user.balance
                ? "bg-red-100 text-red-600 border border-red-300 cursor-not-allowed"
                : "bg-[var(--teal)] hover:opacity-90 text-[var(--bg-primary)] shadow-[var(--teal-muted)] hover:shadow-md"
            }`}
          >
            {isPlacing ? "Placing..." : successMsg ? "Done!" : Number(stake) > user.balance ? "Insufficient Balance" : "Place Bet"}
          </button>
        ) : (
          <button disabled className="w-full py-3 bg-gray-200 text-gray-500 rounded font-bold uppercase transition-colors">
            Login to Bet
          </button>
        )}
        
        {user && (
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Available Balance: <span className="font-mono text-[var(--text-primary)] font-bold">{user.balance?.toFixed(2)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
