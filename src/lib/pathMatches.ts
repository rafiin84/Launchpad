/** True when `pathname` is the nav item's path or lies under it (`/portfolio` matches `/portfolio/12`, not `/portfolio-management`). */
export function pathMatches(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(itemPath + '/');
}
