import {SetStaffPassword} from '@/components/set-staff-password';
import {PublicCard} from '@/components/public-card';
export const metadata={title:'Set your password',robots:{index:false,follow:false}};
export default function Page(){return <PublicCard title="Set your staff password" subtitle="Confirm your invitation and choose a password to finish setting up your Charis account."><div style={{textAlign:'left'}}><SetStaffPassword/></div></PublicCard>}
