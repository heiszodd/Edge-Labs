import { useQuery } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getPerformance } from '../../api/analytics';

export default function EquityCurve() {
  const { data = [] } = useQuery({
    queryKey: ['equity-curve'],
    queryFn: async () => {
      const perf = await getPerformance();
      return perf?.winrate_series || [];
    },
  });

  return (
    <div className="card h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="idx" stroke="#71717a" />
          <YAxis stroke="#71717a" />
          <Tooltip />
          <Line dataKey="win_rate" stroke="#8b5cf6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
