export function PageWrapper({ children, className = '' }) {
  return <div className={`animate-fade-in ${className}`}>{children}</div>;
}
