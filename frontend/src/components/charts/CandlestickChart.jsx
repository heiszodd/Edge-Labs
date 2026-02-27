import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart } from 'lightweight-charts';
import { getOHLCV } from '../../api/perps';

export default function CandlestickChart({ defaultPair = 'BTCUSDT', defaultTf = '1h', height = 384 }) {
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const containerRef = useRef(null);
  const [pair, setPair] = useState(defaultPair);
  const [tf, setTf] = useState(defaultTf);

  const { data, isLoading } = useQuery({
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

    return () => chart.remove();
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || !data?.candles) return;
    const formatted = data.candles.map((c) => ({
      time: Math.floor(Number(c.timestamp) / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
    seriesRef.current.setData(formatted);
  }, [data]);

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
      {isLoading ? <div className="skeleton h-96 w-full" /> : <div ref={containerRef} className="w-full h-96" />}
    </div>
  );
}
