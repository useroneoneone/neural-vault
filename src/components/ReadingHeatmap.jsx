import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildReadingHistory } from '../data/readingHistory';

export default function ReadingHeatmap({ activity, color }) {
  const history = useMemo(() => buildReadingHistory(activity), [activity]);
  const [hovered, setHovered] = useState(null);
  const tooltipId = useId();

  useEffect(() => {
    const hide = () => setHovered(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  const showDay = (event, day) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const below = rect.top < 80;
    setHovered({
      ...day,
      x: Math.max(80, Math.min(window.innerWidth - 80, rect.left + rect.width / 2)),
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2">
      <div className="mx-auto w-fit" role="group" aria-label="最近半年每日阅读足迹">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {Array.from({ length: history.leadingDays }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" className="h-[10px] w-[10px]" />)}
          {history.days.map((day) => (
            <button
              key={day.date}
              type="button"
              aria-label={`${day.date} · ${day.read ? '已阅读' : '未阅读'}`}
              aria-describedby={hovered?.date === day.date ? tooltipId : undefined}
              onPointerEnter={(event) => showDay(event, day)}
              onPointerLeave={(event) => { if (document.activeElement !== event.currentTarget) setHovered(null); }}
              onFocus={(event) => showDay(event, day)}
              onBlur={() => setHovered(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { setHovered(null); event.stopPropagation(); }
              }}
              className="h-[10px] w-[10px] cursor-help rounded-[2px] transition-[box-shadow] hover:ring-2 hover:ring-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              style={{ backgroundColor: day.read ? color : 'rgba(255,255,255,0.055)', opacity: day.read ? 0.3 + day.value * 0.7 : 1 }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9px] leading-none text-zinc-600">
          <span>{history.startDate.replaceAll('-', '.')}</span>
          <span>{history.endDate.replaceAll('-', '.')}</span>
        </div>
      </div>

      {hovered && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[60] min-w-[136px] rounded-lg border border-white/15 bg-[#131316] px-3 py-2 text-center shadow-xl"
          style={{ left: hovered.x, top: hovered.y, transform: hovered.below ? 'translateX(-50%)' : 'translate(-50%, -100%)' }}
        >
          <div className="font-mono text-[11px] text-zinc-200">{hovered.date}</div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[10.5px] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: hovered.read ? color : '#52525b' }} />
            {hovered.read ? '已阅读' : '未阅读'}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
