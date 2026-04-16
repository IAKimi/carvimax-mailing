---
title: Jerarquía superadmin y limpieza de usuarios
---
# Superadmin hierarchy and user cleanup

## What & Why
Establish admin@postialo.com as the top-level "superadmin" with full authority over all users including other admins. Currently no admin can delete, impersonate, or change the role of another admin. The superadmin needs to be able to do all of this. Also delete the E2E Test user (id 9, e2etest@postialo.com) from both dev and production databases.

## Done looks like
- admin@postialo.com has role "superadmin" in the database
- E2E Test user (id 9) deleted from dev database
- seed-data.json regenerated without E2E user and with admin@postialo.com as superadmin
- Backend routes updated: superadmin can delete any user (including admins), change any user's role, impersonate any user — except cannot delete/demote themselves
- Regular admins retain existing restrictions (cannot delete/impersonate other admins)
- No one can delete or change the role of the superadmin (protected)
- Frontend AdminUsers.tsx updated: show delete/impersonate/role-change buttons for admin users when logged in as superadmin
- Badge displays "Superadmin" for the superadmin user in the admin panel

## Out of scope
- Multiple superadmin support (only admin@postialo.com)
- UI for promoting users to superadmin

## Tasks
1. **Update user role in DB** — Change admin@postialo.com role to "superadmin". Delete E2E Test user (id 9) and all their data.
2. **Update backend routes** — Modify DELETE, PATCH role, and impersonate routes to allow superadmin to act on admins. Add protection so superadmin cannot be deleted or demoted by anyone.
3. **Update frontend AdminUsers.tsx** — Show action buttons (delete, impersonate, role change) for admin users when logged in as superadmin. Add "Superadmin" badge. Hide delete/role-change for the superadmin user row.
4. **Regenerate seed-data.json** — Export fresh data without E2E user, with updated roles, so production DB gets the correct state.
5. **Rebuild and redeploy** — Run build and publish updated version.

## Relevant files
- `server/routes.ts:1794-1807,1817-1819,1879-1897`
- `client/src/pages/AdminUsers.tsx`
- `server/storage.ts:495-501`
- `server/seed-data.json`
- `shared/schema.ts:5-14`