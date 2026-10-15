import {z} from 'zod';
const https=z.string().url().startsWith('https://').max(1800);
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Email-client-safe blocks, not arbitrary browser HTML or executable SVG. */
export const blockSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('heading'),text:z.string().max(5000)}).strict(),
 z.object({type:z.literal('paragraph'),text:z.string().max(5000)}).strict(),
 z.object({type:z.literal('button'),text:z.string().max(200),url:https}).strict(),
 z.object({type:z.literal('divider'),text:z.literal('')}).strict(),
 z.object({type:z.literal('image'),text:z.string().min(1).max(160),url:https,width:z.enum(['full','medium','small']).default('full')}).strict(),
 z.object({type:z.literal('shape'),text:z.string().max(200),shape:z.enum(['banner','pill','panel','rule','rectangle','circle']).default('banner'),color:color.default('#40239A'),textColor:color.optional(),borderColor:color.optional(),borderWidth:z.number().int().min(0).max(12).optional(),padding:z.number().int().min(0).max(64).optional(),widthPercent:z.number().int().min(25).max(100).optional(),minHeight:z.number().int().min(0).max(400).optional(),fontSize:z.number().int().min(12).max(48).optional(),align:z.enum(['left','center','right']).optional()}).strict()
]);
export const designSchema=z.object({version:z.literal('1'),style:z.enum(['classic','modern','minimal','announcement']).optional(),blocks:z.array(blockSchema).min(1).max(30)});
export type EmailDesign=z.infer<typeof designSchema>;
export type EmailBlock=EmailDesign['blocks'][number];
export const starterDesign:EmailDesign={version:'1',blocks:[{type:'heading',text:'Hello {{first_name}}'},{type:'paragraph',text:'We have an important update to share with you.'},{type:'button',text:'Learn more',url:'https://example.com'},{type:'divider',text:''}]};
