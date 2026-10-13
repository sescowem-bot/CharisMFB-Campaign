export const metadata = {title: 'Email preferences', robots: {index: false, follow: false}, referrer: 'no-referrer' as const};
import {z} from 'zod';
import {PublicCard} from '@/components/public-card';

export default async function Unsubscribe({searchParams}: {searchParams: Promise<{token?: string}>}) {
  const {token} = await searchParams;
  const valid = z.string().uuid().safeParse(token).success;
  return (
    <PublicCard title="Unsubscribe from marketing emails" subtitle="Confirm your request to stop marketing messages from Charis Microfinance Bank.">
      {valid ? (
        <form action={`/api/email/unsubscribe?token=${encodeURIComponent(token!)}`} method="post">
          <p className="faint" style={{fontSize: 13}}>Opening this page does not change your preferences. Use the button below to confirm.</p>
          <button className="btn" type="submit" style={{width: '100%', minHeight: 48}}>Confirm unsubscribe</button>
        </form>
      ) : <p>Please open the unsubscribe link from the email you received.</p>}
    </PublicCard>
  );
}
