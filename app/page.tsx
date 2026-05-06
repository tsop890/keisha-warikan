'use client';

import { useState, useCallback } from 'react';

const RATIOS = [
  { v: 1.0, n: 'スタンダード', s: '1.0x' },
  { v: 1.1, n: 'ちょっと多め', s: '1.1x' },
  { v: 1.2, n: '先輩・上級生', s: '1.2x' },
  { v: 1.5, n: 'リーダー', s: '1.5x' },
  { v: 1.8, n: 'VIP・太っ腹', s: '1.8x' },
  { v: 2.0, n: '男気・ダブル', s: '2.0x' },
];

const PH = ['例：部長', '例：一般', '例：先輩', '例：後輩', '例：幹事'];

type Group = { name: string; count: number; countStr: string; ratio: number; custom: boolean; customVal: number };
type Adj = { reason: string; amount: number; sign: 'minus' | 'plus'; gIdx: number; cnt: number };
type Bill = {
  label: string;
  total: string;
  attendCounts: number[]; // グループごとの参加人数
  adjs: Adj[];
  calculated: boolean;
};

const defaultGroups = (): Group[] => [
  { name: '', count: 5, countStr: '5', ratio: 1.5, custom: false, customVal: 1.0 },
  { name: '', count: 4, countStr: '4', ratio: 1.0, custom: false, customVal: 1.0 },
];

const makeBill = (groups: Group[]): Bill => ({
  label: '',
  total: '',
  attendCounts: groups.map(g => g.count),
  adjs: [],
  calculated: false,
});

