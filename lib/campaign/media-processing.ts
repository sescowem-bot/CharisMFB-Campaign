import sharp from 'sharp';

export type CampaignMediaCrop='none'|'square'|'banner';
export type CampaignImageOutput={bytes:Uint8Array;mime:'image/jpeg'|'image/png';ext:'jpg'|'png'};
const maxBytes=8*1024*1024;
/**
 * Preserve source detail for email artwork. Uncropped JPEG/PNG files are kept
 * byte-for-byte when their EXIF orientation is already correct. Cropped or
 * orientation-corrected files use high-quality output without palette reduction.
 */
export async function optimizeCampaignMedia(bytes:Uint8Array,crop:CampaignMediaCrop):Promise<CampaignImageOutput>{
 if(!bytes.length||bytes.length>maxBytes)throw new Error('Source image must be at most 8 MB.');
 const input=sharp(Buffer.from(bytes),{limitInputPixels:40_000_000,failOn:'error'});
 const details=await input.metadata();
 const format=details.format;
 if(crop==='none'&&(format==='jpeg'||format==='png')&&(!details.orientation||details.orientation===1)){
  return {bytes:new Uint8Array(bytes),mime:format==='png'?'image/png':'image/jpeg',ext:format==='png'?'png':'jpg'};
 }
 let pipeline=input.rotate();
 if(crop==='square'){
  const size=Math.max(1,Math.min(1600,details.width||1600,details.height||1600));
  pipeline=pipeline.resize(size,size,{fit:'cover',position:'attention',withoutEnlargement:true});
 }else if(crop==='banner'){
  const width=Math.max(1,Math.min(1800,details.width||1800,(details.height||900)*2));
  const height=Math.max(1,Math.floor(width/2));
  pipeline=pipeline.resize(width,height,{fit:'cover',position:'attention',withoutEnlargement:true});
 }
 const transparent=Boolean(details.hasAlpha)||format==='png';
 const output=transparent
  ?await pipeline.png({compressionLevel:6,adaptiveFiltering:true,palette:false}).toBuffer()
  :await pipeline.jpeg({quality:95,mozjpeg:true,chromaSubsampling:'4:4:4'}).toBuffer();
 if(!output.length||output.length>maxBytes)throw new Error('The processed image is larger than 8 MB. Use a smaller source image or choose no crop.');
 return {bytes:new Uint8Array(output),mime:transparent?'image/png':'image/jpeg',ext:transparent?'png':'jpg'};
}
