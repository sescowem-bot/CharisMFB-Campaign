/** Staff-safe configuration status; never confuse a provider login with live delivery. */
export function providerHubState(input:{
 providerEnabled:boolean;
 directEnabled:boolean;
 selectedSenderEmail?:string|null;
 approvedSenderCount:number;
 externallyVerifiedCount:number;
 deliveryEnabled:boolean;
 apiConfigured:boolean;
}){
 const senderSelected=Boolean(input.selectedSenderEmail&&input.directEnabled&&input.providerEnabled);
 const domainNeedsReview=Boolean(input.selectedSenderEmail?.toLowerCase().endsWith('@salemmedicals.com'));
 const ready=senderSelected&&input.deliveryEnabled&&input.apiConfigured&&!domainNeedsReview;
 const label=ready?'Enabled for bank service sending':
  domainNeedsReview?'Sender domain needs Charis branding review':
  senderSelected?'Sender selected — check delivery settings':
  input.approvedSenderCount?'Sender available — choose it below':
  input.externallyVerifiedCount?'Verified with provider — connect it to Charis':'Sender setup required';
 return {ready,senderSelected,domainNeedsReview,label};
}
