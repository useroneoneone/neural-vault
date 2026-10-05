import { useState } from 'react';
import { FlaskConical, ChevronDown } from 'lucide-react';
import { createStressSnapshot } from '../data/vaultStressDemo.js';
import { DEMO_SNAPSHOT } from '../data/vaultDemo.js';
import { buildVault } from '../data/vaultAdapter.js';

export default function PreviewControls({ vault }) {
  const [open, setOpen] = useState(false);
  const choices = [
    ['大库 · 12 水母 / 472 笔记', () => createStressSnapshot()],
    ['更多目录 · 30 水母 / 562 笔记', () => createStressSnapshot({ extraRoots: 18 })],
    ['六类示例 · 18 笔记', () => DEMO_SNAPSHOT],
    ['空知识库', () => ({ vaultName: '空知识库 · 合成预览', records: [], folders: [] })],
    ['新增同类目录 · 01-项目', () => {
      const snapshot = createStressSnapshot();
      snapshot.folders.push('01-项目');
      snapshot.records.push({ path: '01-项目/独立项目.md', content: '# 独立项目\n这是新增的实际根目录，和“项目”分别显示。' });
      return snapshot;
    }],
  ];
  const choose = (makeSnapshot) => {
    const snapshot = makeSnapshot();
    const detail = { ...buildVault(snapshot.records, { folders: snapshot.folders, readingHistory: snapshot.readingHistory }), vaultName: snapshot.vaultName };
    window.dispatchEvent(new CustomEvent('neural-vault:update', { detail }));
    setOpen(false);
  };
  return (
    <div className="fixed bottom-[88px] left-5 z-30">
      {open && (
        <div className="glass mb-2 rounded-xl p-1.5">
          {choices.map(([label, make]) => <button key={label} type="button" onClick={() => choose(make)} className="block w-full rounded-lg px-3 py-2 text-left text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-100">{label}</button>)}
        </div>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="glass flex items-center gap-2 rounded-full px-3 py-2 text-[10px] text-zinc-500 hover:text-zinc-200">
        <FlaskConical size={12} /><span>合成预览 · {vault.categories.length} 水母 / {vault.notes.length} 笔记</span><ChevronDown size={11} />
      </button>
    </div>
  );
}
