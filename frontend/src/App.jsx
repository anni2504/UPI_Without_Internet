import { useCallback, useEffect, useState } from 'react';
import {
  GitMerge,
  Globe,
  Network,
  PlayCircle,
  Plus,
  Radio,
  Receipt,
  RotateCcw,
  Terminal,
  UploadCloud,
  Wallet,
  WifiOff,
} from 'lucide-react';

function App() {
  const [meshState, setMeshState] = useState({ devices: [], idempotencyCacheSize: 0 });
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState(['[system] UPI Offline Mesh initialized... Ready for demo.']);
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState('500');
  const [pin, setPin] = useState('1234');

  const log = useCallback((msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev]);
  }, []);

  const refresh = useCallback(async () => {
    const [mesh, accs, txs] = await Promise.all([
      fetch('/api/mesh/state').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/transactions').then((r) => r.json()),
    ]);
    setMeshState(mesh);
    setAccounts(accs);
    setTransactions(txs);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function sendPacket() {
    const body = {
      senderVpa,
      receiverVpa,
      amount: parseFloat(amount),
      pin,
      ttl: 5,
      startDevice: 'phone-alice',
    };
    const r = await fetch('/api/demo/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => res.json());

    log(`📤 Packet created and injected on Alice's device:`);
    log(`   ↳ ID: <span class="text-violet-400 font-mono">${r.packetId}</span>`);
    log(`   ↳ Ciphertext preview: <span class="text-slate-500 font-mono">${r.ciphertextPreview}</span>`);
    refresh();
  }

  async function gossip() {
    const r = await fetch('/api/mesh/gossip', { method: 'POST' }).then((res) => res.json());
    log(`🔄 Bluetooth Gossip Round executed:`);
    log(`   ↳ Total data packet transfers: <span class="text-pink-400 font-bold">${r.transfers}</span>`);
    log(`   ↳ Node routing count list: <span class="text-slate-400 font-mono">${JSON.stringify(r.deviceCounts)}</span>`);
    refresh();
  }

  async function flushBridges() {
    const r = await fetch('/api/mesh/flush', { method: 'POST' }).then((res) => res.json());
    log(`📡 Uploading bridge queues via 4G:`);
    log(`   ↳ Uploads initiated: <span class="text-emerald-400 font-bold">${r.uploadsAttempted}</span>`);
    r.results.forEach((res) => {
      const outcomeColor = res.outcome === 'SETTLED' ? 'text-emerald-400' : 'text-amber-400';
      log(
        `   ↳ <span class="text-slate-400">${res.bridgeNode}</span> packet <span class="text-purple-300 font-mono">${res.packetId}</span> → <span class="${outcomeColor} font-bold">${res.outcome}</span>${res.reason ? ` (${res.reason})` : ''}`
      );
    });
    refresh();
  }

  async function resetMesh() {
    await fetch('/api/mesh/reset', { method: 'POST' });
    log('🗑 Mesh network cleared and idempotency cache purged.');
    refresh();
  }

  return (
    <div className="text-slate-100 font-sans min-h-screen pb-12 antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-8 border-b border-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-400 to-emerald-400">
                UPI Offline Mesh System
              </h1>
              <p className="text-xs text-purple-300/60 font-medium">
                MERN stack — offline packet-routing & duplicate-storm settlement
              </p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex gap-3">
            <button
              onClick={resetMesh}
              className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/20 active:scale-95 transition-all text-xs font-semibold flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset System State
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-6 shadow-glow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-purple-400" />
                  <h2 className="text-md font-bold tracking-tight text-purple-200">Mesh Network Visualizer</h2>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                  Idempotency Cache: {meshState.idempotencyCacheSize}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {meshState.devices.map((d) => {
                  const isBridge = d.hasInternet;
                  const cardStyle = isBridge
                    ? 'border-emerald-500/30 bg-emerald-950/15 shadow-glow-green text-emerald-100'
                    : 'border-purple-500/10 bg-slate-950/20 text-slate-300';
                  const badgeStyle = isBridge
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-purple-500/10 text-purple-300 border border-purple-500/20';

                  return (
                    <div
                      key={d.deviceId}
                      className={`border rounded-2xl p-4 flex flex-col items-center justify-between text-center relative ${cardStyle} transition-all duration-300`}
                    >
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {d.packetCount > 0 && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                          </span>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-900/60 border border-purple-500/10 flex items-center justify-center mb-3">
                        {isBridge ? (
                          <Globe className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                      <h4 className="font-bold text-xs mb-1">{d.deviceId}</h4>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mb-3 ${badgeStyle}`}>
                        {isBridge ? '🌐 Online (4G)' : '🚫 Offline'}
                      </span>
                      <div className="w-full pt-3 border-t border-purple-500/5">
                        <span className="text-[10px] font-bold text-slate-400">Queue: {d.packetCount} packet(s)</span>
                        <div className="flex flex-wrap justify-center gap-1 mt-2">
                          {d.packetIds.map((id) => (
                            <span
                              key={id}
                              className="text-[8px] font-mono bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.5 rounded text-purple-300"
                              title={id}
                            >
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-6 shadow-glow">
              <h2 className="text-md font-bold tracking-tight text-purple-200 mb-6 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-purple-400" />
                Interactive Demo Steps
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col h-full bg-slate-950/40 border border-purple-500/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs">1</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300/40">Compose</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2">Simulate Offline Sender</h3>
                  <p className="text-xs text-slate-400 mb-4 flex-1">
                    Alice has no internet. Compose a payment to inject an encrypted packet into her phone's queue.
                  </p>
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase font-bold tracking-wider text-purple-300/40 block mb-1">From</label>
                        <select
                          value={senderVpa}
                          onChange={(e) => setSenderVpa(e.target.value)}
                          className="w-full bg-slate-950/60 border border-purple-500/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option>alice@demo</option>
                          <option>bob@demo</option>
                          <option>carol@demo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold tracking-wider text-purple-300/40 block mb-1">To</label>
                        <select
                          value={receiverVpa}
                          onChange={(e) => setReceiverVpa(e.target.value)}
                          className="w-full bg-slate-950/60 border border-purple-500/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option>bob@demo</option>
                          <option>carol@demo</option>
                          <option>alice@demo</option>
                          <option>dave@demo</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase font-bold tracking-wider text-purple-300/40 block mb-1">Amount</label>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-slate-950/60 border border-purple-500/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold tracking-wider text-purple-300/40 block mb-1">UPI PIN</label>
                        <input
                          type="text"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          maxLength={4}
                          className="w-full bg-slate-950/60 border border-purple-500/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={sendPacket}
                    className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 text-xs font-semibold rounded-xl shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Inject into Mesh
                  </button>
                </div>

                <div className="flex flex-col h-full bg-slate-950/40 border border-purple-500/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-7 h-7 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center font-bold text-xs">2</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300/40">Gossip</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2">Run Bluetooth Gossip</h3>
                  <p className="text-xs text-slate-400 mb-4 flex-1">
                    Simulate local device-to-device hops. Encrypted packets propagate through nearby nodes within Bluetooth range.
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={gossip}
                      className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-xs font-semibold rounded-xl shadow-lg shadow-pink-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Gossip Round
                    </button>
                  </div>
                </div>

                <div className="flex flex-col h-full bg-slate-950/40 border border-purple-500/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">3</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300/40">Settlement</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2">Bridges Upload (4G)</h3>
                  <p className="text-xs text-slate-400 mb-4 flex-1">
                    Bridge node gains internet access and uploads queued packets. Tests parallel deduplication and verification.
                  </p>
                  <div className="mt-auto">
                    <button
                      onClick={flushBridges}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Upload & Settle
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-6 shadow-glow">
              <h2 className="text-md font-bold tracking-tight text-purple-200 mb-6 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-400" />
                Transaction Ledger
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-purple-500/10 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="pb-3 font-semibold">ID</th>
                      <th className="pb-3 font-semibold">From</th>
                      <th className="pb-3 font-semibold">To</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Bridge</th>
                      <th className="pb-3 font-semibold">Hops</th>
                      <th className="pb-3 font-semibold">Settled At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/5 text-slate-300">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500 text-xs italic">
                          No transactions settled yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        let statusClass = 'text-slate-400 bg-slate-500/10 border-slate-500/25';
                        if (t.status === 'SETTLED') statusClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
                        if (t.status === 'REJECTED' || t.status === 'INVALID') statusClass = 'text-rose-400 bg-rose-500/10 border-rose-500/25';
                        if (t.status === 'DUPLICATE_DROPPED') statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/25';

                        return (
                          <tr key={t.id} className="hover:bg-purple-500/5 transition-colors">
                            <td className="py-3 font-mono text-[10px] text-purple-300 font-semibold">#{t.id}</td>
                            <td className="py-3 font-mono">{t.senderVpa}</td>
                            <td className="py-3 font-mono">{t.receiverVpa}</td>
                            <td className="py-3 font-mono font-bold text-slate-200">₹{parseFloat(t.amount).toFixed(2)}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold tracking-wider ${statusClass}`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 font-mono text-slate-400">{t.bridgeNodeId}</td>
                            <td className="py-3 text-slate-400">{t.hopCount}</td>
                            <td className="py-3 text-slate-500">{new Date(t.settledAt).toLocaleTimeString()}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-6 shadow-glow">
              <h2 className="text-md font-bold tracking-tight text-purple-200 mb-6 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Simulated Balances
              </h2>
              <div className="space-y-4">
                {accounts.map((a) => (
                  <div
                    key={a.vpa}
                    className="bg-slate-950/40 border border-purple-500/5 rounded-2xl p-4 flex items-center justify-between hover:border-purple-500/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-300 text-xs font-mono font-bold">
                        VPA
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{a.holderName}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">{a.vpa}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono">₹{parseFloat(a.balance).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-6 shadow-glow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-md font-bold tracking-tight text-purple-200 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  Live Console Log
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Live</span>
                </div>
              </div>
              <div className="h-64 bg-slate-950/80 border border-purple-500/10 rounded-xl p-4 font-mono text-[10px] text-emerald-400 overflow-y-auto leading-relaxed shadow-inner whitespace-pre-wrap">
                {logs.map((entry, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: entry.replace(/^\[([^\]]+)\]/, '<span class="text-purple-400">[$1]</span>') }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
