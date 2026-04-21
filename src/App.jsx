import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, ErrorBar
} from 'recharts';
import { 
  Upload, FileText, Trash2, X,
  Settings2, BarChart3, Plus, Activity, Filter, HelpCircle, Edit3, Droplet, Download, Maximize2, CheckSquare, Square, MousePointer2, MoveHorizontal, ZoomIn, Palette, ShieldCheck, BookOpen, Layers
} from 'lucide-react';

/**
 * Contact Angle Master - 生产环境适配版
 * 修复了白屏、引用错误以及对象渲染报错
 */

// --- 1. 全局配置与常量 ---

const COLOR_PRESETS = [
  { name: 'Nature风格', sca: '#6366f1', aca: '#10b981', rca: '#f59e0b', cah: '#ec4899' },
  { name: '经典学术', sca: '#1e293b', aca: '#2563eb', rca: '#dc2626', cah: '#9333ea' },
  { name: '高对比度', sca: '#4f46e5', aca: '#059669', rca: '#7c3aed', cah: '#db2777' },
  { name: '柔和商务', sca: '#94a3b8', aca: '#64748b', rca: '#cbd5e1', cah: '#e2e8f0' }
];

const columnLetterToIndex = (letter) => {
  if (!letter || typeof letter !== 'string') return 7; 
  const upper = letter.toUpperCase();
  let res = 0;
  for (let i = 0; i < upper.length; i++) {
    res = res * 26 + (upper.charCodeAt(i) - 64);
  }
  return res - 1;
};

const getMedian = (arr) => {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const loadXLSX = () => {
  return new Promise((resolve) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => resolve(window.XLSX);
    document.head.appendChild(script);
  });
};

// --- 2. 纯展示子组件 ---

const AlgorithmFlowchart = () => (
  <svg viewBox="0 0 800 180" className="w-full h-auto my-6 drop-shadow-sm">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
      </marker>
    </defs>
    <rect x="10" y="60" width="100" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
    <text x="60" y="90" textAnchor="middle" className="text-[12px] font-bold fill-slate-600">数据导入</text>
    <line x1="110" y1="85" x2="150" y2="85" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
    <rect x="160" y="60" width="120" height="50" rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
    <text x="220" y="90" textAnchor="middle" className="text-[12px] font-bold fill-blue-600">0° 物理过滤</text>
    <line x1="280" y1="85" x2="320" y2="85" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
    <rect x="330" y="40" width="160" height="90" rx="12" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
    <text x="410" y="75" textAnchor="middle" className="text-[11px] font-bold fill-emerald-700">中位数窗口分段</text>
    <text x="410" y="95" textAnchor="middle" className="text-[9px] fill-emerald-600">(SCA → ACA → RCA)</text>
    <line x1="490" y1="85" x2="530" y2="85" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
    <rect x="540" y="60" width="120" height="50" rx="8" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
    <text x="600" y="90" textAnchor="middle" className="text-[11px] font-bold fill-orange-700">IQR 动态去噪</text>
    <line x1="660" y1="85" x2="700" y2="85" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
    <rect x="710" y="60" width="80" height="50" rx="8" fill="#fdf2f8" stroke="#ec4899" strokeWidth="2" />
    <text x="750" y="90" textAnchor="middle" className="text-[11px] font-bold fill-pink-700">结果统计</text>
  </svg>
);

