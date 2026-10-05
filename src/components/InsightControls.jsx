import { Maximize2, Minus, Plus } from 'lucide-react';

export default function InsightControls({ engineRef }) {
  return (
    <div className="glass fixed bottom-[90px] right-5 z-30 flex items-center gap-1 rounded-full p-1">
      <button type="button" aria-label="缩小洞察图谱" title="缩小" onClick={() => engineRef.current?.zoomInsight?.(1 / 1.25)} className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"><Minus size={14} /></button>
      <button type="button" aria-label="适应洞察图谱" title="适应全图" onClick={() => engineRef.current?.resetInsightCamera?.()} className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"><Maximize2 size={13} /></button>
      <button type="button" aria-label="放大洞察图谱" title="放大" onClick={() => engineRef.current?.zoomInsight?.(1.25)} className="rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"><Plus size={14} /></button>
    </div>
  );
}
