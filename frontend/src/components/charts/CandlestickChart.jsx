import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import apiClient from '../../api/client';

export default function CandlestickChart({ pair = 'BTC-USD', timeframe = '1h', height = 320 }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [localPair, setLocalPair] = useState(pair);
  const [localTf, setLocalTf] = useState(timeframe);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, { height, layout: { background: { color: '#09090b' }, textColor: '#d4d4d8' } });
    const series = chart.addCandlestickSeries();
    chartRef.current = chart;

    apiClient.get('/api/perps/ohlcv', { params: { pair: localPair, timeframe: localTf } })
      .then(({ data }) => series.setData(data?.candles || []))
      .catch(() => series.setData([]));

    return () => chart.remove();
  }, [localPair, localTf, height]);

  return (
    <div className="card">
      <div className="flex gap-2 mb-3">
        <select className="input" value={localPair} onChange={(e) => setLocalPair(e.target.value)}><option>BTC-USD</option><option>ETH-USD</option></select>
        <select className="input" value={localTf} onChange={(e) => setLocalTf(e.target.value)}><option>15m</option><option>1h</option><option>4h</option></select>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
