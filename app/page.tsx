import {redirect} from 'next/navigation';

/** Staff portal: the product has no public marketing site. Middleware routes signed-out staff to /login. */
export default function Home() {
  redirect('/dashboard');
}
