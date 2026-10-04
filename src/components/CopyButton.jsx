import { useEffect, useRef, useState } from 'react';
import { Check, Copy, AlertCircle } from 'lucide-react';
import { copyText } from '../utils/clipboard.js';

export default function CopyButton({ text, label = '内容', inline = false }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const request = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => {
    request.current?.abort();
    clearTimeout(timer.current);
  }, []);
  async function copy(event) {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(timer.current);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('copying');
    setError('');
    try {
      // Start within the click so both browser and host receive user activation.
      await copyText(text, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), 1800);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setError(failure.message || '复制失败，请重试。');
    }
  }
  const Icon = status === 'copied' ? Check : status === 'error' ? AlertCircle : Copy;
  const message = status === 'copied' ? '已复制' : status === 'copying' ? '复制中' : status === 'error' ? '重试' : '复制';
  return (
    <span className={inline ? 'note-copy-inline' : 'note-copy-action'}>
      <button type="button" onClick={copy} disabled={status === 'copying'} aria-label={`复制${label}`} title={error || `${message}${label}`}
        className={`note-copy-button ${status === 'copied' ? 'is-copied' : ''} ${status === 'error' ? 'is-error' : ''}`}>
        <Icon size={inline ? 11 : 12} />
        {!inline && <span>{message}</span>}
      </button>
      <span role="status" className="sr-only">{status === 'copied' ? `${label}已复制` : error}</span>
    </span>
  );
}
