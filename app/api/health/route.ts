import {NextResponse} from 'next/server';
export async function GET(){return NextResponse.json({status:'ok',service:'charis-campaign-centre',version:'0.14.0',release_stage:'acceptance_required'},{headers:{'Cache-Control':'no-store'}});}
