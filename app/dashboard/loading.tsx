/** Lightweight accessible loading state for staff route transitions. */
export default function DashboardLoading(){
 return <div className="charis-route-loading" role="status" aria-label="Loading page" aria-live="polite">
  <div className="charis-loading-title"/><div className="charis-loading-panel"/><div className="charis-loading-row"/><div className="charis-loading-row"/>
  <span className="sr-only">Loading page…</span>
 </div>;
}
