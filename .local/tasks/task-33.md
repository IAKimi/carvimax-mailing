---
title: Agregar eliminación de contactos individuales
---
# Agregar eliminación de contactos individuales

## What & Why
Users currently cannot delete individual contacts from a database. The backend endpoint `DELETE /api/contacts/:id` already exists and works, but the frontend ContactsTable component only shows an edit button per row — no delete option. Users need to be able to remove specific contacts without overwriting or deleting the entire database.

## Done looks like
- Each contact row in the ContactsTable has a visible delete button (trash icon)
- Clicking delete shows a confirmation dialog before removing the contact
- After deletion, the contact list refreshes automatically and the count updates
- The delete button is styled consistently with existing edit controls

## Out of scope
- Bulk delete (select multiple contacts and delete at once)
- Backend API changes (endpoint already exists)
- Database schema changes

## Tasks
1. **Add delete button to contact rows** — Add a trash icon button next to the existing edit button in each contact row of the ContactsTable component.
2. **Add confirmation dialog and mutation** — Show a confirmation alert before deleting, call `DELETE /api/contacts/:id`, invalidate the contacts query cache on success, and show a toast notification.

## Relevant files
- `client/src/pages/Contacts.tsx:86-538`
- `server/routes.ts:1153`