import type {EmailDesign} from '../campaign/design.ts';

/** A light, branded design produced even when the customer has not selected a saved template. */
export type SimpleEmailStyle='classic'|'modern'|'minimal'|'announcement';
export const simpleEmailStyles=[
 {value:'classic',label:'Classic',description:'A clean bank notice'},
 {value:'modern',label:'Modern',description:'A bold branded header'},
 {value:'minimal',label:'Minimal',description:'Simple and spacious'},
 {value:'announcement',label:'Highlight',description:'For important updates'}
] as const;

export function makeSimpleEmailDesign(body:string,greeting:string,style:SimpleEmailStyle):EmailDesign{
 return {version:'1',style,blocks:[
  ...(greeting.trim()?[{type:'heading' as const,text:greeting.trim().slice(0,200)}]:[]),
  {type:'paragraph',text:body.trim().slice(0,2000)}
 ]};
}
