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

const defaultGroups = (): Group[] => [
  { name: '', count: 5, countStr: '5', ratio: 1.5, custom: false, customVal: 1.0 },
  { name: '', count: 4, countStr: '4', ratio: 1.0, custom: false, customVal: 1.0 },
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [total, setTotal] = useState('');
  const [totalErr, setTotalErr] = useState(false);
  const [ru, setRu] = useState(100);
  const [packOn, setPackOn] = useState(false);
  const [packPaid, setPackPaid] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [groups, setGroups] = useState<Group[]>(defaultGroups());
  const [adjs, setAdjs] = useState<Adj[]>([]);
  const [lTpl, setLTpl] = useState<'polite' | 'frank' | 'list'>('polite');
  const [tR, setTR] = useState(false);
  const [tS, setTS] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [rTpl, setRTpl] = useState<'mild' | 'std' | 'urgent'>('mild');

  const isValid = (v: string) => /^[1-9][0-9]*$/.test(v.trim());
  const gName = (i: number) => groups[i]?.name || PH[i] || `グループ${i + 1}`;
  const getMax = (gIdx: number) => gIdx < 0 || !groups[gIdx] ? 99 : groups[gIdx].count;

  const updateGroupCount = (i: number, val: string) => {
    const num = parseInt(val);
    setGroups(gs => gs.map((x, j) => j === i ? {
      ...x,
      countStr: val,
      count: isNaN(num) || num < 1 ? 1 : num
    } : x));
  };

  const stepGroupCount = (i: number, delta: number) => {
    setGroups(gs => gs.map((x, j) => {
      if (j !== i) return x;
      const next = Math.max(1, x.count + delta);
      return { ...x, count: next, countStr: String(next) };
    }));
  };

  const runCalc = useCallback(() => {
    let t = parseInt(total);
    if (packOn) t += 500;
    const disc = adjs.filter(a => a.sign === 'minus').reduce((s, a) => s + a.amount * a.cnt, 0);
    const extr = adjs.filter(a => a.sign === 'plus').reduce((s, a) => s + a.amount * a.cnt, 0);
    const rem = t + disc - extr;
    const units = groups.reduce((s, g) => s + g.count * (g.custom ? g.customVal : g.ratio), 0);
    const base = units > 0 ? rem / units : 0;
    const gRes = groups.map(g => {
      const r = g.custom ? g.customVal : g.ratio;
      const ideal = r * base;
      const pp = Math.ceil(ideal / ru) * ru;
      return { ...g, r, pp, ideal };
    });
    const col = gRes.reduce((s, g) => s + g.pp * g.count, 0) + extr - disc;
    const cr = { groups: gRes, otsuri: Math.round(col - t), total: t, collected: Math.round(col) };
    setCalcResult(cr);

    const mbs: any[] = [];
    groups.forEach((g, gi) => {
      const gr = gRes[gi];
      const ah = adjs.filter(a => a.sign === 'minus' && a.gIdx === gi);
      const at = ah.reduce((s, a) => s + a.cnt, 0);
      for (let i = 0; i < Math.max(0, g.count - at); i++)
        mbs.push({ label: gName(gi), amount: gr.pp, name: '', paid: false });
      ah.forEach(a => {
        for (let i = 0; i < a.cnt; i++)
          mbs.push({ label: `${gName(gi)}（${a.reason}）`, amount: a.amount, name: '', paid: false, isAdj: true });
      });
    });
    adjs.filter(a => a.gIdx === -1 || a.sign === 'plus').forEach(a => {
      for (let i = 0; i < a.cnt; i++)
        mbs.push({ label: `${a.gIdx >= 0 ? gName(a.gIdx) : '個別'}（${a.reason}）`, amount: a.amount, name: '', paid: false, isAdj: true, sign: a.sign });
    });
    setMembers(mbs);
  }, [total, packOn, adjs, groups, ru]);

  const doCalc = () => {
    if (!isValid(total)) { setTotalErr(true); return; }
    if (packOn && !packPaid) { setShowModal(true); return; }
    runCalc();
    setStep(2);
  };

  const buildLP = () => {
    if (!calcResult) return '';
    const lines: string[] = [];
    calcResult.groups.forEach((g: any, i: number) => {
      const name = gName(i);
      const adjsHere = adjs.filter(a => a.sign === 'minus' && a.gIdx === i);
      const adjCount = adjsHere.reduce((s, a) => s + a.cnt, 0);
      const normalCount = Math.max(0, g.count - adjCount);
      const rs = tR ? ` (${g.r.toFixed(1)}x)` : '';
      if (normalCount > 0) lines.push(`${name}${rs}：¥${g.pp.toLocaleString()}（${normalCount}名）`);
      adjsHere.forEach(a => {
        const final = g.pp - a.amount;
        lines.push(`${name}・${a.reason}${rs}：¥${g.pp.toLocaleString()} - ¥${a.amount.toLocaleString()} = ¥${final.toLocaleString()}（${a.cnt}名）`);
      });
    });
    adjs.filter(a => a.gIdx === -1 || a.sign === 'plus').forEach(a => {
      if (a.sign === 'plus') lines.push(`${a.reason || '立て替え'}：+¥${a.amount.toLocaleString()}（${a.cnt}名）`);
      else lines.push(`${a.reason}：¥${a.amount.toLocaleString()}（${a.cnt}名）`);
    });
    if (tS && packOn) lines.push('※ システム利用料 ¥500 含む');
    const body = lines.join('\n');
    if (lTpl === 'polite') return `お疲れさまでした🍶\n本日はありがとうございました！\nお会計のご連絡です。\n\n${body}\n\nお釣り: ¥${calcResult.otsuri.toLocaleString()}\n\nご確認よろしくお願いします🙏`;
    if (lTpl === 'frank') return `今日もお疲れ〜🍶\n割り勘ね！\n\n${body}\n\nお釣り¥${calcResult.otsuri.toLocaleString()}は後で還元するよ！`;
    return body;
  };

  const gradCol = (pct: number) => {
    const p = Math.max(-15, Math.min(15, pct));
    if (Math.abs(p) < 0.5) return { fill: '#2D5A27', text: 'ぴったり ✓' };
    if (p > 0) {
      const t = Math.min(1, p / 10);
      return { fill: `rgb(${Math.round(45 + 210 * t)},${Math.round(90 * (1 - t))},${Math.round(39 * (1 - t))})`, text: `多め +${p.toFixed(1)}%` };
    }
    const t = Math.min(1, -p / 10);
    return { fill: `rgb(${Math.round(45 * (1 - t))},${Math.round(90 + 30 * t)},${Math.round(39 + 180 * t)})`, text: `少なめ ${p.toFixed(1)}%` };
  };

  const restart = () => {
    setStep(1); setTotal(''); setTotalErr(false); setRu(100);
    setPackOn(false); setPackPaid(false); setGroups(defaultGroups());
    setAdjs([]); setCalcResult(null); setMembers([]);
  };

  return (
    <main className="w-full max-w-full mx-auto bg-[#f5f5f0] min-h-screen pb-20">
      {/* Header */}
      <div className="bg-[#2D5A27] px-4 py-3 flex items-center gap-3">
        <span className="text-xl">🍶</span>
        <div>
          <div className="text-white font-bold text-lg tracking-widest">KEISHA</div>
          <div className="text-[#9dc99a] text-xs">傾斜割り勘計算ツール</div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex px-4 pt-2 bg-[#f5f5f0]">
        {['入力', '結果', '集金', '完了'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex-1 text-center">
              <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-medium
                ${step > i + 1 ? 'bg-[#9dc99a] text-white' : step === i + 1 ? 'bg-[#2D5A27] text-white' : 'bg-gray-300 text-gray-500'}`}>
                {i + 1}
              </div>
              <div className={`text-[10px] ${step === i + 1 ? 'text-[#2D5A27] font-medium' : 'text-gray-400'}`}>{label}</div>
            </div>
            {i < 3 && (
              <div className="flex-1 flex items-center pb-4">
                <div className="h-0.5 w-full bg-gray-200">
                  <div className="h-full bg-[#2D5A27] transition-all" style={{ width: step > i + 1 ? '100%' : '0%' }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="p-4">
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-1 tracking-wide">会計情報</div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">合計金額（円）</div>
              <input
                type="text" inputMode="numeric" placeholder="例：32000"
                value={total}
                onChange={e => { setTotal(e.target.value); setTotalErr(!isValid(e.target.value) && e.target.value !== ''); }}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none ${totalErr ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#2D5A27]'}`}
              />
              {totalErr && <div className="text-xs text-red-500 mt-1 px-2 py-1 bg-red-50 rounded border-l-2 border-red-400">半角数字のみ・先頭ゼロ不可・0より大きい整数を入力してください</div>}
              <div className="text-xs text-gray-400 mt-3 mb-1">端数の処理</div>
              <div className="flex rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100">
                {[100, 10, 1].map((u) => (
                  <button key={u} onClick={() => setRu(u)}
                    className={`flex-1 py-2 text-xs font-medium transition-all ${ru === u ? 'bg-[#2D5A27] text-white font-bold' : 'text-gray-500'}`}>
                    {u}円
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* パック */}
          <div className="mb-4 bg-[#fff8ee] border border-[#F39C12] rounded-xl p-4">
            <div className="flex items-center gap-3 cursor-pointer mb-2" onClick={() => setPackOn(!packOn)}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${packOn ? 'bg-[#F39C12] border-[#F39C12] text-white' : 'border-[#F39C12] bg-white'}`}>
                {packOn && '✓'}
              </div>
              <div className="text-sm font-medium text-gray-700">集金スムーズパック (+500円) を利用する</div>
            </div>
            <div className="text-xs text-[#b36b00] bg-[#fff3dc] rounded-lg px-3 py-2 mb-2 leading-relaxed">
              幹事の負担は0円！+500円は全員で均等に負担（1人数十円〜）されるよう自動計算されます。
            </div>
            {['集金チェックリスト（支払い状況を一覧管理）', '未払いリマインド文を自動生成', 'PayPay送金リンクをLINEに自動挿入'].map(f => (
              <div key={f} className="flex items-start gap-2 text-xs text-[#b36b00] leading-relaxed">
                <span className="text-[#F39C12] font-bold flex-shrink-0">✓</span>{f}
              </div>
            ))}
          </div>

          {/* グループ */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">グループ設定</div>
            {groups.map((g, i) => (
              <div key={i} className="bg-white rounded-xl p-3 mb-2 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <input value={g.name} placeholder={PH[i] || '例：グループ名'}
                    onChange={e => setGroups(gs => gs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-[#2D5A27]" />
                  <button onClick={() => setGroups(gs => gs.filter((_, j) => j !== i))}
                    className="w-7 h-7 rounded-full border border-gray-200 text-gray-400 text-sm flex items-center justify-center flex-shrink-0 hover:bg-red-50 hover:text-red-400">×</button>
                </div>
                {/* 人数 ±ボタン付き */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500 flex-shrink-0">人数</span>
                  <button onClick={() => stepGroupCount(i, -1)}
                    className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center flex-shrink-0 active:bg-gray-100">－</button>
                  <input
                    type="number" inputMode="numeric"
                    value={g.countStr}
                    onChange={e => updateGroupCount(i, e.target.value)}
                    onBlur={e => {
                      const num = parseInt(e.target.value);
                      const safe = isNaN(num) || num < 1 ? 1 : num;
                      setGroups(gs => gs.map((x, j) => j === i ? { ...x, count: safe, countStr: String(safe) } : x));
                    }}
                    className="w-14 border border-gray-200 rounded-lg text-center text-base text-gray-800 font-medium py-2 outline-none focus:border-[#2D5A27]" />
                  <button onClick={() => stepGroupCount(i, 1)}
                    className="w-9 h-9 rounded-lg border-2 border-gray-200 bg-white text-gray-600 text-lg font-bold flex items-center justify-center flex-shrink-0 active:bg-gray-100">＋</button>
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
              className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-400 hover:bg-gray-50">
              ＋ グループを追加
            </button>
          </div>

          {/* 個別調整 */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">個別調整（任意）</div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[['👑', '主役', 0, 'minus'], ['⏰', '遅刻', 1000, 'minus'], ['🚪', '早退', 1000, 'minus'], ['🧃', 'ノンアル', 1000, 'minus'], ['💳', '立て替え', 3000, 'plus']].map(([icon, r, a, s]) => (
                  <button key={r as string} onClick={() => setAdjs(as => [...as, { reason: r as string, amount: a as number, sign: s as 'minus' | 'plus', gIdx: -1, cnt: 1 }])}
                    className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-[#F39C12] hover:text-[#F39C12]">
                    {icon} {r}
                  </button>
                ))}
              </div>
              {adjs.map((a, i) => {
                const max = getMax(a.gIdx);
                return (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2">
                    <div className="flex gap-2 items-center mb-2">
                      <div className="flex rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-100 flex-shrink-0">
                        <button onClick={() => setAdjs(as => as.map((x, j) => j === i ? { ...x, sign: 'minus' } : x))}
                          className={`px-2.5 py-1.5 text-sm font-bold transition-all ${a.sign === 'minus' ? 'bg-red-500 text-white' : 'text-gray-400'}`}>－</button>
                        <button onClick={() => setAdjs(as => as.map((x, j) => j === i ? { ...x, sign: 'plus' } : x))}
                          className={`px-2.5 py-1.5 text-sm font-bold transition-all ${a.sign === 'plus' ? 'bg-[#2D5A27] text-white' : 'text-gray-400'}`}>＋</button>
                      </div>
                      <input type="text" placeholder="理由" value={a.reason}
                        onChange={e => setAdjs(as => as.map((x, j) => j === i ? { ...x, reason: e.target.value } : x))}
                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 placeholder-gray-300 outline-none focus:border-[#2D5A27]" />
                      <input type="number" placeholder="金額" value={a.amount || ''}
                        onChange={e => setAdjs(as => as.map((x, j) => j === i ? { ...x, amount: Math.abs(parseInt(e.target.value) || 0) } : x))}
                        className="w-16 flex-shrink-0 border border-gray-200 rounded-lg px-1 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D5A27]" />
                      <button onClick={() => setAdjs(as => as.filter((_, j) => j !== i))}
                        className="w-7 h-7 flex-shrink-0 rounded-full border border-gray-300 bg-white text-gray-400 text-sm flex items-center justify-center hover:bg-red-50 hover:text-red-400">×</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select value={a.gIdx} onChange={e => {
                        const gi = parseInt(e.target.value);
                        const newMax = gi < 0 ? 99 : groups[gi]?.count || 99;
                        setAdjs(as => as.map((x, j) => j === i ? { ...x, gIdx: gi, cnt: Math.min(x.cnt, newMax) } : x));
                      }} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 outline-none">
                        <option value={-1}>グループ選択</option>
                        {groups.map((g, gi) => <option key={gi} value={gi}>{g.name || PH[gi] || `グループ${gi + 1}`}</option>)}
                      </select>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button disabled={a.cnt <= 1} onClick={() => setAdjs(as => as.map((x, j) => j === i ? { ...x, cnt: x.cnt - 1 } : x))}
                          className="w-7 h-7 border border-gray-200 rounded-md text-sm flex items-center justify-center disabled:opacity-30 bg-white">−</button>
                        <span className="text-sm font-medium w-5 text-center text-gray-700">{a.cnt}</span>
                        <button disabled={a.gIdx >= 0 && a.cnt >= max} onClick={() => setAdjs(as => as.map((x, j) => j === i ? { ...x, cnt: x.cnt + 1 } : x))}
                          className="w-7 h-7 border border-gray-200 rounded-md text-sm flex items-center justify-center disabled:opacity-30 bg-white">＋</button>
                      </div>
                      {a.gIdx >= 0 && <span className="text-[10px] text-gray-400 flex-shrink-0">上限{max}人</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{a.sign === 'minus' ? '⬇ 割引' : '⬆ 回収'}</div>
                  </div>
                );
              })}
              <button onClick={() => setAdjs(as => [...as, { reason: '', amount: 0, sign: 'minus', gIdx: -1, cnt: 1 }])}
                className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-400 hover:bg-gray-50 mt-1">
                ＋ カスタム調整を追加
              </button>
            </div>
          </div>

          <button onClick={doCalc} style={{ backgroundColor: '#F39C12' }} className="w-full py-4 rounded-xl text-white text-lg font-bold">
            計算する！🍶
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && calcResult && (
        <div className="p-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4 hover:border-[#2D5A27] hover:text-[#2D5A27]">← 入力に戻る</button>
          <div className="bg-[#2D5A27] rounded-xl p-4 mb-4 text-center">
            <div className="text-xs text-[#9dc99a] mb-1">{calcResult.otsuri >= 0 ? 'お釣り（幹事が還元）' : '不足金額'}</div>
            <div className="text-4xl font-bold text-white">{calcResult.otsuri >= 0 ? '+' : '-'}¥{Math.abs(calcResult.otsuri).toLocaleString()}</div>
            <div className="text-xs text-[#9dc99a] mt-1">合計: ¥{calcResult.total.toLocaleString()} ／ 集金予定: ¥{calcResult.collected.toLocaleString()}</div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">グループ別金額</div>
            {calcResult.groups.map((g: any, i: number) => {
              const pct = g.ideal > 0 ? (g.pp - g.ideal) / g.ideal * 100 : 0;
              const c = gradCol(pct);
              const w = Math.abs(pct) < 0.5 ? 50 : pct > 0 ? Math.min(95, 50 + pct * 4) : Math.max(5, 50 + pct * 4);
              return (
                <div key={i} className="bg-white rounded-xl p-3 mb-2 shadow-sm">
                  <div className="text-sm font-medium text-gray-800 mb-2">{gName(i)}（{g.count}人・{g.r.toFixed(1)}x）</div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-2xl font-bold" style={{ color: '#2D5A27' }}>¥{g.pp.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">/ 人</div>
                    <div className="text-xs text-gray-500">計 ¥{(g.pp * g.count).toLocaleString()}</div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mb-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: c.fill }} />
                  </div>
                  <div className="text-xs font-medium mb-2" style={{ color: c.fill }}>{c.text}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const newGroups = [...calcResult.groups];
                      newGroups[i] = { ...newGroups[i], pp: newGroups[i].pp - ru };
                      const ex = adjs.filter(a => a.sign === 'plus').reduce((s, a) => s + a.amount * a.cnt, 0);
                      const di = adjs.filter(a => a.sign === 'minus').reduce((s, a) => s + a.amount * a.cnt, 0);
                      const col = newGroups.reduce((s, g) => s + g.pp * g.count, 0) + ex - di;
                      setCalcResult({ ...calcResult, groups: newGroups, collected: Math.round(col), otsuri: Math.round(col - calcResult.total) });
                    }} className="w-8 h-8 border border-[#2D5A27] text-[#2D5A27] rounded-lg flex items-center justify-center text-lg">－</button>
                    <span className="text-xs text-gray-500">{ru}円単位で調整</span>
                    <button onClick={() => {
                      const newGroups = [...calcResult.groups];
                      newGroups[i] = { ...newGroups[i], pp: newGroups[i].pp + ru };
                      const ex = adjs.filter(a => a.sign === 'plus').reduce((s, a) => s + a.amount * a.cnt, 0);
                      const di = adjs.filter(a => a.sign === 'minus').reduce((s, a) => s + a.amount * a.cnt, 0);
                      const col = newGroups.reduce((s, g) => s + g.pp * g.count, 0) + ex - di;
                      setCalcResult({ ...calcResult, groups: newGroups, collected: Math.round(col), otsuri: Math.round(col - calcResult.total) });
                    }} className="w-8 h-8 border border-[#2D5A27] text-[#2D5A27] rounded-lg flex items-center justify-center text-lg">＋</button>
                  </div>
                </div>
              );
            })}
          </div>

          {adjs.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">個別調整（反映済み）</div>
              {adjs.map((a, i) => (
                <div key={i} className="bg-white rounded-xl p-3 mb-2 shadow-sm">
                  <div className="text-sm font-medium text-gray-800">{a.reason || '調整'}{a.gIdx >= 0 ? ` (${gName(a.gIdx)}・${a.cnt}人)` : ''}</div>
                  <div className="text-xl font-bold mt-1" style={{ color: a.sign === 'minus' ? '#2980b9' : '#e74c3c' }}>
                    {a.sign === 'minus' ? '-' : '+'}¥{a.amount.toLocaleString()} × {a.cnt}人
                  </div>
                  <span className="inline-block bg-orange-50 text-orange-600 text-xs px-2 py-0.5 rounded mt-1">個別調整・反映済み ✓</span>
                </div>
              ))}
            </div>
          )}

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

          <button onClick={() => setStep(3)} style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white text-base font-bold">
            {packOn ? '集金チェックリストへ →' : '完了へ進む →'}
          </button>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="p-4">
          <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4 hover:border-[#2D5A27] hover:text-[#2D5A27]">← 結果に戻る</button>
          {(!packOn || !packPaid) ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔒</div>
              <div className="text-gray-400 leading-relaxed">集金チェックリストは<br />集金スムーズパックで利用できます</div>
              <button onClick={() => setStep(4)} style={{ backgroundColor: '#2D5A27' }} className="w-full mt-6 py-4 rounded-xl text-white font-bold">完了へ進む →</button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">集金チェックリスト</div>
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
                <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">未払いリマインド文</div>
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
                  <button onClick={() => {
                    const up = members.filter(m => !m.paid);
                    const ns = up.map(m => m.name || 'メンバー').join('・');
                    let t = '';
                    if (!up.length) t = '全員が支払い済みです🎉';
                    else if (rTpl === 'mild') t = `こんにちは！先日はありがとうございました🍶\nお手数ですが、${ns}さん、お会計のご確認をお願いできますか？😊`;
                    else if (rTpl === 'std') t = `お世話になります。先日の飲み会についてご連絡です。\n${ns}さん、まだご入金が確認できておりません。お早めにお振込みをお願いします🙏`;
                    else t = `【ご入金のお願い】\n${ns}さん、入金期限が迫っております。本日中にお振込みをお願いいたします。`;
                    navigator.clipboard.writeText(t).then(() => alert('コピーしました！'));
                  }} className="w-full mt-2 py-3 rounded-xl border border-[#2D5A27] text-[#2D5A27] text-sm font-medium">📋 コピー</button>
                </div>
              </div>
              <button onClick={() => setStep(4)} style={{ backgroundColor: '#2D5A27' }} className="w-full py-4 rounded-xl text-white font-bold">完了へ進む →</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="p-4">
          <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 mb-4 hover:border-[#2D5A27] hover:text-[#2D5A27]">← 戻る</button>
          <div className="text-center py-6">
            <div className="text-7xl mb-3">🍶</div>
            <div className="text-xl font-bold text-[#2D5A27] mb-1">お疲れさまでした！</div>
            <div className="text-sm text-gray-400 mb-5">幹事さん、ありがとうございました🎉</div>
            <div className="bg-[#f0f8ee] border border-[#9dc99a] rounded-xl p-4 mb-4 text-center">
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
      {step !== 4 && (
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
            <button onClick={() => { setPackPaid(true); setShowModal(false); runCalc(); setStep(2); }}
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