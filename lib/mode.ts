/**
 * Deployment mode.
 * "single" (default): one organisation, invite-only, no public marketing site, billing or plans.
 * "multi": the original multi-company SaaS surface. The database schema is identical in both modes.
 */
export type AppMode = 'single' | 'multi';

export function appMode(env: Record<string, string | undefined> = process.env): AppMode {
  return env.APP_MODE === 'multi' ? 'multi' : 'single';
}

/** Routes that only make sense for the multi-company product. */
const SAAS_ONLY = [
  '/pricing', '/features', '/solutions', '/resources', '/faq', '/about', '/contact',
  '/billing', '/register', '/admin/plans', '/admin/companies'
];

export function isSaasOnlyRoute(pathname: string): boolean {
  return SAAS_ONLY.some((base) => pathname === base || pathname.startsWith(base + '/'));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decides a single-mode redirect for a request, or null to continue.
 * Pure function so it can be tested without a running server.
 */
export function singleModeRedirect(input: {
  pathname: string;
  hasSession: boolean;
  orgParam: string | null;
  orgCookie: string | undefined;
}): string | null {
  const { pathname, hasSession, orgParam, orgCookie } = input;
  if (pathname === '/') return hasSession ? '/dashboard' : '/login';
  if (isSaasOnlyRoute(pathname)) return hasSession ? '/dashboard' : '/login';
  const needsOrg = pathname.startsWith('/dashboard/') && pathname !== '/dashboard/';
  if (needsOrg && !(orgParam && UUID.test(orgParam)) && orgCookie && UUID.test(orgCookie)) {
    return `${pathname}?org=${orgCookie}`;
  }
  return null;
}