const LabelWithTooltip = ({ label, tooltip }) => (
  <div className="flex items-center gap-1 mb-1.5 group relative">
    <label className="text-[11px] font-bold text-slate-600">{label}</label>
    <div className="cursor-help text-slate-300 hover:text-indigo-500 transition-colors">
      <HelpCircle size={12} />
    </div>
    <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[200] shadow-2xl border border-white/10 text-center leading-relaxed">
      {String(tooltip)}
      <div className="absolute top-full left-3 border-4 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

// --- 3. 主应用入口 ---

export default function App() {
  // --- 状态存储 ---
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [isFullscreenChart, setIsFullscreenChart] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [summaryMetrics, setSummaryMetrics] = useState({ sca: true, aca: true, rca: true, cah: true });
  const [visibleSampleIds, setVisibleSampleIds] = useState([]);

  const [chartColors, setChartColors] = useState({ sca: '#6366f1', aca: '#10b981', rca: '#f59e0b', cah: '#ec4899' });
  const [viewZoom, setViewZoom] = useState(100); 
  const [viewOffset, setViewOffset] = useState(0); 

  const [config, setConfig] = useState({
    staticCount: 3, 
    angleThreshold: 5, 
    windowSize: 3,     
    autoFilter: true,
    displayDensity: 1, 
    dataColumnLetter: 'H',
    outlierSensitivity: 4.5,
    exportPrecision: 2,
    exportSelection: { sca: true, aca: true, rca: true, cah: true }
  });

  // --- 核心算法逻辑 ---
  const runSegmentationPipeline = useCallback((points, currentConfig, overrides = {}, exclusions = []) => {
    if (!points || points.length === 0) return [];
    
    const data = points.map(pt => ({
      ...pt,
      isZero: (pt.value <= 1.0),
      isExcluded: exclusions.includes(pt.index),
      active: pt.value > 1.0 && !exclusions.includes(pt.index),
      isOutlier: false,
      isManual: !!overrides[pt.index]
    }));

    let currentType = 'ACA';
    let cycle = 0;
    const { windowSize, staticCount, angleThreshold } = currentConfig;

    const segmented = data.map((pt, i, arr) => {
      let type = currentType;
      if (overrides[pt.index]) {
        type = overrides[pt.index];
        currentType = type;
        if (type === 'ACA') cycle++;
      } else if (i < staticCount) {
        type = 'SCA';
        currentType = 'ACA'; 
      } else if (pt.active) {
        const futurePoints = [];
        for (let j = i + 1; j < arr.length && futurePoints.length < windowSize; j++) {
          if (arr[j].active) futurePoints.push(arr[j].value);
        }
        const pastPoints = [];
        for (let j = i - 1; j >= 0 && pastPoints.length < windowSize; j--) {
          if (arr[j].active) pastPoints.push(arr[j].value);
        }

        if (futurePoints.length === windowSize && pastPoints.length > 0) {
          const futureMed = getMedian(futurePoints);
          const pastMed = getMedian(pastPoints);
          
          if (currentType === 'ACA') {
            if ((pastMed - futureMed > angleThreshold) && (pt.value - futureMed < angleThreshold * 0.8)) {
              type = 'RCA';
              currentType = 'RCA';
            }
          } else if (currentType === 'RCA') {
            if ((futureMed - pastMed > angleThreshold) && (futureMed - pt.value < angleThreshold * 0.8)) {
              type = 'ACA';
              currentType = 'ACA';
              cycle++; 
            }
          }
        }
        type = currentType;
      }
      return { ...pt, type, cycle: type === 'SCA' ? -1 : cycle };
    });

    if (currentConfig.autoFilter) {
      ['SCA', 'ACA', 'RCA'].forEach(t => {
        const seg = segmented.filter(d => d.type === t && d.active);
        if (seg.length < 5) return;
        const vals = seg.map(d => d.value).sort((a,b)=>a-b);
        const q1 = vals[Math.floor(vals.length*0.25)], q3 = vals[Math.floor(vals.length*0.75)];
        const iqr = q3 - q1;
        const k = currentConfig.outlierSensitivity;
        const lb = q1 - k * iqr, ub = q3 + k * iqr;
        segmented.forEach(d => { if(d.type === t && d.active && !d.isManual) d.isOutlier = (d.value < lb || d.value > ub); });
      });
    }
    return segmented;
  }, []);

  // --- 数据统计推导 ---
  const stats = useMemo(() => {
    if (!samples.length) return [];
    return samples.map(s => {
      const calc = (type) => {
        const pts = s.data.filter(d => d.type === type);
        const valid = pts.filter(d => d.active && !d.isOutlier);
        if (valid.length === 0) return { avg: 0, std: 0, count: 0, total: pts.length };
        const avg = valid.reduce((a, b) => a + b.value, 0) / valid.length;
        const std = Math.sqrt(valid.reduce((a, b) => a + Math.pow(b.value - avg, 2), 0) / valid.length);
        return { avg: Number(avg), std: Number(std), count: valid.length, total: type === 'SCA' ? config.staticCount : pts.length };
      };
      const sca = calc('SCA'), aca = calc('ACA'), rca = calc('RCA');
      const cycleIds = [...new Set(s.data.map(d => d.cycle))].filter(c => c >= 0);
      const hysList = cycleIds.map(cId => {
        const ap = s.data.filter(d => d.cycle === cId && d.type === 'ACA' && d.active && !d.isOutlier);
        const rp = s.data.filter(d => d.cycle === cId && d.type === 'RCA' && d.active && !d.isOutlier);
        if (ap.length && rp.length) return (ap.reduce((a,b)=>a+b.value,0)/ap.length) - (rp.reduce((a,b)=>a+b.value,0)/rp.length);
        return null;
      }).filter(v => v !== null);
      const hAvg = hysList.length ? hysList.reduce((a,b)=>a+b,0)/hysList.length : 0;
      const hStd = hysList.length ? Math.sqrt(hysList.reduce((a,b)=>a+Math.pow(b-hAvg,2),0)/hysList.length) : 0;
      return { 
        ...s, 
        sca, aca, rca, 
        cah: { avg: hAvg, std: hStd, count: hysList.length }, 
        scaAvg: sca.avg, scaStd: sca.std, 
        acaAvg: aca.avg, acaStd: aca.std, 
        rcaAvg: rca.avg, rcaStd: rca.std, 
        cahAvg: hAvg, cahStd: hStd 
      };
    });
  }, [samples, config.staticCount]);

  const activeSample = useMemo(() => samples.find(s => s.id === activeSampleId) || null, [samples, activeSampleId]);
  const activeStats = useMemo(() => stats.find(s => s.id === activeSampleId) || null, [stats, activeSampleId]);
  const filteredSummaryStats = useMemo(() => stats.filter(s => visibleSampleIds.includes(s.id)), [stats, visibleSampleIds]);

  const windowedData = useMemo(() => {
    if (!activeSample || !activeSample.data) return [];
    const full = activeSample.data;
    const size = Math.max(5, Math.floor(full.length * (viewZoom / 100)));
    const start = Math.floor((full.length - size) * (viewOffset / 100));
    return full.slice(start, start + size).filter((_, i) => i % config.displayDensity === 0);
  }, [activeSample, viewZoom, viewOffset, config.displayDensity]);

  // --- 事件处理 ---
  const handleFileUpload = useCallback(async (e) => {
    if (!libLoaded || !window.XLSX) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
          const dIdx = columnLetterToIndex(config.dataColumnLetter);
          const pts = raw.slice(1).map((row, i) => {
            const v = parseFloat(row[dIdx]);
            return { index: i, value: isNaN(v) ? null : v };
          }).filter(pt => pt.value !== null);
          if (pts.length === 0) return;
          const finalData = runSegmentationPipeline(pts, config);
          const newId = Math.random().toString(36).substr(2, 9);
          setSamples(prev => [...prev, { id: newId, name: file.name.split('.')[0], data: finalData, liquid: '水 (Water)', overrides: {}, exclusions: [] }]);
          setVisibleSampleIds(prev => [...prev, newId]);
          setActiveSampleId(newId);
          setViewZoom(100); setViewOffset(0);
        } catch (err) { console.error(err); }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = null;
  }, [libLoaded, config, runSegmentationPipeline]);

  const handlePointAction = useCallback((action, index) => {
    setSamples(prev => prev.map(s => {
      if (s.id !== activeSampleId) return s;
      let newOverrides = { ...(s.overrides || {}) }, newExclusions = [...(s.exclusions || [])];
      if (action === 'ACA' || action === 'RCA') newOverrides[index] = action;
      else if (action === 'TOGGLE_NOISE') {
        if (newExclusions.includes(index)) newExclusions = newExclusions.filter(i => i !== index);
        else newExclusions.push(index);
      }
      const rawPoints = s.data.map(d => ({ index: d.index, value: d.value }));
      return { ...s, overrides: newOverrides, exclusions: newExclusions, data: runSegmentationPipeline(rawPoints, config, newOverrides, newExclusions) };
    }));
  }, [activeSampleId, config, runSegmentationPipeline]);

  const exportExcel = useCallback(() => {
    if (!window.XLSX || stats.length === 0) return;
    const p = config.exportPrecision;
    const data = stats.map(s => {
      const row = { "样品名": s.name, "液体介质": s.liquid };
      if (config.exportSelection.sca) { row["静态接触角(°)"] = Number(s.scaAvg || 0).toFixed(p); row["SCA偏差"] = Number(s.scaStd || 0).toFixed(p); }
      if (config.exportSelection.aca) { row["前进角(°)"] = Number(s.acaAvg || 0).toFixed(p); row["ACA偏差"] = Number(s.acaStd || 0).toFixed(p); }
      if (config.exportSelection.rca) { row["后退角(°)"] = Number(s.rcaAvg || 0).toFixed(p); row["RCA偏差"] = Number(s.rcaStd || 0).toFixed(p); }
      if (config.exportSelection.cah) { row["接触角滞后(°)"] = Number(s.cahAvg || 0).toFixed(p); row["CAH偏差"] = Number(s.cahStd || 0).toFixed(p); }
      return row;
    });
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Result");
    window.XLSX.writeFile(wb, `Batch_CA_Report.xlsx`);
  }, [stats, config]);

  // --- 4. 生命周期管理 ---
  useEffect(() => {
    loadXLSX().then(() => setLibLoaded(true));
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (samples.length === 0) return;
    setSamples(prev => prev.map(s => {
      const rawPts = s.data.map(d => ({ index: d.index, value: d.value }));
      return { ...s, data: runSegmentationPipeline(rawPts, config, s.overrides, s.exclusions) };
    }));
  }, [config.staticCount, config.angleThreshold, config.windowSize, config.autoFilter, config.dataColumnLetter, config.outlierSensitivity]);

  // --- 5. 汇总图表组件 ---
  const SummaryChart = ({ isLarge = false }) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filteredSummaryStats} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" fontSize={isLarge ? 14 : 11} fontWeight="black" tickLine={false} axisLine={false} stroke="#94a3b8" />
        <YAxis domain={[0, 'auto']} fontSize={isLarge ? 12 : 10} width={30} tickLine={false} axisLine={false} stroke="#94a3b8" />
        <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}°`, "角度"]} contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontSize: isLarge ? '14px' : '11px', fontWeight: 'bold'}} cursor={{fill: '#f1f5f9', radius: 10}} />
        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: isLarge ? '14px' : '10px', fontWeight: 'bold'}} />
        {summaryMetrics.sca && <Bar key="sum-sca" dataKey="scaAvg" name="静态角 SCA" fill={chartColors.sca} barSize={isLarge ? 40 : 20} radius={[6, 6, 0, 0]}><ErrorBar dataKey="scaStd" width={4} strokeWidth={2} stroke="#333" /></Bar>}
        {summaryMetrics.aca && <Bar key="sum-aca" dataKey="acaAvg" name="前进角 ACA" fill={chartColors.aca} barSize={isLarge ? 40 : 20} radius={[6, 6, 0, 0]}><ErrorBar dataKey="acaStd" width={4} strokeWidth={2} stroke="#333" /></Bar>}
        {summaryMetrics.rca && <Bar key="sum-rca" dataKey="rcaAvg" name="后退角 RCA" fill={chartColors.rca} barSize={isLarge ? 40 : 20} radius={[6, 6, 0, 0]}><ErrorBar dataKey="rcaStd" width={4} strokeWidth={2} stroke="#333" /></Bar>}
        {summaryMetrics.cah && <Bar key="sum-cah" dataKey="cahAvg" name="接触角滞后 CAH" fill={chartColors.cah} barSize={isLarge ? 40 : 20} radius={[6, 6, 0, 0]}><ErrorBar dataKey="cahStd" width={4} strokeWidth={2} stroke="#333" /></Bar>}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <datalist id="liquid-options">
        <option value="水 (Water)" /><option value="乙醇 (Ethanol)" /><option value="正十六烷 (n-Hexadecane)" />
      </datalist>

      {showHelp && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/90 backdrop-blur-md p-6 md:p-12 overflow-y-auto flex flex-col items-center">
          <div className="w-full max-w-4xl bg-white rounded-[3rem] p-10 relative shadow-2xl">
            <button onClick={() => setShowHelp(false)} className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"><X size={20}/></button>
            <div className="flex items-center gap-3 mb-8">
               <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100"><BookOpen size={24}/></div>
               <div><h2 className="text-2xl font-black text-slate-900 uppercase">Contact Angle Master 算法指南</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Metrology Logic & Usage</p></div>
            </div>
            <section className="mb-12 border-b border-slate-100 pb-8">
              <h3 className="text-sm font-black text-indigo-900 mb-4 flex items-center gap-2 tracking-widest uppercase"><ShieldCheck size={18}/> 1. 数据处理流程</h3>
              <AlgorithmFlowchart />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><p className="text-[11px] font-black text-slate-400 uppercase mb-2">物理预清洗</p><p className="text-[12px] leading-relaxed text-slate-600 font-medium">自动屏蔽 ≤ 1.0° 的点，防止拟合错误干扰识别窗口。</p></div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><p className="text-[11px] font-black text-slate-400 uppercase mb-2">极值去噪</p><p className="text-[12px] leading-relaxed text-slate-600 font-medium">使用 4分位距算法。手动标记点将豁免此检测逻辑。</p></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {isFullscreenChart && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-xl p-8 flex flex-col">
          <div className="flex justify-between items-center mb-8 text-white text-2xl font-black uppercase">汇总对比视图<button onClick={() => setIsFullscreenChart(false)} className="bg-white/10 hover:bg-red-500 p-3 rounded-2xl shadow-xl"><X size={24}/></button></div>
          <div className="flex-1 w-full bg-white rounded-[3.5rem] p-12 shadow-2xl overflow-hidden">
            <SummaryChart isLarge={true} />
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="fixed z-[999] bg-slate-900 text-white shadow-2xl rounded-2xl py-1 text-xs font-bold w-52 border border-white/10" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-2 border-b border-white/5 text-[9px] text-slate-400 uppercase italic">Point: #{contextMenu.pointIndex}</div>
          <button onClick={() => { handlePointAction('ACA', contextMenu.pointIndex); setContextMenu(null); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-emerald-400 flex items-center justify-between">设为 ACA 起点 <Activity size={12}/></button>
          <button onClick={() => { handlePointAction('RCA', contextMenu.pointIndex); setContextMenu(null); }} className="w-full text-left px-4 py-3 hover:bg-white/10 text-orange-400 flex items-center justify-between border-b border-white/5">设为 RCA 起点 <Activity size={12}/></button>
          <button onClick={() => { handlePointAction('TOGGLE_NOISE', contextMenu.pointIndex); setContextMenu(null); }} className="w-full text-left px-4 py-3 hover:bg-red-500 text-white flex items-center justify-between uppercase tracking-tighter">标记噪点 / 恢复 <Filter size={12}/></button>
        </div>
      )}

      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-indigo-950 flex items-center gap-2 tracking-tighter uppercase"><Activity className="text-indigo-600" /> Contact Angle Master</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Professional Wetting Metrology Engine</p>
          </div>
          <button onClick={() => setShowHelp(true)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm group">
             <BookOpen size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>
        <div className="flex gap-3">
            <button onClick={exportExcel} disabled={!samples.length} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-emerald-100 text-[10px] font-black uppercase flex items-center gap-2">
              <Download size={14} /> 导出 EXCEL 报表
            </button>
            <label className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl cursor-pointer transition shadow-lg shadow-indigo-200 ${!libLoaded && 'opacity-50'}`}>
                <Plus size={14} /> <span className="text-[10px] font-black uppercase">导入测量数据</span>
                <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!libLoaded} />
            </label>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm max-h-[350px] overflow-hidden flex flex-col">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> 样品队列 ({samples.length})</h2>
            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {samples.map(s => (
                <div key={s.id} onClick={() => setActiveSampleId(s.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group ${activeSampleId === s.id ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-50' : 'bg-white border-slate-50 hover:border-slate-200'}`}>
                  <div className="min-w-0 font-black uppercase"><p className="text-xs truncate">{s.name}</p><p className="text-[9px] text-slate-400 italic mt-1">{s.liquid}</p></div>
                  <button onClick={(e) => {e.stopPropagation(); setSamples(prev => prev.filter(x => x.id !== s.id));}} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                </div>
              ))}
              {!samples.length && <div className="py-8 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">请导入文件</div>}
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Settings2 size={14} /> 算法与同步配置</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                  <LabelWithTooltip label="数据列标" tooltip="数值所在的Excel列（如H）。" />
                  <input type="text" value={config.dataColumnLetter} onChange={e => setConfig({...config, dataColumnLetter: e.target.value.toUpperCase()})} className="w-full bg-transparent border-0 text-center font-black text-sm uppercase focus:ring-0 outline-none" />
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                  <LabelWithTooltip label="静态点数" tooltip="强制前N个有效点定为SCA阶段。" />
                  <input type="number" min="0" value={config.staticCount} onChange={e => setConfig({...config, staticCount: Math.max(0, parseInt(e.target.value) || 0)})} className="w-full bg-transparent border-0 text-center font-black text-sm focus:ring-0 outline-none" />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <LabelWithTooltip label="判定窗口点数" tooltip="中位数判定窗口大小。建议 3-5。" />
                <input type="number" min="1" value={config.windowSize} onChange={e => setConfig({...config, windowSize: Math.max(1, parseInt(e.target.value) || 1)})} className="w-full bg-transparent border-0 text-center font-black text-sm outline-none" />
              </div>

              <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
                <div className="flex justify-between items-center mb-2">
                  <LabelWithTooltip label="去噪容忍度" tooltip="调高此值允许大跳变。默认4.5x。" />
                  <span className="text-[10px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">{config.outlierSensitivity.toFixed(1)}x</span>
                </div>
                <input type="range" min="1.5" max="15.0" step="0.5" value={config.outlierSensitivity} onChange={e => setConfig({...config, outlierSensitivity: parseFloat(e.target.value)})} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-600 cursor-pointer" />
              </div>

              <div className="p-5 bg-slate-50/80 rounded-[2rem] border border-slate-100 shadow-inner">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Download size={14}/> 报表导出设置</h3>
                 <div className="grid grid-cols-2 gap-2 mb-4">
                   {[{id:'sca',l:'SCA'},{id:'aca',l:'ACA'},{id:'rca',l:'RCA'},{id:'cah',l:'CAH'}].map(it => (
                     <div key={it.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer shadow-sm" onClick={() => setConfig({...config, exportSelection: {...config.exportSelection, [it.id]: !config.exportSelection[it.id]}})}>
                        {config.exportSelection[it.id] ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-300" />}
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{it.l}</span>
                     </div>
                   ))}
                 </div>
                 <div>
                   <LabelWithTooltip label="导出数据精度" tooltip="Excel报表的小数位数。" />
                   <select value={config.exportPrecision} onChange={e => setConfig({...config, exportPrecision: parseInt(e.target.value)})} className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-black cursor-pointer outline-none shadow-sm">
                     <option value={1}>1位小数</option><option value={2}>2位小数</option><option value={3}>3位小数</option><option value={4}>4位小数</option>
                   </select>
                 </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={14}/> 界面配色管理</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {COLOR_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => setChartColors({ sca: p.sca, aca: p.aca, rca: p.rca, cah: p.cah })} className="text-[9px] font-bold px-2 py-1 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 transition-all hover:shadow-sm">
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {[{k:'sca',l:'静态角',c:chartColors.sca},{k:'aca',l:'前进角',c:chartColors.aca},{k:'rca',l:'后退角',c:chartColors.rca},{k:'cah',l:'滞后值',c:chartColors.cah}].map(item => (
                    <div key={item.k} className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600">{item.l}</span>
                      <input type="color" value={item.c} onChange={e => setChartColors({...chartColors,[item.k]:e.target.value})} className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {activeSample && activeStats ? (
            <>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-2 shadow-inner">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Edit3 size={12}/> 样品显示名</label>
                  <input type="text" value={activeSample.name} onChange={e => setSamples(prev => prev.map(s => s.id === activeSample.id ? {...s, name: e.target.value} : s))} className="bg-transparent border-0 font-black text-slate-800 text-sm focus:ring-0 outline-none" />
                </div>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-2 shadow-inner">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Droplet size={12}/> 测试液体</label>
                  <input type="text" list="liquid-options" value={activeSample.liquid} onChange={e => setSamples(prev => prev.map(s => s.id === activeSample.id ? {...s, liquid: e.target.value} : s))} className="bg-transparent border-0 font-black text-slate-800 text-sm focus:ring-0 outline-none" />
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="font-black text-slate-900 text-lg tracking-tighter uppercase">测量曲线分析</h3>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase"><MousePointer2 size={10} className="inline mr-1"/> 右键强制修正分段 | 自动屏蔽 0° 噪点</p>
                  </div>
                  <div className="flex gap-4 text-[9px] font-black uppercase bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-inner">
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: chartColors.sca}}></div> SCA</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: chartColors.aca}}></div> ACA</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: chartColors.rca}}></div> RCA</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> 噪点</span>
                  </div>
                </div>
                <div className="h-[400px] w-full mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={windowedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="index" hide />
                      <YAxis domain={['auto', 'auto']} fontSize={11} width={30} stroke="#cbd5e1" />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-2xl text-[10px] min-w-[140px] border border-white/10">
                              <div className="flex justify-between font-black text-indigo-400 mb-2 border-b border-white/5 pb-2 uppercase tracking-tighter"><span>{d.type} 段</span><span>#{d.index}</span></div>
                              <p className={`text-2xl font-black mb-1 ${d.isZero ? 'text-red-400' : 'text-white'}`}>{Number(d.value).toFixed(2)}°</p>
                              <p className="text-white/40 font-bold mt-2 pt-2 border-t border-white/5 tracking-widest italic uppercase text-[8px]">Right-Click to Edit</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Line type="monotone" dataKey="value" stroke="#e2e8f0" strokeWidth={2} dot={(props) => {
                          const { cx, cy, payload } = props;
                          let fill = "#6366f1"; 
                          if (payload.type === 'SCA') fill = chartColors.sca;
                          if (payload.type === 'ACA') fill = chartColors.aca;
                          if (payload.type === 'RCA') fill = chartColors.rca;
                          if (!payload.active || payload.isZero || (config.autoFilter && payload.isOutlier)) fill = "#f87171";
                          return (
                            <circle key={`pt-f-${payload.index}`} cx={cx} cy={cy} r={payload.isManual ? 5 : 3.5} fill={fill} stroke={payload.isManual ? "#000" : "#fff"} strokeWidth={payload.isManual ? 2 : 0.5} className="cursor-pointer transition-all hover:scale-150"
                              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, pointIndex: payload.index }); }} />
                          );
                        }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-5 pt-8 border-t border-slate-50"><div className="flex items-center gap-6"><div className="w-24 shrink-0 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><ZoomIn size={14}/> 范围缩放</div><input type="range" min="1" max="100" value={viewZoom} onChange={e => setViewZoom(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-indigo-600" /><span className="w-12 text-right font-black text-xs text-indigo-600">{viewZoom}%</span></div><div className="flex items-center gap-6"><div className="w-24 shrink-0 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><MoveHorizontal size={14}/> 视窗平移</div><input type="range" min="0" max="100" value={viewOffset} onChange={e => setViewOffset(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-slate-400" /><span className="w-12 text-right font-black text-xs text-slate-400">{viewOffset}%</span></div></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id:'sca', label:'静态接触角 (SCA)', res:activeStats.sca, customColor:chartColors.sca, bg:'bg-indigo-50' },
                  { id:'aca', label:'前进接触角 (ACA)', res:activeStats.aca, customColor:chartColors.aca, bg:'bg-emerald-50' },
                  { id:'rca', label:'后退接触角 (RCA)', res:activeStats.rca, customColor:chartColors.rca, bg:'bg-orange-50' },
                  { id:'cah', label:'接触角滞后 (CAH)', res:activeStats.cah, customColor:chartColors.cah, bg:'bg-pink-50' }
                ].map((item) => (
                  <div key={`card-f-${item.id}`} className={`${item.bg} p-6 rounded-[2.5rem] border border-white shadow-sm relative overflow-hidden transition-all hover:scale-[1.03]`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{item.label}</p>
                    <p className="text-2xl font-black relative z-10" style={{ color: item.customColor || undefined }}>{Number(item.res?.avg || 0).toFixed(config.exportPrecision)}°</p>
                    <div className="mt-2 flex justify-between items-center relative z-10 border-t border-white/50 pt-2 text-[9px] font-black text-slate-400 uppercase">
                      <span>± {Number(item.res?.std || 0).toFixed(config.exportPrecision)}</span>
                      <span title={`有效点数/分段总点数`}>n={item.res?.count || 0}/{item.res?.total || 0}</span>
                    </div>
                  </div>
                ))}
              </div>

              {stats.length > 1 && (
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden font-black">
                  <div className="flex flex-col gap-6 mb-8">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-indigo-500"/>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800">多样品统计对比汇总</h3>
                      </div>
                      <button onClick={() => setIsFullscreenChart(true)} className="bg-slate-50 p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"><Maximize2 size={16} /></button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-2"><Layers size={12}/> 类型勾选:</span>
                        {[
                          {id:'sca', l:'SCA', c:chartColors.sca},
                          {id:'aca', l:'ACA', c:chartColors.aca},
                          {id:'rca', l:'RCA', c:chartColors.rca},
                          {id:'cah', l:'CAH', c:chartColors.cah}
                        ].map(m => (
                          <button key={m.id} onClick={() => setSummaryMetrics({...summaryMetrics, [m.id]: !summaryMetrics[m.id]})} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border-2 ${summaryMetrics[m.id] ? 'bg-white shadow-sm' : 'bg-slate-50 text-slate-300 border-transparent'}`} style={{borderColor: summaryMetrics[m.id] ? m.c : 'transparent', color: summaryMetrics[m.id] ? m.c : undefined}}>
                            {summaryMetrics[m.id] ? <CheckSquare size={12}/> : <Square size={12}/>} {m.l}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-dashed border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-2"><FileText size={12}/> 样品勾选:</span>
                        {samples.map(s => (
                          <button key={s.id} onClick={() => setVisibleSampleIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 border ${visibleSampleIds.includes(s.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                            {visibleSampleIds.includes(s.id) ? <CheckSquare size={12}/> : <Square size={12}/>} {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <SummaryChart />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-16 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="bg-slate-100 p-6 rounded-3xl mb-6"><FileText size={32} className="text-slate-400" /></div>
              <h3 className="text-lg font-black text-slate-900 uppercase mb-2">未选择样品</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest max-w-md">请从左侧样品队列中选择一个样品，或点击右上角的「导入测量数据」按钮添加新样品。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}