/** Syntax-only sender validation. Organisation ownership and provider verification are enforced separately. */
export function isValidSenderDomain(value:string):boolean{
 const domain=value.trim().toLowerCase().replace(/\.$/,'');
 if(domain.length>253)return false;
 return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}
export function isValidSenderEmail(value:string):boolean{
 const email=value.trim().toLowerCase(),at=email.lastIndexOf('@');
 return at>0&&at===email.indexOf('@')&&isValidSenderDomain(email.slice(at+1));
}
