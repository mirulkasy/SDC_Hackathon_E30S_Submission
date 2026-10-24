# Security rules and indexes

## Security rules (starting point)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function isMember(orgId) {
      return signedIn() && request.auth.token.orgId == orgId;
    }
    function role() { return request.auth.token.role; }
    function isManager() { return role() in ['owner', 'admin']; }

    // users: read/write own profile, but never role or orgId
    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if signedIn() && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['role', 'orgId']);
    }

    // reference data: read-only
    match /reference/{doc=**} {
      allow read: if signedIn();
      allow write: if false;
    }

    // org-scoped data
    match /organizations/{orgId} {
      allow read: if isMember(orgId);
      allow update: if isMember(orgId) && role() == 'owner';

      match /members/{uid} {
        allow read: if isMember(orgId);
        allow write: if false;               // functions only
      }
      match /products/{id} {
        allow read, write: if isMember(orgId);
      }
      match /inventoryLogs/{id} {
        allow read: if isMember(orgId);
        allow write: if false;               // functions / trusted transaction
      }
      match /transactions/{id} {
        allow read: if isMember(orgId);
        allow create: if isMember(orgId);
        allow update, delete: if isManager() ||
          (isMember(orgId) && resource.data.createdBy == request.auth.uid);
      }
      match /flags/{id} {
        allow read: if isMember(orgId);
        allow update: if isMember(orgId)
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['status', 'resolvedBy', 'resolutionNote', 'resolvedAt']);
        allow create, delete: if false;
      }
      match /{coll}/{id} {
        allow read, write: if isMember(orgId) && coll in
          ['budgets','vendors','invoices','publicity','tickets','chatSessions',
           'complianceProgress','notifications'];
      }
    }

    match /orgCodes/{code} {
      allow read, write: if false;           // join via Cloud Function
    }
  }
}
```

Notes:
- Subcollections of `tickets` and `chatSessions` need their own match blocks (the generic one above does not cascade). Copy the same `isMember` rule.
- Staff should not see cost/profit: either hide in UI (weak) or split cost into a `productCosts/{id}` doc readable only by managers (strong). Decide based on how seriously you want owner-vs-staff privacy.
- Validate required fields and types with `request.resource.data` checks before production.

## Composite indexes

| Collection | Fields |
|---|---|
| `products` | `deletedAt ASC, nearestExpiry ASC` |
| `products` | `barcode ASC` (single field, automatic) |
| `transactions` | `type ASC, date DESC` |
| `transactions` | `category ASC, date DESC` |
| `transactions` | `dedupeHash ASC, date DESC` |
| `flags` | `status ASC, createdAt DESC` |
| `publicity` | `status ASC, scheduledAt ASC` |
| `publicity` | `planId ASC, weekNumber ASC, scheduledAt ASC` |
| `tickets` | `status ASC, createdAt DESC` |
| `tickets` | `transactionId ASC, createdAt DESC` |
| `invoices` | `status ASC, issueDate DESC` |

Firestore will print a link to create any missing index the first time a query fails, which is the fastest way to build this list.

## Cloud Functions to build

1. `joinOrganization(code)`: validates code, adds member, sets claims.
2. `onTransactionWrite`: dedupe hash check, update `summaries`, run flags.
3. `onProductWrite`: recompute `nearestExpiry`, `platformPricing`.
4. `processChatMessage`: AI parsing for text, spreadsheet, receipt.
5. `dailyExpiryCheck` (scheduled): expiry and low-stock notifications.
6. `nextInvoiceNo` / `nextTicketNo`: transactional counters.
7. `generatePublicityPlan`: weekly plan from sales, stock and past `feedback`.