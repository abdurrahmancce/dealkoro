# DEALKORO Security Specification (Phase 0 TDD - Hardened Escrow Edition)

## 1. Core Data Invariants
1. **Identity Integrity**: Every created `listing`, `comment`, `message`, `review`, and user-owned `statement` must bind its author/owner UID strictly to `request.auth.uid`.
2. **PII Isolation**: Emails, phone numbers, and payout preferences live strictly under `/users/{userId}/private/{docId}` and are readable/writable only by `userId == request.auth.uid` or `isAdmin()`.
3. **Role Protection**: Standard users cannot self-assign `role: "admin"` on `/users/{userId}` or write to `/admins/{adminId}`. Only verified bootstrap admin (`akash.abdur.2002@gmail.com` with `email_verified == true`) or entries in `/admins/{uid}` have admin privileges.
4. **Admin-Only Escrow Payment Verification & Payout Release**:
   - Non-admin buyers and sellers CANNOT mark `buyerInitialDone = true`, CANNOT advance deal status to `payment_received`, `id_exchange`, or `done`, and CANNOT mutate `agreedAmount` or `adminId` after creation.
   - Only `isAdmin()` can verify buyer payment (`payment_received` / `id_exchange`), reassign mediators, mark a deal `done` (payout release), mark the listing `sold`, and write seller/admin payout ledger entries (`/statements`).
5. **Master Gate on Subcollections**: Access to `/conversations/{conversationId}/messages/{messageId}` and `/deals/{dealId}/messages/{messageId}` requires membership (`buyerId`, `sellerId`, or `adminId`) in the parent document via `get()`.
6. **Terminal State Locking**: Once a `deal` reaches `status == "done"` or `status == "cancelled"`, non-admin updates are strictly rejected.
7. **Temporal & ID Integrity**: All document IDs match `^[a-zA-Z0-9_\-]+$` (<= 128 chars) and timestamps match `request.time`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Self-Admin Escalation**: User creates `/users/uid1` with `role: "admin"`.
2. **Buyer Fake Payment Bypass**: Buyer updates `/deals/d1` setting `buyerInitialDone: true` and `status: "payment_received"`.
3. **Non-Admin Payout Release**: Seller updates `/deals/d1` setting `status: "done"` or writes `/statements/s1` with `type: "admin_fee_income"`.
4. **Agreed Amount Tampering**: Buyer updates `/deals/d1` lowering `agreedAmount` from `2000` to `10` during `service_select`.
5. **Shadow Ghost Field**: User creates `/listings/l1` with extra `isPromoted: true` field.
6. **ID Poisoning**: User writes `/listings/../../../../etc/passwd` or 500-char ID.
7. **PII Cross-Read**: User `uid2` attempts `get` on `/users/uid1/private/info`.
8. **Listing Hijack**: User `uid2` attempts `update` on `/listings/l1` owned by `uid1`.
9. **Unauthorized Chat Spying**: User `uid3` attempts `get`/`list` on `/conversations/c1/messages/m1` where `uid3` is neither buyer nor seller.
10. **Deal Tampering After Done**: Seller attempts `update` on `/deals/d1` when `status == "done"`.
11. **Timestamp Spoofing**: User creates `/listings/l1` with backdated `createdAt` not equal to `request.time`.
12. **Unverified Email Admin Spoof**: Token has admin email string but `email_verified: false`.
