# Firestore Security Spec

## Data Invariants
1. A company belongs to a specific user (userId == request.auth.uid).
2. Transactions belong to a specific company (userId == request.auth.uid).

## Dirty Dozen Payloads (Security Edge Cases)
1. User A tries to read User B's company profile.
2. User A tries to create a transaction for User B.
3. User A tries to set `userId` in `companies` to User B's ID.
4. User A tries to update `createdAt` of a transaction.
5. Transaction amount is negative (enforced type check).
6. Transaction type is not INCOME/EXPENSE.
7. Attempting to inject a huge string in `company.name`.
8. Attempting to write a document to an unauthorized collection.
9. Attempting to update `userId` on an existing document.
10. Anonymous user trying to access data.
11. Unverified email user trying to write data.
12. Attempt to create transaction with empty amount.

## Test Strategy
`firestore.rules.test.ts` will mock auth and verify these 12 cases.
