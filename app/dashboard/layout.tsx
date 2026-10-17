/**
 * Login and invitation verification belong to the authentication flow, not every
 * dashboard navigation. Middleware authenticates requests; each page checks its
 * own workspace permissions. See AuthForm and /auth/callback.
 */
export default function ProtectedLayout({children}:{children:React.ReactNode}){
 return children;
}
