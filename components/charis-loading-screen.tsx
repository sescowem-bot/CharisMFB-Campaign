import Image from 'next/image';

export function CharisLoadingScreen(){
 return <main className="charis-loading-screen" aria-label="Loading Charis Campaign Centre">
  <div className="charis-loading-brand">
   <Image src="/charis-official-mark.png" width={68} height={68} alt="" priority/>
   <div className="charis-loading-wordmark"><strong>Charis</strong><span>MICROFINANCE BANK LTD</span></div>
  </div>
  <div className="charis-loading-product">CAMPAIGN CENTRE</div>
  <div className="charis-loading-indicator" aria-hidden="true"><span/><span/><span/></div>
  <p>Preparing your workspace…</p>
  <span className="sr-only">Please wait while the page loads.</span>
 </main>;
}
