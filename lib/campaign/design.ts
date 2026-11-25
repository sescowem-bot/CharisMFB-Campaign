import {z} from 'zod';
const https=z.string().url().startsWith('https://').max(1800);
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const textFormat=z.object({color:color.optional(),backgroundColor:color.optional(),fontSize:z.number().int().min(10).max(48).optional(),fontFamily:z.enum(['Arial','Georgia','Verdana','Tahoma','Trebuchet MS']).optional(),align:z.enum(['left','center','right','justify']).optional(),bold:z.boolean().optional(),italic:z.boolean().optional(),underline:z.boolean().optional()}).strict();
const footerSchema=z.object({address:z.string().max(500).optional(),website:z.union([z.literal(''),https]).optional(),alignment:z.enum(['left','center','right']).optional(),backgroundColor:color.optional(),textColor:color.optional(),showCompany:z.boolean().optional(),social:z.array(z.object({platform:z.enum(['facebook','instagram','x','linkedin','youtube','tiktok']),url:https}).strict()).max(8).optional()}).strict();
/** Email-client-safe blocks, not arbitrary browser HTML or executable SVG. */
export const blockSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('heading'),text:z.string().max(5000),format:textFormat.optional()}).strict(),
 z.object({type:z.literal('paragraph'),text:z.string().max(5000),format:textFormat.optional()}).strict(),
 z.object({type:z.literal('button'),text:z.string().max(200),url:https}).strict(),
 z.object({type:z.literal('divider'),text:z.literal('')}).strict(),
 z.object({type:z.literal('image'),text:z.string().min(1).max(160),url:https,width:z.enum(['full','medium','small']).default('full')}).strict(),
 z.object({type:z.literal('shape'),text:z.string().max(200),shape:z.enum(['banner','pill','panel','rule','rectangle','circle']).default('banner'),color:color.default('#40239A'),textColor:color.optional(),borderColor:color.optional(),borderWidth:z.number().int().min(0).max(12).optional(),padding:z.number().int().min(0).max(64).optional(),widthPercent:z.number().int().min(25).max(100).optional(),minHeight:z.number().int().min(0).max(400).optional(),fontSize:z.number().int().min(12).max(48).optional(),align:z.enum(['left','center','right']).optional()}).strict()
]);
export const designSchema=z.object({version:z.literal('1'),style:z.enum(['classic','modern','minimal','announcement']).optional(),blocks:z.array(blockSchema).min(1).max(30),footer:footerSchema.optional()});
export type EmailDesign=z.infer<typeof designSchema>;
export type EmailBlock=EmailDesign['blocks'][number];
export type EmailFooter=NonNullable<EmailDesign['footer']>;
export function verifiedBrandWebsite(value?:string|null):string {
 if(!value)return '';
 try {const parsed=new URL(value),hostname=parsed.hostname.toLowerCase();if(parsed.protocol!=='https:'||parsed.username||parsed.password||!hostname||hostname==='charismfbcampaign.vercel.app'||isPlaceholderHostname(hostname))return '';return parsed.href;} catch {return '';}
}
function isPlaceholderHostname(hostname:string):boolean {return hostname==='example.com'||hostname==='example.net'||hostname==='example.org'||hostname.endsWith('.example.com')||hostname.endsWith('.example.net')||hostname.endsWith('.example.org')||hostname.endsWith('.example')||hostname.endsWith('.invalid');}
export function isPlaceholderButtonUrl(value:string):boolean {try{return isPlaceholderHostname(new URL(value).hostname.toLowerCase());}catch{return false;}}
export function resolveBrandLinks(design:EmailDesign,website?:string|null):EmailDesign {const url=verifiedBrandWebsite(website);if(!url)return design;return {...design,blocks:design.blocks.map(block=>block.type==='button'&&isPlaceholderButtonUrl(block.url)?{...block,url}:block)};}
export function assertNoDemoLinks(design:EmailDesign):void {if(design.blocks.some(block=>block.type==='button'&&isPlaceholderButtonUrl(block.url)))throw Error('Replace the example button destination with the approved bank website or another verified HTTPS link before saving or sending.');}
export function createStarterDesign(website?:string|null):EmailDesign {const url=verifiedBrandWebsite(website);return {version:'1',blocks:[{type:'heading',text:'Hello {{first_name}}'},{type:'paragraph',text:'We have an important update to share with you.'},...(url?[{type:'button' as const,text:'Visit our website',url}]:[]),{type:'divider',text:''}]};}
export const starterDesign:EmailDesign=createStarterDesign();
