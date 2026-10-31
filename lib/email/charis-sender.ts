/** A permitted outgoing FROM address for Charis. This never restricts staff login emails. */
export function isCharisSenderDomain(value:string):boolean{
 const domain=value.trim().toLowerCase().replace(/\.$/,'');
 return domain==='charismfb.com'||domain.endsWith('.charismfb.com');
}
export function isCharisSenderEmail(value:string):boolean{
 const email=value.trim().toLowerCase(),at=email.lastIndexOf('@');
 return at>0&&at===email.indexOf('@')&&isCharisSenderDomain(email.slice(at+1));
}
