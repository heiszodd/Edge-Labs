import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart } from 'lightweight-charts';
import { getOHLCV } from '../../api/perps';

export default function CandlestickChart({ defaultPair = 'BTCUSDT', defaultTf = '1h', height = 384, onUseCandle }) {
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const containerRef = useRef(null);
  const candlesRef = useRef([]);
  const [pair, setPair] = useState(defaultPair);
  const [tf, setTf] = useState(defaultTf);
  const [selectedCandle, setSelectedCandle] = useState(null);

  useEffect(() => {
    if (defaultPair) setPair(String(defaultPair).toUpperCase());
  }, [defaultPair]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ohlcv', pair, tf],
    queryFn: () => getOHLCV(pair, tf, 200),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      width: containerRef.current.clientWidth,
      layout: { background: { color: 'transparent' }, textColor: '#a8a396' },
      grid: { vertLines: { color: '#27272a' }, horzLines: { color: '#27272a' } },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    chart.subscribeClick((param) => {
      if (!param?.time || !seriesRef.current || !candlesRef.current?.length) return;
      const match = (candlesRef.current || []).find((c) => Math.floor(Number(c.timestamp) / 1000) === Number(param.time));
      if (match) setSelectedCandle(match);
    });

    return () => chart.remove();
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || !data?.candles?.length) return;
    candlesRef.current = data.candles || [];
    const formatted = data.candles.map((c) => ({
      time: Math.floor(Number(c.timestamp) / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
    seriesRef.current.setData(formatted);
  }, [data]);

  const noData = !isLoading && (!data?.candles?.length || data?.error);
  const candleStats = useMemo(() => {
    if (!selectedCandle) return null;
    const open = Number(selectedCandle.open || 0);
    const close = Number(selectedCandle.close || 0);
    const high = Number(selectedCandle.high || 0);
    const low = Number(selectedCandle.low || 0);
    const range = high - low;
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    return { open, close, high, low, range, body, upperWick, lowerWick };
  }, [selectedCandle]);

  return (
    <div className="card">
      <div className="flex gap-2 mb-3">
        <input className="input-sm max-w-40" value={pair} onChange={(e) => setPair(e.target.value.toUpperCase())} placeholder="BTCUSDT" />
        {['5m', '15m', '1h', '4h', '1d'].map((item) => (
          <button key={item} onClick={() => setTf(item)} className={tf === item ? 'btn-secondary btn-sm !bg-signal-500/20 !text-signal-400' : 'btn-secondary btn-sm'}>
            {item}
          </button>
        ))}
      </div>
      {isLoading && <div className="skeleton h-48 md:h-72 lg:h-96 w-full" />}
      {noData && (
        <div className="h-48 md:h-72 lg:h-96 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--bg-secondary)]">
          <p className="text-3xl">📊</p>
          <p className="font-medium">No chart data</p>
          <p className="text-sm text-[var(--text-muted)]">{data?.error || `Could not load ${pair} ${tf} data`}</p>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">Retry</button>
        </div>
      )}
      {!isLoading && !noData && <div ref={containerRef} className="w-full h-48 md:h-72 lg:h-96" />}
      {selectedCandle && candleStats && (
        <div className="modal-overlay">
          <div className="modal space-y-3">
            <h3 className="font-semibold">Candle Details</h3>
            <p className="text-xs text-[var(--text-muted)]">{pair} · {tf} · {new Date(Number(selectedCandle.timestamp)).toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Open</p><p>{candleStats.open.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Close</p><p>{candleStats.close.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">High</p><p>{candleStats.high.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Low</p><p>{candleStats.low.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Range</p><p>{candleStats.range.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Body</p><p>{candleStats.body.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Upper Wick</p><p>{candleStats.upperWick.toFixed(4)}</p></div>
              <div className="card !p-3"><p className="text-xs text-[var(--text-muted)]">Lower Wick</p><p>{candleStats.lowerWick.toFixed(4)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary"
                onClick={() => {
                  onUseCandle?.({ pair, timeframe: tf, candle: selectedCandle, stats: candleStats });
                  setSelectedCandle(null);
                }}
              >
                Use In Builder
              </button>
              <button className="btn-ghost" onClick={() => setSelectedCandle(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
