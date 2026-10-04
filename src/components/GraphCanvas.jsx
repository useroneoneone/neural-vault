import { useEffect, useRef } from 'react';
import { NeuralEngine } from '../engine/NeuralEngine';

/** Owns the two canvases and the engine instance. Never re-renders per frame. */
export default function GraphCanvas({ data, engineRef, labelRegistry, anchorRegistry, fpsRef, callbacks, viewState }) {
  const mainRef = useRef(null);
  const overlayRef = useRef(null);
  const stateRef = useRef(viewState);
  stateRef.current = viewState;

  useEffect(() => {
    const engine = new NeuralEngine(mainRef.current, overlayRef.current, data);
    engine.labelEls = labelRegistry.current;
    engine.anchorReg = anchorRegistry.current;
    engine.fpsEl = fpsRef.current;
    engineRef.current = engine;
    // Reapply the current view when a hot update recreates the canvas engine.
    const state = stateRef.current;
    engine.setMode(state.mode, state.catId, state.sidebarW);
    engine.setQuery(state.query);
    engine.setActive(state.activeId);
    engine.setPaused(state.paused);
    engine.setInsightFilter(state.insightFilter);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [data, engineRef, labelRegistry, anchorRegistry, fpsRef]);

  // keep callbacks fresh without recreating the engine
  useEffect(() => {
    if (engineRef.current) engineRef.current.callbacks = callbacks;
  });

  return (
    <>
      <canvas ref={mainRef} aria-label="知识图谱" className="fixed inset-0 z-0 block touch-none" />
      <canvas ref={overlayRef} className="pointer-events-none fixed inset-0 z-[25] block" />
    </>
  );
}
