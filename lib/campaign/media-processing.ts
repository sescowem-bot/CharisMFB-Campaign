import sharp from 'sharp';

export type CampaignMediaCrop='none'|'square'|'banner';
export type CampaignImageOutput={bytes:Uint8Array;mime:'image/jpeg'|'image/png';ext:'jpg'|'png'};
const maxBytes=2*1024*1024;
/**
 * Optimise campaign images for HTML email. Keep JPEG/PNG for classic Outlook;
 * WebP-only email images are not reliably supported by older desktop clients.
 */
export async function optimizeCampaignMedia(bytes:Uint8Array,crop:CampaignMediaCrop):Promise<CampaignImageOutput>{
 if(!bytes.length||bytes.length>maxBytes)throw new Error('Source image must be at most 2 MB.');
 const input=sharp(Buffer.from(bytes),{limitInputPixels:25_000_000,failOn:'error'});
 const details=await input.metadata();
 let pipeline=input.rotate();
 if(crop==='square')pipeline=pipeline.resize(1000,1000,{fit:'cover',position:'attention'});
 else if(crop==='banner')pipeline=pipeline.resize(1200,600,{fit:'cover',position:'attention'});
 else pipeline=pipeline.resize(1600,1600,{fit:'inside',withoutEnlargement:true});
 const transparent=Boolean(details.hasAlpha);
 const output=transparent
  ?await pipeline.png({compressionLevel:9,adaptiveFiltering:true,palette:true}).toBuffer()
  :await pipeline.jpeg({quality:84,mozjpeg:true}).toBuffer();
 if(!output.length||output.length>maxBytes)throw new Error('The optimised image exceeds the 2 MB limit.');
 return {bytes:new Uint8Array(output),mime:transparent?'image/png':'image/jpeg',ext:transparent?'png':'jpg'};
}
