import { useQuery } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../api/client';

export default function EquityCurve() {
  const { data = [] } = useQuery({
    queryKey: ['equity-curve'],
    queryFn: async () => (await apiClient.get('/api/analytics/performance')).data?.points || [],
  });

  return (
    <div className="card h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" stroke="#71717a" />
          <YAxis stroke="#71717a" />
          <Tooltip />
          <Line dataKey="pnl" stroke="#8b5cf6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
