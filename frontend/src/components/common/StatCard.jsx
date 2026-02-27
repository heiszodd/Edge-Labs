export default function StatCard({ label, value, change, changePositive, icon, gradient, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-4 w-20 mb-3" />
        <div className="skeleton h-8 w-28 mb-2" />
        <div className="skeleton h-3 w-16" />
      </div>
    );
  }

  return (
    <div className={`card hover:scale-[1.02] transition-transform duration-300 ease-spring cursor-default ${gradient || ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="stat-label">{label}</p>
        {icon && <span className="text-xl animate-float">{icon}</span>}
      </div>
      <p className="stat-value">{value}</p>
      {change !== undefined && (
        <p className={`stat-change mt-1 ${changePositive ? 'text-success' : 'text-danger'}`}>
          {changePositive ? '▲' : '▼'} {change}
        </p>
      )}
    </div>
  );
}

