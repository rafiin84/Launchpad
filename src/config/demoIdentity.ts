import type { User } from '../types';

/**
 * Optional display-only identity for the signed-in investor, for demos and
 * screenshots. Set VITE_DEMO_INVESTOR_NAME (and optionally
 * VITE_DEMO_INVESTOR_AVATAR) in `.env` and rebuild to use it; leave them
 * unset and nothing changes.
 *
 * This is deliberately NOT applied to `currentUser` in AuthContext, because
 * that name is written into CRM records (review comments, document and
 * activity authors, poll votes). It is only applied by the components that
 * render the user's own name and photo.
 */
const DEMO_NAME = (import.meta.env.VITE_DEMO_INVESTOR_NAME as string | undefined)?.trim();
const DEMO_AVATAR = (import.meta.env.VITE_DEMO_INVESTOR_AVATAR as string | undefined)?.trim();

export function withDemoIdentity(user: User): User {
  if (user.role !== 'investor' || (!DEMO_NAME && !DEMO_AVATAR)) return user;
  return {
    ...user,
    name: DEMO_NAME || user.name,
    avatar: DEMO_AVATAR || user.avatar,
  };
}
