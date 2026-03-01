import { useEffect } from 'react';

export default function SMCOverlay({ chart, smc_data }) {
  useEffect(() => {
    if (!chart || !smc_data) return;
    smc_data?.bos_levels?.forEach((lvl) => {
      const line = chart.addLineSeries({ color: lvl.direction === 'up' ? '#10b981' : '#ef4444' });
      line.setData([{ time: 1, value: lvl.price }, { time: 999999, value: lvl.price }]);
    });
    smc_data?.fvgs?.forEach((fvg) => {
      const area = chart.addAreaSeries({ topColor: fvg.type === 'bull' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)', bottomColor: 'transparent', lineColor: 'transparent' });
      area.setData([{ time: 1, value: fvg.low }, { time: 999999, value: fvg.high }]);
    });
  }, [chart, smc_data]);
  return null;
}