export default function Home() {
  const [step, setStep] = useState(1); // 1:件数 2:グループ設定 3:件ごと入力 4:結果 5:集金 6:完了
  const [billCount, setBillCount] = useState(1);
  const [groups, setGroups] = useState<Group[]>(defaultGroups());
  const [bills, setBills] = useState<Bill[]>([makeBill(defaultGroups())]);
  const [currentBill, setCurrentBill] = useState(0);
  const [packOn, setPackOn] = useState(false);
  const [packPaid, setPackPaid] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [ru, setRu] = useState(100);
  const [totalErr, setTotalErr] = useState(false);
  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [lTpl, setLTpl] = useState<'polite' | 'frank' | 'list'>('polite');
  const [tR, setTR] = useState(false);
  const [tS, setTS] = useState(false);
  const [rTpl, setRTpl] = useState<'mild' | 'std' | 'urgent'>('mild');

  const isValid = (v: string) => /^[1-9][0-9]*$/.test(v.trim());
  const gName = (i: number) => groups[i]?.name || PH[i] || `グループ${i + 1}`;
  const getMax = (gIdx: number, billIdx: number) => gIdx < 0 || !groups[gIdx] ? 99 : groups[gIdx].count;

  const updateGroupCount = (i: number, val: string) => {
    const num = parseInt(val);
    setGroups(gs => gs.map((x, j) => j === i ? { ...x, countStr: val, count: isNaN(num) || num < 1 ? 1 : num } : x));
    setBills(bs => bs.map(b => ({ ...b, attendCounts: b.attendCounts.map((c, j) => j === i ? (isNaN(num) || num < 1 ? 1 : num) : c) })));
  };

  const stepGroupCount = (i: number, delta: number) => {
    setGroups(gs => gs.map((x, j) => {
      if (j !== i) return x;
      const next = Math.max(1, x.count + delta);
      return { ...x, count: next, countStr: String(next) };
    }));
    setBills(bs => bs.map(b => ({ ...b, attendCounts: b.attendCounts.map((c, j) => j === i ? Math.max(1, c + delta) : c) })));
  };

  const updateAttend = (billIdx: number, gIdx: number, delta: number) => {
    setBills(bs => bs.map((b, bi) => {
      if (bi !== billIdx) return b;
      const newCounts = [...b.attendCounts];
      newCounts[gIdx] = Math.max(0, newCounts[gIdx] + delta);
      return { ...b, attendCounts: newCounts };
    }));
  };

  const updateBill = (billIdx: number, key: keyof Bill, val: any) => {
    setBills(bs => bs.map((b, i) => i === billIdx ? { ...b, [key]: val } : b));
  };

  const calcBill = (billIdx: number) => {
    const bill = bills[billIdx];
    if (!isValid(bill.total)) { setTotalErr(true); return null; }
    let total = parseInt(bill.total);
    if (packOn) total += 500;
    const disc = bill.adjs.filter(a => a.sign === 'minus').reduce((s, a) => s + a.amount * a.cnt, 0);
    const extr = bill.adjs.filter(a => a.sign === 'plus').reduce((s, a) => s + a.amount * a.cnt, 0);
    const rem = total + disc - extr;
    const units = groups.reduce((s, g, gi) => s + bill.attendCounts[gi] * (g.custom ? g.customVal : g.ratio), 0);
    const base = units > 0 ? rem / units : 0;
    const gRes = groups.map((g, gi) => {
      const r = g.custom ? g.customVal : g.ratio;
      const ideal = r * base;
      const pp = Math.ceil(ideal / ru) * ru;
      return { ...g, r, pp, ideal, attend: bill.attendCounts[gi] };
    });
    const col = gRes.reduce((s, g) => s + g.pp * g.attend, 0) + extr - disc;
    return { groups: gRes, otsuri: Math.round(col - total), total, collected: Math.round(col), adjs: bill.adjs, label: bill.label };
  };

  const calcAll = () => {
    const results = bills.map((_, i) => calcBill(i));
    if (results.some(r => r === null)) return;
    setCalcResults(results as any[]);

    // 集金チェックリスト構築
    const mbs: any[] = [];
    groups.forEach((g, gi) => {
      // 最大参加回数を基準に1人ずつ追加
      for (let i = 0; i < g.count; i++) {
        const totalAmt = (results as any[]).reduce((s, r) => {
          const gr = r.groups[gi];
          return s + (i < gr.attend ? gr.pp : 0);
        }, 0);
        mbs.push({ label: gName(gi), amount: totalAmt, name: '', paid: false });
      }
    });
    setMembers(mbs);
    setStep(4);
  };

  const buildLP = () => {
    if (!calcResults.length) return '';
    // 合計を計算
    const grandTotal = calcResults.reduce((s, r) => s + r.total, 0);
    const groupTotals = groups.map((g, gi) => ({
      name: gName(gi),
      ratio: g.custom ? g.customVal : g.ratio,
      total: calcResults.reduce((s, r) => s + r.groups[gi].pp * r.groups[gi].attend / r.groups[gi].attend, 0),
      perPerson: calcResults.reduce((s, r) => s + r.groups[gi].pp, 0),
    }));

    const lines: string[] = [];
    groupTotals.forEach(g => {
      const rs = tR ? ` (${g.ratio.toFixed(1)}x)` : '';
      lines.push(`${g.name}${rs}：¥${g.perPerson.toLocaleString()}（合計）`);
    });
    if (tS && packOn) lines.push('※ システム利用料 ¥500 含む');
    const body = lines.join('\n');
    const totalOtsuri = calcResults.reduce((s, r) => s + r.otsuri, 0);
    if (lTpl === 'polite') return `お疲れさまでした🍶\n本日はありがとうございました！\nお会計のご連絡です。\n\n${body}\n\nお釣り: ¥${totalOtsuri.toLocaleString()}\n\nご確認よろしくお願いします🙏`;
    if (lTpl === 'frank') return `今日もお疲れ〜🍶\n割り勘ね！\n\n${body}\n\nお釣り¥${totalOtsuri.toLocaleString()}は後で還元するよ！`;
    return body;
  };

  const restart = () => {
    setStep(1); setBillCount(1); setGroups(defaultGroups());
    setBills([makeBill(defaultGroups())]); setCurrentBill(0);
    setPackOn(false); setPackPaid(false); setCalcResults([]); setMembers([]);
    setTotalErr(false);
  };

  const gradCol = (pct: number) => {
    const p = Math.max(-15, Math.min(15, pct));
    if (Math.abs(p) < 0.5) return { fill: '#2D5A27', text: 'ぴったり ✓' };
    if (p > 0) { const t = Math.min(1, p / 10); return { fill: `rgb(${Math.round(45 + 210 * t)},${Math.round(90 * (1 - t))},${Math.round(39 * (1 - t))})`, text: `多め +${p.toFixed(1)}%` }; }
    const t = Math.min(1, -p / 10); return { fill: `rgb(${Math.round(45 * (1 - t))},${Math.round(90 + 30 * t)},${Math.round(39 + 180 * t)})`, text: `少なめ ${p.toFixed(1)}%` };
  };

  return (
    <main className="w-full max-w-full mx-auto bg-[#f5f5f0] min-h-screen pb-20">
      {/* Header */}
      <div className="bg-[#2D5A27] px-4 py-3 flex items-center gap-3">
        <span className="text-xl">🍶</span>
        <div><div className="text-white font-bold text-lg tracking-widest">KEISHA</div><div className="text-[#9dc99a] text-xs">傾斜割り勘計算ツール</div></div>
      </div>

      {/* Steps */}
      <div className="flex px-4 pt-2 bg-[#f5f5f0]">
        {['件数', 'グループ', '入力', '結果', '集金', '完了'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex-1 text-center">
              <div className={`w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-medium ${step > i + 1 ? 'bg-[#9dc99a] text-white' : step === i + 1 ? 'bg-[#2D5A27] text-white' : 'bg-gray-300 text-gray-500'}`}>{i + 1}</div>
              <div className={`text-[9px] ${step === i + 1 ? 'text-[#2D5A27] font-medium' : 'text-gray-400'}`}>{label}</div>
            </div>
            {i < 5 && <div className="flex-1 flex items-center pb-4"><div className="h-0.5 w-full bg-gray-200"><div className="h-full bg-[#2D5A27] transition-all" style={{ width: step > i + 1 ? '100%' : '0%' }} /></div></div>}
          </div>
        ))}
      </div>

      {/* STEP 1: 件数選択 */}
      {step === 1 && (
        <div className="p-4">
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">今夜は何件行きますか？</div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-5 gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setBillCount(n)}
                    className={`py-3 rounded-xl border-2 text-lg font-bold transition-all ${billCount === n ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-200 text-gray-500'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400 text-center">あとから変更もできます</div>
            </div>
          </div>

          <div className="mb-4 bg-[#fff8ee] border border-[#F39C12] rounded-xl p-4">
            <div className="flex items-center gap-3 cursor-pointer mb-2" onClick={() => setPackOn(!packOn)}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${packOn ? 'bg-[#F39C12] border-[#F39C12] text-white' : 'border-[#F39C12] bg-white'}`}>{packOn && '✓'}</div>
              <div className="text-sm font-medium text-gray-700">集金スムーズパック (+500円) を利用する</div>
            </div>
            <div className="text-xs text-[#b36b00] bg-[#fff3dc] rounded-lg px-3 py-2 mb-2 leading-relaxed">幹事の負担は0円！+500円は全員で均等に負担されるよう自動計算されます。</div>
            {['集金チェックリスト', '未払いリマインド文を自動生成', 'PayPay送金リンクをLINEに自動挿入'].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-[#b36b00]"><span className="text-[#F39C12] font-bold">✓</span>{f}</div>
            ))}
          </div>

          <button onClick={() => {
            const newBills = Array.from({ length: billCount }, () => makeBill(groups));
            setBills(newBills);
            setStep(2);
          }} style={{ backgroundColor: '#F39C12' }} className="w-full py-4 rounded-xl text-white text-lg font-bold">
            次へ →
          </button>
        </div>
      )}

      {/* STEP 2: グループ設定 */}
      {step === 2 && (
        <div className="p-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4">← 戻る</button>
          <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">グループ設定（全件共通）</div>
          <div className="text-xs text-gray-400 mb-4">ここで設定した人数が各件の最大人数になります。件ごとに増減できます。</div>

          {groups.map((g, i) => (
            <div key={i} className="bg-white rounded-xl p-3 mb-2 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <input value={g.name} placeholder={PH[i] || '例：グループ名'}
                  onChange={e => setGroups(gs => gs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-[#2D5A27]" />
                <button onClick={() => setGroups(gs => gs.filter((_, j) => j !== i))}
                  className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center">×</button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 flex-shrink-0">最大人数</span>
                <button onClick={() => stepGroupCount(i, -1)} className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center">－</button>
                <input type="number" inputMode="numeric" value={g.countStr}
                  onChange={e => updateGroupCount(i, e.target.value)}
                  onBlur={e => { const n = parseInt(e.target.value); const s = isNaN(n) || n < 1 ? 1 : n; setGroups(gs => gs.map((x, j) => j === i ? { ...x, count: s, countStr: String(s) } : x)); }}
                  className="w-14 border border-gray-200 rounded-lg text-center text-base text-gray-800 font-medium py-2 outline-none focus:border-[#2D5A27]" />
                <button onClick={() => stepGroupCount(i, 1)} className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center">＋</button>
                <span className="text-xs text-gray-500">人</span>
              </div>
              <div className="text-[11px] text-gray-400 mb-1">比率</div>
              <div className="grid grid-cols-4 gap-1">
                {RATIOS.map(r => (
                  <button key={r.v} onClick={() => setGroups(gs => gs.map((x, j) => j === i ? { ...x, ratio: r.v, custom: false } : x))}
                    className={`py-1.5 px-0.5 rounded-md border-2 text-center transition-all ${(!g.custom && g.ratio === r.v) ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    <span className="block text-[11px] font-semibold">{r.s}</span>
                    <span className="block text-[9px] opacity-70">{r.n}</span>
                  </button>
                ))}
                <button onClick={() => setGroups(gs => gs.map((x, j) => j === i ? { ...x, custom: true } : x))}
                  className={`py-1.5 px-0.5 rounded-md border-2 text-center transition-all ${g.custom ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  <span className="block text-[11px] font-semibold">自由</span>
                  <span className="block text-[9px] opacity-70">カスタム</span>
                </button>
              </div>
              {g.custom && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">倍率：</span>
                  <input type="number" step={0.1} min={0.1} value={g.customVal}
                    onChange={e => setGroups(gs => gs.map((x, j) => j === i ? { ...x, customVal: Math.max(0.1, parseFloat(e.target.value) || 1) } : x))}
                    className="w-16 border border-gray-200 rounded-lg text-center text-sm text-gray-800 py-1 outline-none focus:border-[#2D5A27]" />
                  <span className="text-xs text-gray-500">x</span>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setGroups(gs => [...gs, { name: '', count: 3, countStr: '3', ratio: 1.0, custom: false, customVal: 1.0 }])}
            className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-400 mb-4">
            ＋ グループを追加
          </button>

          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">端数の処理</div>
            <div className="flex rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100">
              {[100, 10, 1].map(u => (
                <button key={u} onClick={() => setRu(u)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${ru === u ? 'bg-[#2D5A27] text-white font-bold' : 'text-gray-500'}`}>{u}円</button>
              ))}
            </div>
          </div>

          <button onClick={() => {
            setBills(Array.from({ length: billCount }, () => makeBill(groups)));
            setCurrentBill(0);
            setStep(3);
          }} style={{ backgroundColor: '#F39C12' }} className="w-full py-4 rounded-xl text-white text-lg font-bold">
            件ごとの入力へ →
          </button>
        </div>
      )}

      {/* STEP 3: 件ごと入力 */}
      {step === 3 && (
        <div className="p-4">
          <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4">← グループ設定に戻る</button>

          {/* タブ */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {bills.map((b, i) => (
              <button key={i} onClick={() => setCurrentBill(i)}
                className={`px-4 py-1.5 rounded-full border-2 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${currentBill === i ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : b.calculated ? 'bg-[#9dc99a] border-[#9dc99a] text-white' : 'border-gray-200 text-gray-500'}`}>
                {i + 1}件目{b.calculated ? ' ✓' : ''}
              </button>
            ))}
          </div>

          {/* 現在の件 */}
          {(() => {
            const bill = bills[currentBill];
            return (
              <div>
                <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                  <div className="text-xs text-gray-400 mb-1">店名・メモ（任意）</div>
                  <input type="text" placeholder="例：〇〇居酒屋" value={bill.label}
                    onChange={e => updateBill(currentBill, 'label', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-[#2D5A27] mb-3" />
                  <div className="text-xs text-gray-400 mb-1">合計金額（円）</div>
                  <input type="text" inputMode="numeric" placeholder="例：32000" value={bill.total}
                    onChange={e => { updateBill(currentBill, 'total', e.target.value); setTotalErr(false); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none ${totalErr && !isValid(bill.total) ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#2D5A27]'}`} />
                  {totalErr && !isValid(bill.total) && <div className="text-xs text-red-500 mt-1">正しい金額を入力してください</div>}
                </div>

                {/* 参加人数調整 */}
                <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                  <div className="text-xs text-gray-500 font-medium mb-1">この件の参加人数</div>
                  <div className="text-xs text-gray-400 mb-3">グループの最大人数から増減できます</div>
                  {groups.map((g, gi) => {
                    const attend = bill.attendCounts[gi] ?? g.count;
                    const max = g.count;
                    const diff = attend - max;
                    return (
                      <div key={gi} className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-gray-800">{gName(gi)}</span>
                            <span className="ml-2 text-xs bg-[#eef5ec] text-[#2D5A27] px-2 py-0.5 rounded-full">{(g.custom ? g.customVal : g.ratio).toFixed(1)}x</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateAttend(currentBill, gi, -1)} disabled={attend <= 0}
                              className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center disabled:opacity-30">－</button>
                            <span className="text-lg font-bold text-gray-800 min-w-[20px] text-center">{attend}</span>
                            <button onClick={() => updateAttend(currentBill, gi, 1)}
                              className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center">＋</button>
                            <span className="text-xs text-gray-400">/ {max}人</span>
                          </div>
                        </div>
                        {diff < 0 && <div className="text-xs text-red-400 mt-1">⚠ {Math.abs(diff)}名不参加</div>}
                        {diff > 0 && <div className="text-xs text-[#2D5A27] mt-1">✓ {diff}名追加参加</div>}
                      </div>
                    );
                  })}
                </div>

                {/* 個別調整 */}
                <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                  <div className="text-xs text-gray-500 font-medium mb-2">個別調整（この件のみ）</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[['👑', '主役', 0, 'minus'], ['⏰', '遅刻', 1000, 'minus'], ['🚪', '早退', 1000, 'minus'], ['🧃', 'ノンアル', 1000, 'minus'], ['💳', '立て替え', 3000, 'plus']].map(([icon, r, a, s]) => (
                      <button key={r as string} onClick={() => updateBill(currentBill, 'adjs', [...bill.adjs, { reason: r as string, amount: a as number, sign: s as 'minus' | 'plus', gIdx: -1, cnt: 1 }])}
                        className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-[#F39C12] hover:text-[#F39C12]">
                        {icon} {r}
                      </button>
                    ))}
                  </div>
                  {bill.adjs.map((a, ai) => (
                    <div key={ai} className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-2">
                      <div className="flex gap-2 items-center mb-2">
                        <div className="flex rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 flex-shrink-0">
                          <button onClick={() => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], sign: 'minus' }; updateBill(currentBill, 'adjs', newAdjs); }}
                            className={`px-2.5 py-1.5 text-sm font-bold transition-all ${a.sign === 'minus' ? 'bg-red-500 text-white' : 'text-gray-400'}`}>－</button>
                          <button onClick={() => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], sign: 'plus' }; updateBill(currentBill, 'adjs', newAdjs); }}
                            className={`px-2.5 py-1.5 text-sm font-bold transition-all ${a.sign === 'plus' ? 'bg-[#2D5A27] text-white' : 'text-gray-400'}`}>＋</button>
                        </div>
                        <input type="text" placeholder="理由" value={a.reason}
                          onChange={e => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], reason: e.target.value }; updateBill(currentBill, 'adjs', newAdjs); }}
                          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 placeholder-gray-300 outline-none" />
                        <input type="number" placeholder="金額" value={a.amount || ''}
                          onChange={e => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], amount: Math.abs(parseInt(e.target.value) || 0) }; updateBill(currentBill, 'adjs', newAdjs); }}
                          className="w-16 border border-gray-200 rounded-lg px-1 py-1.5 text-sm text-gray-800 outline-none" />
                        <button onClick={() => updateBill(currentBill, 'adjs', bill.adjs.filter((_, j) => j !== ai))}
                          className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center">×</button>
                      </div>
                      <div className="flex gap-2">
                        <select value={a.gIdx} onChange={e => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], gIdx: parseInt(e.target.value) }; updateBill(currentBill, 'adjs', newAdjs); }}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 outline-none">
                          <option value={-1}>グループ選択</option>
                          {groups.map((g, gi) => <option key={gi} value={gi}>{g.name || PH[gi]}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <button disabled={a.cnt <= 1} onClick={() => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], cnt: a.cnt - 1 }; updateBill(currentBill, 'adjs', newAdjs); }}
                            className="w-7 h-7 border border-gray-200 rounded-md text-sm flex items-center justify-center disabled:opacity-30 bg-white">−</button>
                          <span className="text-sm font-medium w-5 text-center">{a.cnt}</span>
                          <button onClick={() => { const newAdjs = [...bill.adjs]; newAdjs[ai] = { ...newAdjs[ai], cnt: a.cnt + 1 }; updateBill(currentBill, 'adjs', newAdjs); }}
                            className="w-7 h-7 border border-gray-200 rounded-md text-sm flex items-center justify-center bg-white">＋</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => updateBill(currentBill, 'adjs', [...bill.adjs, { reason: '', amount: 0, sign: 'minus' as const, gIdx: -1, cnt: 1 }])}
                    className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-400 mt-1">
                    ＋ カスタム調整を追加
                  </button>
                </div>

                {/* ナビゲーション */}
                {currentBill < bills.length - 1 ? (
                  <button onClick={() => {
                    if (!isValid(bill.total)) { setTotalErr(true); return; }
                    updateBill(currentBill, 'calculated', true);
                    setCurrentBill(currentBill + 1);
                    setTotalErr(false);
                  }} style={{ backgroundColor: '#F39C12' }} className="w-full py-4 rounded-xl text-white text-lg font-bold">
                    {currentBill + 2}件目へ →
                  </button>
                ) : (
                  <button onClick={() => {
                    if (!isValid(bill.total)) { setTotalErr(true); return; }
                    updateBill(currentBill, 'calculated', true);
                    if (packOn && !packPaid) { setShowModal(true); return; }
                    calcAll();
                  }} style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white text-lg font-bold">
                    全件計算する 🍶
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* STEP 4: 結果 */}
      {step === 4 && calcResults.length > 0 && (
        <div className="p-4">
          <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4">← 入力に戻る</button>

          {/* 合計サマリー */}
          <div className="bg-[#2D5A27] rounded-xl p-4 mb-4 text-center">
            <div className="text-xs text-[#9dc99a] mb-1">今夜の合計（{billCount}件）</div>
            <div className="text-4xl font-bold text-white">¥{calcResults.reduce((s, r) => s + r.total, 0).toLocaleString()}</div>
            <div className="mt-2 flex flex-col gap-1">
              {calcResults.map((r, i) => (
                <div key={i} className="flex justify-between text-xs text-[#9dc99a]">
                  <span>{i + 1}件目{r.label ? ` ${r.label}` : ''}</span>
                  <span>¥{r.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* グループ別合計 */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">グループ別（一人あたり合計）</div>
            {groups.map((g, gi) => (
              <div key={gi} className="bg-white rounded-xl p-3 mb-2 shadow-sm">
                <div className="text-sm font-medium text-gray-800 mb-2">{gName(gi)}（最大{g.count}人・{(g.custom ? g.customVal : g.ratio).toFixed(1)}x）</div>
                <div className="text-2xl font-bold text-[#2D5A27] mb-1">
                  ¥{calcResults.reduce((s, r) => s + r.groups[gi].pp, 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mb-2">/ 人（全件合計）</div>
                <div className="border-t border-gray-100 pt-2">
                  {calcResults.map((r, bi) => (
                    <div key={bi} className="flex justify-between text-xs text-gray-400 py-0.5">
                      <span>{bi + 1}件目{r.label ? ` ${r.label}` : ''}（{r.groups[gi].attend}人参加）</span>
                      <span>¥{r.groups[gi].pp.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* LINEプレビュー */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">LINE メッセージプレビュー</div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex gap-2 mb-3">
                {(['polite', 'frank', 'list'] as const).map((t, i) => (
                  <button key={t} onClick={() => setLTpl(t)}
                    className={`px-3 py-1 rounded-full border-2 text-xs font-medium transition-all ${lTpl === t ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-200 text-gray-500'}`}>
                    {['丁寧', 'フランク', 'リストのみ'][i]}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">比率 (1.5x等) を表示</span>
                <div onClick={() => setTR(!tR)} className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${tR ? 'bg-[#2D5A27]' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${tR ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">システム料 (+500円) を表示</span>
                <div onClick={() => setTS(!tS)} className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${tS ? 'bg-[#2D5A27]' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${tS ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
              <div className="bg-[#f0f8ee] rounded-xl p-3 mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">{buildLP()}</div>
              <button onClick={() => navigator.clipboard.writeText(buildLP()).then(() => alert('コピーしました！'))}
                className="w-full mt-2 py-3 rounded-xl border border-[#2D5A27] text-[#2D5A27] text-sm font-medium">
                📋 割り勘メッセージをコピー
              </button>
            </div>
          </div>

          <button onClick={() => setStep(5)} style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white text-base font-bold">
            {packOn ? '集金チェックリストへ →' : '完了へ進む →'}
          </button>
        </div>
      )}

      {/* STEP 5: 集金 */}
      {step === 5 && (
        <div className="p-4">
          <button onClick={() => setStep(4)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4">← 結果に戻る</button>
          {(!packOn || !packPaid) ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔒</div>
              <div className="text-gray-400 leading-relaxed">集金チェックリストは<br />集金スムーズパックで利用できます</div>
              <button onClick={() => setStep(6)} style={{ backgroundColor: '#2D5A27' }} className="w-full mt-6 py-4 rounded-xl text-white font-bold">完了へ進む →</button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-medium mb-2">集金チェックリスト</div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <div onClick={() => setMembers(ms => ms.map((x, j) => j === i ? { ...x, paid: !x.paid } : x))}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs cursor-pointer flex-shrink-0 transition-all ${m.paid ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-300'}`}>
                        {m.paid && '✓'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400">{m.label}</div>
                        <input value={m.name} placeholder="名前を入力（任意）"
                          onChange={e => setMembers(ms => ms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          className="w-full text-sm text-gray-700 border-b border-gray-200 pb-0.5 outline-none focus:border-[#2D5A27] bg-transparent placeholder-gray-300" />
                      </div>
                      <div className="text-sm font-medium text-[#2D5A27] flex-shrink-0">¥{m.amount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-medium mb-2">未払いリマインド文</div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex gap-2 mb-3">
                    {(['mild', 'std', 'urgent'] as const).map((t, i) => (
                      <button key={t} onClick={() => setRTpl(t)}
                        className={`px-3 py-1 rounded-full border-2 text-xs font-medium transition-all ${rTpl === t ? 'bg-[#2D5A27] border-[#2D5A27] text-white' : 'border-gray-200 text-gray-500'}`}>
                        {['やんわり', '標準', '催促'][i]}
                      </button>
                    ))}
                  </div>
                  <div className="bg-[#fff8ee] rounded-xl p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      const up = members.filter(m => !m.paid);
                      if (!up.length) return '全員が支払い済みです🎉';
                      const ns = up.map(m => m.name || 'メンバー').join('・');
                      if (rTpl === 'mild') return `こんにちは！先日はありがとうございました🍶\nお手数ですが、${ns}さん、お会計のご確認をお願いできますか？😊`;
                      if (rTpl === 'std') return `お世話になります。先日の飲み会についてご連絡です。\n${ns}さん、まだご入金が確認できておりません。お早めにお振込みをお願いします🙏`;
                      return `【ご入金のお願い】\n${ns}さん、入金期限が迫っております。本日中にお振込みをお願いいたします。`;
                    })()}
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(6)} style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white font-bold">完了へ進む →</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: 完了 */}
      {step === 6 && (
        <div className="p-4">
          <div className="text-center py-6">
            <div className="text-7xl mb-3">🍶</div>
            <div className="text-xl font-bold text-[#2D5A27] mb-1">お疲れさまでした！</div>
            <div className="text-sm text-gray-400 mb-5">幹事さん、ありがとうございました🎉</div>
            <div className="bg-[#f0f8ee] border border-[#9dc99a] rounded-xl p-4 mb-4">
              <div className="text-3xl mb-2">📸</div>
              <div className="text-sm font-semibold text-[#2D5A27] mb-1">あの夜のお会計、覚えてる？</div>
              <div className="text-xs text-[#7aaa7a] mb-3 leading-relaxed">LINEでログインして写真と一緒に<br />飲み会の思い出を残しておこう</div>
              <button style={{ backgroundColor: '#2D5A27' }} className="text-white text-sm font-medium px-5 py-2 rounded-lg">LINEで記録する（無料）</button>
            </div>
            <div className="text-left mb-2">
              <div className="text-[10px] text-gray-300 mb-1"><span className="bg-gray-100 text-gray-300 text-[9px] px-1 rounded">Sponsored</span></div>
              <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 mb-2">
                <span className="text-2xl">🚕</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium">GO タクシー</div><div className="text-xs text-gray-400">今すぐ配車。アプリ不要でQRから呼べる。</div></div>
                <button style={{ backgroundColor: '#F39C12' }} className="text-white text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0">呼ぶ</button>
              </div>
              <div className="text-[10px] text-gray-300 mb-1"><span className="bg-gray-100 text-gray-300 text-[9px] px-1 rounded">Sponsored</span></div>
              <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 mb-4">
                <span className="text-2xl">🏮</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium">2次会を探す</div><div className="text-xs text-gray-400">ホットペッパーで近くのお店を予約。</div></div>
                <button style={{ backgroundColor: '#2D5A27' }} className="text-white text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0">探す</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigator.clipboard.writeText(buildLP()).then(() => alert('コピーしました！'))}
                style={{ backgroundColor: '#2D5A27' }} className="w-full py-3.5 rounded-xl text-white font-bold">📋 割り勘メッセージをコピー</button>
              <button onClick={restart} className="w-full py-3 rounded-xl border border-gray-300 text-gray-500 text-sm font-medium">↩ 最初からやり直す</button>
            </div>
          </div>
        </div>
      )}

      {/* フッター広告 */}
      {step !== 6 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-1.5 flex items-center gap-2 z-50">
          <span className="text-[9px] text-gray-300 flex-shrink-0">広告</span>
          <div className="flex-1 h-11 bg-gray-50 rounded-lg flex items-center justify-center text-xs text-gray-300 border border-dashed border-gray-200">Google AdSense</div>
        </div>
      )}

      {/* 決済モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl px-6 pt-7 pb-10 w-full">
            <div className="text-lg font-bold text-center mb-1">集金スムーズパック</div>
            <div className="text-sm text-gray-400 text-center mb-4">以下の機能が解放されます</div>
            <div className="text-4xl font-bold text-center text-[#2D5A27] mb-4">¥500</div>
            <div className="bg-gray-50 rounded-xl p-3 mb-5">
              {['集金チェックリスト', '未払いリマインド文生成（3段階）', 'PayPay送金リンク自動挿入'].map(f => (
                <div key={f} className="flex gap-2 text-sm text-gray-600 py-1"><span className="text-[#2D5A27] font-bold">✓</span>{f}</div>
              ))}
            </div>
            <button onClick={() => { setPackPaid(true); setShowModal(false); calcAll(); }}
              style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white text-base font-bold mb-2">
              ✓ Apple Pay / Google Pay で支払う
            </button>
            <button onClick={() => setShowModal(false)} className="w-full py-3 rounded-xl border border-gray-200 text-gray-400 text-sm">キャンセル</button>
          </div>
        </div>
      )}
    </main>
  );
}