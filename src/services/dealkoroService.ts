import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from '../firebase/config';
import type {
  AdminAgent,
  AdminDeal,
  AdminIdType,
  ChatMessage,
  Conversation,
  Language,
  Listing,
  ListingComment,
  NotificationItem,
  PaymentGatewaySession,
  PaymentMethod,
  PlatformEscrowConfig,
  StaffRole,
  StatementEntry,
  TeamVerificationInvite,
  ThemeMode,
  UserProfile,
} from '../types/dealkoro';
import {
  ASSETS,
  SEED_ADMINS,
  SEED_COMMENTS,
  SEED_CONVERSATIONS,
  SEED_DEALS,
  SEED_LISTINGS,
  SEED_NOTIFICATIONS,
  SEED_STATEMENTS,
} from '../data/seedData';
import { calculateDealBreakdown } from '../utils/dealMath';
import {
  BLUEPRINT_LIMITS,
  clampPrice,
  clampText,
  DEFAULT_PLATFORM_CONFIG,
  formatEscrowPaymentContact,
  generateSmartVerificationCode,
  isValidEmail,
  maskBdPhone,
  normalizeBdMobile,
  normalizeCategory,
  normalizeLinkType,
  normalizePaymentMethod,
  normalizeStaffRole,
  sanitizeId,
  sanitizeIdLast4,
  sanitizeImageUrl,
  sanitizePlatformConfig,
} from '../utils/payloadSanitizer';

export const BOOTSTRAP_ADMIN_EMAIL = 'akash.abdur.2002@gmail.com';

export interface DealkoroPersistedState {
  currentUser: UserProfile | null;
  language: Language;
  listings: Listing[];
  comments: ListingComment[];
  admins: AdminAgent[];
  conversations: Conversation[];
  deals: AdminDeal[];
  notifications: NotificationItem[];
  statements: StatementEntry[];
  bookmarks: string[];
  platformConfig: PlatformEscrowConfig;
}

const STORAGE_KEY = 'dealkoro_app_state_v2';

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}

export function getInitialState(): DealkoroPersistedState {
  let savedLang: Language = 'en';
  let savedBookmarks: string[] = ['listing_ronaldo_3250'];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DealkoroPersistedState>;
      savedLang = parsed.language === 'bn' ? 'bn' : 'en';
      if (Array.isArray(parsed.bookmarks)) {
        savedBookmarks = parsed.bookmarks;
      }
    }
  } catch {
    // Ignore localStorage parse failures
  }

  return {
    currentUser: null,
    language: savedLang,
    listings: SEED_LISTINGS,
    comments: SEED_COMMENTS,
    admins: SEED_ADMINS,
    conversations: SEED_CONVERSATIONS,
    deals: SEED_DEALS,
    notifications: SEED_NOTIFICATIONS,
    statements: SEED_STATEMENTS,
    bookmarks: savedBookmarks,
    platformConfig: { ...DEFAULT_PLATFORM_CONFIG },
  };
}

export function saveLocalPreferences(language: Language, bookmarks: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, bookmarks }));
  } catch {
    // Ignore storage quota errors
  }
}

const THEME_KEY = 'dealkoro_theme';

export function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Ignore storage access failures
  }
  return 'light';
}

export function saveThemePreference(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage access failures
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

export function buildNewListing(params: {
  seller: UserProfile;
  title: string;
  description: string;
  category: Listing['category'];
  imageUrl: string;
  paidCount: string;
  linkType: Listing['linkType'];
  server: string;
  limitInfo: string;
  price: number;
}): Listing {
  const id = sanitizeId(
    `listing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  );
  return {
    id,
    sellerId: sanitizeId(params.seller.uid),
    sellerName: clampText(params.seller.displayName, BLUEPRINT_LIMITS.NAME_MAX, 'Trader'),
    category: normalizeCategory(params.category),
    title: clampText(params.title, BLUEPRINT_LIMITS.TITLE_MAX, 'Gaming Account'),
    description: clampText(
      params.description || `${params.category} account · ${params.linkType}`,
      BLUEPRINT_LIMITS.DESC_MAX
    ),
    imageUrl: sanitizeImageUrl(params.imageUrl, ASSETS.efootballSquad),
    paidCount: clampText(params.paidCount || '4', 32, '4'),
    linkType: normalizeLinkType(params.linkType),
    server: clampText(params.server || 'Bangladesh', 60, 'Bangladesh'),
    limitInfo: clampText(params.limitInfo || '7', 40, '7'),
    price: clampPrice(params.price),
    rating: 5.0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

export function buildNewDealFromConversation(params: {
  conversation: Conversation;
  agreedAmount: number;
  selectedAdmin?: AdminAgent;
  platformConfig?: PlatformEscrowConfig;
}): AdminDeal {
  const id = sanitizeId(`deal_${Date.now().toString(36)}`);
  const assignedAdmin = params.selectedAdmin ?? SEED_ADMINS[0];
  const agreedAmount = clampPrice(params.agreedAmount);
  const now = new Date().toISOString();
  const paymentContact = params.platformConfig
    ? formatEscrowPaymentContact(params.platformConfig)
    : formatEscrowPaymentContact(DEFAULT_PLATFORM_CONFIG);

  return {
    id,
    title: clampText(`${agreedAmount} Deal`, BLUEPRINT_LIMITS.TITLE_MAX),
    conversationId: sanitizeId(params.conversation.id),
    listingId: sanitizeId(params.conversation.listingId),
    listingTitle: clampText(params.conversation.listingTitle, BLUEPRINT_LIMITS.TITLE_MAX),
    listingImage: sanitizeImageUrl(params.conversation.listingImage, ASSETS.efootballSquad),
    buyerId: sanitizeId(params.conversation.buyerId),
    buyerName: clampText(params.conversation.buyerName, BLUEPRINT_LIMITS.NAME_MAX, 'Buyer'),
    sellerId: sanitizeId(params.conversation.sellerId),
    sellerName: clampText(params.conversation.sellerName, BLUEPRINT_LIMITS.NAME_MAX, 'Seller'),
    adminId: sanitizeId(assignedAdmin.uid),
    adminName: clampText(assignedAdmin.name, BLUEPRINT_LIMITS.NAME_MAX, 'Verified Admin'),
    agreedAmount,
    serviceType: 'pending',
    serviceFee: 0,
    buyerMethod: 'pending',
    sellerMethod: 'pending',
    crossDealRequired: false,
    crossDealAccepted: false,
    crossDealFee: 0,
    iosCheck: false,
    googleBindCheck: false,
    verificationFee: 0,
    totalAmount: agreedAmount,
    paymentContact,
    paymentProofNote: '',
    paymentProofUrl: '',
    buyerInitialDone: false,
    sellerExchanged: false,
    accountDetailsNote: '',
    status: 'confirming',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `dm_init_${Date.now().toString(36)}`,
        senderId: 'system',
        senderName: 'DEALKORO',
        text: `Automated escrow deal created for ${assignedAdmin.name}, ${params.conversation.sellerName.split(' ')[0]} and ${params.conversation.buyerName.split(' ')[0]}.`,
        type: 'system',
        createdAt: now,
      },
    ],
  };
}

export function recalculateDealTotals(deal: AdminDeal): AdminDeal {
  const breakdown = calculateDealBreakdown({
    agreedAmount: deal.agreedAmount,
    serviceType: deal.serviceType,
    buyerMethod: deal.buyerMethod,
    sellerMethod: deal.sellerMethod,
    crossDealAccepted: deal.crossDealAccepted,
    iosCheck: deal.iosCheck,
    googleBindCheck: deal.googleBindCheck,
  });

  return {
    ...deal,
    serviceFee: breakdown.serviceFee,
    crossDealRequired: breakdown.crossDealRequired,
    crossDealFee: breakdown.crossDealFee,
    verificationFee: breakdown.verificationFee,
    totalAmount: breakdown.totalPayable,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolve authoritative user profile & admin role from Firebase Auth + Firestore.
 */
export async function resolveUserProfileFromFirebase(
  fbUser: FirebaseUser
): Promise<UserProfile> {
  const uid = sanitizeId(fbUser.uid);
  const email = (fbUser.email || '').trim().toLowerCase();
  const isMainAdmin = email === BOOTSTRAP_ADMIN_EMAIL && fbUser.emailVerified;
  let isAdmin = isMainAdmin;
  let staffRole: StaffRole | undefined = isMainAdmin ? 'main_admin' : undefined;

  if (!isMainAdmin) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (adminSnap.exists()) {
        const data = adminSnap.data();
        isAdmin = true;
        staffRole = normalizeStaffRole(String(data.staffRole ?? 'sub_admin'), email);
      }
    } catch {
      // Non-admins stay user role
    }
  }

  let displayName = clampText(
    fbUser.displayName || email.split('@')[0] || 'DEALKORO Trader',
    BLUEPRINT_LIMITS.NAME_MAX
  );
  let phone = clampText(fbUser.phoneNumber || '+880 1700-000000', 32);
  let payoutMethod: PaymentMethod = 'bKash';
  let level = isAdmin ? 25 : 1;
  let rating = 5.0;
  let sellCount = 0;
  let buyCount = 0;
  let joinedLabel = 'Nov 2026';
  const avatarUrl = sanitizeImageUrl(fbUser.photoURL || '', ASSETS.ninjaAvatar);

  try {
    const publicSnap = await getDoc(doc(db, 'users', uid));
    if (publicSnap.exists()) {
      const d = publicSnap.data();
      displayName = clampText(String(d.displayName || displayName), BLUEPRINT_LIMITS.NAME_MAX);
      level = Number(d.level ?? level);
      rating = Number(d.rating ?? rating);
      sellCount = Number(d.sellCount ?? sellCount);
      buyCount = Number(d.buyCount ?? buyCount);
      joinedLabel = String(d.joinedLabel || joinedLabel);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  try {
    const privateSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (privateSnap.exists()) {
      const p = privateSnap.data();
      if (p.phone) phone = clampText(String(p.phone), 32);
      if (p.payoutMethod) payoutMethod = normalizePaymentMethod(String(p.payoutMethod));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}/private/info`);
  }

  return {
    uid,
    displayName,
    email,
    phone,
    avatarUrl,
    level,
    rating,
    sellCount,
    buyCount,
    joinedLabel,
    role: isAdmin ? 'admin' : 'user',
    ...(staffRole ? { staffRole } : {}),
    payoutMethod,
    isDemo: false,
  };
}

export async function syncFirebaseUserProfile(user: UserProfile): Promise<void> {
  if (!auth.currentUser) return;
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: clampText(user.displayName, BLUEPRINT_LIMITS.NAME_MAX, 'Trader'),
        avatarUrl: sanitizeImageUrl(user.avatarUrl, ASSETS.ninjaAvatar),
        level: Math.max(1, Math.min(100, Math.round(user.level))),
        rating: Math.max(0, Math.min(5, user.rating)),
        sellCount: Math.max(0, Math.round(user.sellCount)),
        buyCount: Math.max(0, Math.round(user.buyCount)),
        joinedLabel: clampText(user.joinedLabel, 32, 'Nov 2026'),
        role: user.role === 'admin' ? 'admin' : 'user',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, 'users', uid, 'private', 'info'),
      {
        uid,
        email: clampText(user.email, 160),
        phone: clampText(user.phone, 32, '+880 1700-000000'),
        payoutMethod: normalizePaymentMethod(user.payoutMethod),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

function buildAdminAgentDocPayload(agent: AdminAgent): Record<string, unknown> {
  const uid = sanitizeId(agent.uid);
  const payload: Record<string, unknown> = {
    uid,
    name: clampText(agent.name, BLUEPRINT_LIMITS.NAME_MAX, 'Verified Admin'),
    verified: Boolean(agent.verified),
    specialty: clampText(agent.specialty, 160, 'Escrow Mediator'),
    reviewNotes: clampText(agent.reviewNotes, 500, 'Verified DEALKORO escrow mediator.'),
    completedDeals: Math.max(0, Math.round(agent.completedDeals)),
    rating: Math.max(0, Math.min(5, agent.rating || 5)),
  };
  if (agent.staffRole) {
    payload.staffRole = normalizeStaffRole(agent.staffRole, agent.email);
  }
  if (agent.email) {
    payload.email = clampText(agent.email.toLowerCase(), 160);
  }
  if (agent.phoneMasked) {
    payload.phoneMasked = clampText(agent.phoneMasked, 32);
  }
  if (agent.idType) {
    payload.idType = agent.idType;
  }
  if (agent.idLast4) {
    payload.idLast4 = clampText(agent.idLast4, 8);
  }
  if (agent.appointedBy) {
    payload.appointedBy = sanitizeId(agent.appointedBy);
  }
  if (agent.inviteId) {
    payload.inviteId = sanitizeId(agent.inviteId);
  }
  if (agent.verificationBadges) {
    payload.verificationBadges = {
      emailVerified: Boolean(agent.verificationBadges.emailVerified),
      mobileVerified: Boolean(agent.verificationBadges.mobileVerified),
      idVerified: Boolean(agent.verificationBadges.idVerified),
    };
  }
  return payload;
}

export async function ensureVerifiedAdminsInFirestore(user: UserProfile): Promise<void> {
  if (
    !auth.currentUser ||
    user.email.trim().toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL ||
    !auth.currentUser.emailVerified
  ) {
    return;
  }
  try {
    const existingSnap = await getDocs(collection(db, 'admins'));
    if (!existingSnap.empty) {
      return;
    }
  } catch {
    return;
  }

  for (const agent of SEED_ADMINS) {
    const path = `admins/${agent.uid}`;
    try {
      await setDoc(doc(db, 'admins', agent.uid), buildAdminAgentDocPayload(agent), {
        merge: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export function subscribeFirebaseAdmins(
  onUpdate: (items: AdminAgent[]) => void
): Unsubscribe {
  const rankRole = (role?: StaffRole): number => {
    if (role === 'main_admin') return 0;
    if (role === 'sub_admin') return 1;
    return 2;
  };
  return onSnapshot(
    collection(db, 'admins'),
    (snapshot) => {
      if (snapshot.empty) return;
      const items: AdminAgent[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          const email = data.email ? String(data.email) : undefined;
          const badgesRaw =
            typeof data.verificationBadges === 'object' && data.verificationBadges !== null
              ? (data.verificationBadges as Record<string, unknown>)
              : null;
          return {
            uid: d.id,
            name: String(data.name ?? 'Admin'),
            verified: Boolean(data.verified ?? true),
            staffRole: normalizeStaffRole(
              data.staffRole ? String(data.staffRole) : d.id === 'admin_abdur' ? 'main_admin' : 'sub_admin',
              email
            ),
            email,
            phoneMasked: data.phoneMasked ? String(data.phoneMasked) : undefined,
            idType: (data.idType as AdminIdType | undefined) || undefined,
            idLast4: data.idLast4 ? String(data.idLast4) : undefined,
            appointedBy: data.appointedBy ? String(data.appointedBy) : undefined,
            inviteId: data.inviteId ? String(data.inviteId) : undefined,
            verificationBadges: badgesRaw
              ? {
                  emailVerified: Boolean(badgesRaw.emailVerified),
                  mobileVerified: Boolean(badgesRaw.mobileVerified),
                  idVerified: Boolean(badgesRaw.idVerified),
                }
              : undefined,
            specialty: String(data.specialty ?? 'Verified Escrow Mediator'),
            reviewNotes: String(data.reviewNotes ?? ''),
            completedDeals: Number(data.completedDeals ?? 0),
            rating: Number(data.rating ?? 5),
          };
        })
        .sort((a, b) => {
          const rDiff = rankRole(a.staffRole) - rankRole(b.staffRole);
          if (rDiff !== 0) return rDiff;
          return b.completedDeals - a.completedDeals;
        });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'admins');
    }
  );
}

export async function persistAdminAgentToFirestore(agent: AdminAgent): Promise<void> {
  if (!auth.currentUser) return;
  const uid = sanitizeId(agent.uid);
  const path = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), buildAdminAgentDocPayload(agent), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdminAgentFromFirestore(adminUid: string): Promise<void> {
  if (!auth.currentUser) return;
  const uid = sanitizeId(adminUid);
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createTeamInviteInFirestore(params: {
  createdByUid: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  idType: AdminIdType;
  idNumber: string;
  staffRole: 'sub_admin' | 'moderator';
  specialty: string;
}): Promise<TeamVerificationInvite> {
  const email = params.candidateEmail.trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid candidate Google email address.');
  }
  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error('Main Project Admin email cannot be invited as Sub-Admin.');
  }
  const normalizedPhone = normalizeBdMobile(params.candidatePhone);
  if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
    throw new Error('Enter a valid 11-digit BD mobile number (01XXXXXXXXX).');
  }
  const idLast4 = sanitizeIdLast4(params.idNumber);
  if (idLast4.length < 4) {
    throw new Error('Enter at least the last 4 characters/digits of candidate NID or ID.');
  }
  const candidateName = clampText(params.candidateName, BLUEPRINT_LIMITS.NAME_MAX);
  if (!candidateName) {
    throw new Error('Enter the candidate full name.');
  }

  const id = sanitizeId(
    `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  );
  const verificationCode = generateSmartVerificationCode();
  const specialty = clampText(
    params.specialty || 'Verified Escrow Mediator',
    160,
    'Verified Escrow Mediator'
  );
  const nowIso = new Date().toISOString();

  const invite: TeamVerificationInvite = {
    id,
    candidateEmail: email,
    candidateName,
    candidatePhone: normalizedPhone,
    idType: params.idType,
    idLast4,
    staffRole: params.staffRole === 'moderator' ? 'moderator' : 'sub_admin',
    specialty,
    verificationCode,
    status: 'pending',
    createdBy: sanitizeId(params.createdByUid),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (auth.currentUser) {
    const path = `teamInvites/${id}`;
    try {
      await setDoc(doc(db, 'teamInvites', id), {
        id: invite.id,
        candidateEmail: invite.candidateEmail,
        candidateName: invite.candidateName,
        candidatePhone: invite.candidatePhone,
        idType: invite.idType,
        idLast4: invite.idLast4,
        staffRole: invite.staffRole,
        specialty: invite.specialty,
        verificationCode: invite.verificationCode,
        status: 'pending',
        createdBy: invite.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return invite;
}

export async function revokeTeamInviteInFirestore(inviteId: string): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(inviteId);
  const path = `teamInvites/${id}`;
  try {
    await updateDoc(doc(db, 'teamInvites', id), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeTeamInvites(
  email: string,
  isMainAdmin: boolean,
  onUpdate: (invites: TeamVerificationInvite[]) => void
): Unsubscribe {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isMainAdmin && !normalizedEmail) {
    return () => {};
  }

  const q = isMainAdmin
    ? collection(db, 'teamInvites')
    : query(collection(db, 'teamInvites'), where('candidateEmail', '==', normalizedEmail));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TeamVerificationInvite[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            candidateEmail: String(data.candidateEmail ?? ''),
            candidateName: String(data.candidateName ?? ''),
            candidatePhone: String(data.candidatePhone ?? ''),
            idType: (data.idType as AdminIdType) || 'NID',
            idLast4: String(data.idLast4 ?? ''),
            staffRole: (data.staffRole === 'moderator' ? 'moderator' : 'sub_admin') as
              | 'sub_admin'
              | 'moderator',
            specialty: String(data.specialty ?? 'Escrow Mediator'),
            verificationCode: String(data.verificationCode ?? ''),
            status: (data.status as TeamVerificationInvite['status']) || 'pending',
            createdBy: String(data.createdBy ?? ''),
            claimedUid: data.claimedUid ? String(data.claimedUid) : undefined,
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teamInvites');
    }
  );
}

export async function claimTeamInviteAndActivateAdmin(params: {
  invite: TeamVerificationInvite;
  fbUser: FirebaseUser;
  enteredPhone: string;
  enteredIdLast4: string;
  enteredCode: string;
}): Promise<{
  ok: boolean;
  error?: string;
  agent?: AdminAgent;
  staffRole?: 'sub_admin' | 'moderator';
}> {
  const userEmail = (params.fbUser.email || '').trim().toLowerCase();
  if (!params.fbUser.emailVerified || userEmail !== params.invite.candidateEmail.toLowerCase()) {
    return {
      ok: false,
      error: 'Signed-in Google email does not match this verified invitation.',
    };
  }
  if (params.invite.status !== 'pending') {
    return {
      ok: false,
      error: 'This invitation has already been claimed or revoked.',
    };
  }

  const normalizedPhone = normalizeBdMobile(params.enteredPhone);
  if (normalizedPhone !== normalizeBdMobile(params.invite.candidatePhone)) {
    return {
      ok: false,
      error: 'Mobile number does not match the number registered by Main Admin.',
    };
  }

  const enteredLast4 = sanitizeIdLast4(params.enteredIdLast4);
  if (enteredLast4 !== sanitizeIdLast4(params.invite.idLast4)) {
    return {
      ok: false,
      error: `${params.invite.idType} last 4 digits do not match.`,
    };
  }

  if (params.enteredCode.trim() !== params.invite.verificationCode.trim()) {
    return {
      ok: false,
      error: 'Invalid 6-digit smart verification code.',
    };
  }

  const uid = sanitizeId(params.fbUser.uid);
  const roleLabel = params.invite.staffRole === 'moderator' ? 'Moderator' : 'Sub-Admin';
  const agent: AdminAgent = {
    uid,
    name: clampText(params.invite.candidateName, BLUEPRINT_LIMITS.NAME_MAX, 'Staff Admin'),
    verified: true,
    staffRole: params.invite.staffRole,
    email: userEmail,
    phoneMasked: maskBdPhone(normalizedPhone),
    idType: params.invite.idType,
    idLast4: enteredLast4,
    appointedBy: sanitizeId(params.invite.createdBy),
    inviteId: sanitizeId(params.invite.id),
    verificationBadges: {
      emailVerified: true,
      mobileVerified: true,
      idVerified: true,
    },
    specialty: clampText(params.invite.specialty, 160, 'Verified Escrow Mediator'),
    reviewNotes: `Smart-verified ${roleLabel} (Email, Mobile & ${params.invite.idType} confirmed).`,
    completedDeals: 0,
    rating: 5.0,
  };

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'teamInvites', params.invite.id), {
      status: 'verified',
      claimedUid: uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admins', uid), buildAdminAgentDocPayload(agent));
    await batch.commit();

    await setDoc(
      doc(db, 'users', uid),
      { role: 'admin', updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});

    return { ok: true, agent, staffRole: params.invite.staffRole };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `teamInvites/${params.invite.id}`);
    return {
      ok: false,
      error: 'Could not activate staff role in Firestore. Please try again.',
    };
  }
}

export async function persistPaymentSessionToFirestore(
  session: PaymentGatewaySession
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(session.id);
  const path = `paymentSessions/${id}`;
  const payload: Record<string, unknown> = {
    id,
    dealId: sanitizeId(session.dealId),
    buyerId: sanitizeId(session.buyerId),
    method: normalizePaymentMethod(session.method),
    amount: Math.max(1, clampPrice(session.amount)),
    mode: session.mode === 'live_api' ? 'live_api' : 'sandbox',
    status: session.status,
    gatewayPaymentId: clampText(session.gatewayPaymentId, 128, id),
    expiresAt: session.expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (session.trxId) payload.trxId = clampText(session.trxId, 32);
  if (session.senderMasked) payload.senderMasked = clampText(session.senderMasked, 32);
  if (session.redirectUrl) payload.redirectUrl = clampText(session.redirectUrl, 512);

  try {
    await setDoc(doc(db, 'paymentSessions', id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePaymentSessionInFirestore(
  sessionId: string,
  patch: Partial<Pick<PaymentGatewaySession, 'status' | 'trxId' | 'senderMasked'>>
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(sessionId);
  const path = `paymentSessions/${id}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.trxId !== undefined) payload.trxId = clampText(patch.trxId, 32);
  if (patch.senderMasked !== undefined) payload.senderMasked = clampText(patch.senderMasked, 32);
  try {
    await updateDoc(doc(db, 'paymentSessions', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeDealPaymentSessions(
  dealId: string,
  buyerId: string,
  isMainAdmin: boolean,
  onUpdate: (sessions: PaymentGatewaySession[]) => void
): Unsubscribe {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || (!isMainAdmin && currentUid !== buyerId)) {
    return () => {};
  }
  const cleanDealId = sanitizeId(dealId);
  const q = isMainAdmin
    ? query(collection(db, 'paymentSessions'), where('dealId', '==', cleanDealId))
    : query(
        collection(db, 'paymentSessions'),
        where('dealId', '==', cleanDealId),
        where('buyerId', '==', currentUid)
      );

  return onSnapshot(
    q,
    (snap) => {
      const list: PaymentGatewaySession[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            dealId: String(data.dealId ?? cleanDealId),
            buyerId: String(data.buyerId ?? ''),
            method: normalizePaymentMethod(String(data.method ?? 'bKash')),
            amount: Number(data.amount ?? 0),
            mode: (data.mode === 'live_api' ? 'live_api' : 'sandbox') as 'live_api' | 'sandbox',
            status: (data.status as PaymentGatewaySession['status']) || 'initiated',
            gatewayPaymentId: String(data.gatewayPaymentId ?? ''),
            trxId: data.trxId ? String(data.trxId) : undefined,
            senderMasked: data.senderMasked ? String(data.senderMasked) : undefined,
            redirectUrl: data.redirectUrl ? String(data.redirectUrl) : undefined,
            expiresAt: String(data.expiresAt ?? ''),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'paymentSessions');
    }
  );
}

export function subscribePlatformEscrowConfig(
  onUpdate: (cfg: PlatformEscrowConfig) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'platformConfig', 'escrow'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onUpdate(
        sanitizePlatformConfig({
          bkashNumber: String(data.bkashNumber ?? ''),
          nagadNumber: String(data.nagadNumber ?? ''),
          bkashAccountType: String(data.bkashAccountType ?? 'Personal'),
          nagadAccountType: String(data.nagadAccountType ?? 'Personal'),
          bkashPaymentLink: String(data.bkashPaymentLink ?? ''),
          nagadPaymentLink: String(data.nagadPaymentLink ?? ''),
          escrowLabel: String(data.escrowLabel ?? ''),
          announcement: String(data.announcement ?? ''),
          updatedAt: toIsoString(data.updatedAt),
        })
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'platformConfig/escrow');
    }
  );
}

export async function persistPlatformEscrowConfig(
  config: PlatformEscrowConfig
): Promise<void> {
  if (!auth.currentUser) return;
  const clean = sanitizePlatformConfig(config);
  const path = 'platformConfig/escrow';
  try {
    await setDoc(doc(db, 'platformConfig', 'escrow'), {
      id: 'escrow',
      bkashNumber: clean.bkashNumber,
      nagadNumber: clean.nagadNumber,
      bkashAccountType: clean.bkashAccountType,
      nagadAccountType: clean.nagadAccountType,
      bkashPaymentLink: clean.bkashPaymentLink,
      nagadPaymentLink: clean.nagadPaymentLink,
      escrowLabel: clean.escrowLabel,
      announcement: clean.announcement,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistListingToFirestore(listing: Listing): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== listing.sellerId) return;
  const id = sanitizeId(listing.id);
  const path = `listings/${id}`;
  try {
    await setDoc(doc(db, 'listings', id), {
      id,
      sellerId: listing.sellerId,
      sellerName: clampText(listing.sellerName, BLUEPRINT_LIMITS.NAME_MAX, 'Trader'),
      category: normalizeCategory(listing.category),
      title: clampText(listing.title, BLUEPRINT_LIMITS.TITLE_MAX),
      description: clampText(listing.description, BLUEPRINT_LIMITS.DESC_MAX),
      imageUrl: sanitizeImageUrl(listing.imageUrl, ASSETS.efootballSquad),
      paidCount: clampText(listing.paidCount, 32, '4'),
      linkType: normalizeLinkType(listing.linkType),
      server: clampText(listing.server, 60, 'Bangladesh'),
      limitInfo: clampText(listing.limitInfo, 40, '7'),
      price: clampPrice(listing.price),
      rating: Math.max(0, Math.min(5, listing.rating || 5)),
      status: listing.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateListingStatusInFirestore(
  listingId: string,
  status: Listing['status']
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(listingId);
  const path = `listings/${id}`;
  try {
    await updateDoc(doc(db, 'listings', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteListingFromFirestore(listingId: string): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(listingId);
  const path = `listings/${id}`;
  try {
    await deleteDoc(doc(db, 'listings', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeFirebaseListings(
  onUpdate: (items: Listing[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'listings'),
    where('status', 'in', ['active', 'in_deal', 'sold'])
  );
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) return;
      const remote: Listing[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            sellerId: String(data.sellerId ?? ''),
            sellerName: String(data.sellerName ?? 'Trader'),
            category: normalizeCategory(String(data.category ?? 'eFootball')),
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            imageUrl: sanitizeImageUrl(String(data.imageUrl ?? ''), ASSETS.efootballSquad),
            paidCount: String(data.paidCount ?? '4'),
            linkType: normalizeLinkType(String(data.linkType ?? 'Only Konami')),
            server: String(data.server ?? 'Bangladesh'),
            limitInfo: String(data.limitInfo ?? '7'),
            price: Number(data.price ?? 0),
            rating: Number(data.rating ?? 5),
            status: (data.status as Listing['status']) || 'active',
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onUpdate(remote);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    }
  );
}

export function subscribeListingComments(
  listingId: string,
  onUpdate: (items: ListingComment[]) => void
): Unsubscribe {
  const id = sanitizeId(listingId);
  const path = `listings/${id}/comments`;
  const q = query(collection(db, 'listings', id, 'comments'), where('listingId', '==', id));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ListingComment[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            listingId: String(data.listingId ?? id),
            authorId: String(data.authorId ?? ''),
            authorName: String(data.authorName ?? 'User'),
            text: String(data.text ?? ''),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function persistCommentToFirestore(comment: ListingComment): Promise<void> {
  if (!auth.currentUser) return;
  const listingId = sanitizeId(comment.listingId);
  const commentId = sanitizeId(comment.id);
  const path = `listings/${listingId}/comments/${commentId}`;
  try {
    await setDoc(doc(db, 'listings', listingId, 'comments', commentId), {
      id: commentId,
      listingId,
      authorId: auth.currentUser.uid,
      authorName: clampText(comment.authorName, BLUEPRINT_LIMITS.NAME_MAX, 'User'),
      text: clampText(comment.text, BLUEPRINT_LIMITS.COMMENT_MAX),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function persistConversationToFirestore(conv: Conversation): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(conv.id);
  const path = `conversations/${id}`;
  try {
    await setDoc(doc(db, 'conversations', id), {
      id,
      listingId: sanitizeId(conv.listingId),
      listingTitle: clampText(conv.listingTitle, BLUEPRINT_LIMITS.TITLE_MAX),
      listingPrice: clampPrice(conv.listingPrice),
      listingImage: sanitizeImageUrl(conv.listingImage, ASSETS.efootballSquad),
      buyerId: sanitizeId(conv.buyerId),
      buyerName: clampText(conv.buyerName, BLUEPRINT_LIMITS.NAME_MAX, 'Buyer'),
      sellerId: sanitizeId(conv.sellerId),
      sellerName: clampText(conv.sellerName, BLUEPRINT_LIMITS.NAME_MAX, 'Seller'),
      lastMessage: clampText(conv.lastMessage, BLUEPRINT_LIMITS.LAST_MESSAGE_MAX),
      unreadCount: Math.max(0, Math.round(conv.unreadCount)),
      negotiatedPrice: clampPrice(conv.negotiatedPrice),
      offerStatus: conv.offerStatus,
      ...(conv.dealId ? { dealId: sanitizeId(conv.dealId) } : {}),
      ...(typeof conv.isSupport === 'boolean' ? { isSupport: conv.isSupport } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateConversationInFirestore(
  convId: string,
  patch: Partial<Pick<Conversation, 'lastMessage' | 'unreadCount' | 'negotiatedPrice' | 'offerStatus' | 'dealId'>>
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(convId);
  const path = `conversations/${id}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.lastMessage !== undefined) {
    payload.lastMessage = clampText(patch.lastMessage, BLUEPRINT_LIMITS.LAST_MESSAGE_MAX);
  }
  if (patch.unreadCount !== undefined) {
    payload.unreadCount = Math.max(0, Math.round(patch.unreadCount));
  }
  if (patch.negotiatedPrice !== undefined) {
    payload.negotiatedPrice = clampPrice(patch.negotiatedPrice);
  }
  if (patch.offerStatus !== undefined) {
    payload.offerStatus = patch.offerStatus;
  }
  if (patch.dealId !== undefined) {
    payload.dealId = sanitizeId(patch.dealId);
  }
  try {
    await updateDoc(doc(db, 'conversations', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function persistConversationMessage(
  conversationId: string,
  msg: ChatMessage
): Promise<void> {
  if (!auth.currentUser) return;
  const convId = sanitizeId(conversationId);
  const msgId = sanitizeId(msg.id);
  const path = `conversations/${convId}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'conversations', convId, 'messages', msgId), {
      id: msgId,
      senderId: msg.senderId === 'system' ? 'system' : auth.currentUser.uid,
      senderName: clampText(msg.senderName, BLUEPRINT_LIMITS.NAME_MAX, 'User'),
      text: clampText(msg.text, BLUEPRINT_LIMITS.MESSAGE_MAX),
      type: msg.type,
      ...(msg.offerAmount !== undefined ? { offerAmount: clampPrice(msg.offerAmount) } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function mapConversationDoc(d: { id: string; data: () => Record<string, unknown> }): Conversation {
  const data = d.data();
  return {
    id: d.id,
    listingId: String(data.listingId ?? ''),
    listingTitle: String(data.listingTitle ?? 'Listing'),
    listingPrice: Number(data.listingPrice ?? 0),
    listingImage: sanitizeImageUrl(String(data.listingImage ?? ''), ASSETS.efootballSquad),
    buyerId: String(data.buyerId ?? ''),
    buyerName: String(data.buyerName ?? 'Buyer'),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Seller'),
    lastMessage: String(data.lastMessage ?? ''),
    unreadCount: Number(data.unreadCount ?? 0),
    negotiatedPrice: Number(data.negotiatedPrice ?? 0),
    offerStatus: (data.offerStatus as Conversation['offerStatus']) || 'none',
    dealId: data.dealId ? String(data.dealId) : undefined,
    isSupport: Boolean(data.isSupport),
    updatedAt: toIsoString(data.updatedAt),
    messages: [],
  };
}

export function subscribeUserConversations(
  uid: string,
  isBootstrapAdmin: boolean,
  onUpdate: (items: Conversation[]) => void
): Unsubscribe {
  const mapById = new Map<string, Conversation>();
  const emit = () => {
    const sorted = Array.from(mapById.values()).sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
    onUpdate(sorted);
  };

  if (isBootstrapAdmin) {
    return onSnapshot(
      collection(db, 'conversations'),
      (snap) => {
        mapById.clear();
        snap.docs.forEach((d) => mapById.set(d.id, mapConversationDoc(d)));
        emit();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
    );
  }

  const unsubBuyer = onSnapshot(
    query(collection(db, 'conversations'), where('buyerId', '==', uid)),
    (snap) => {
      snap.docs.forEach((d) => mapById.set(d.id, mapConversationDoc(d)));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
  );

  const unsubSeller = onSnapshot(
    query(collection(db, 'conversations'), where('sellerId', '==', uid)),
    (snap) => {
      snap.docs.forEach((d) => mapById.set(d.id, mapConversationDoc(d)));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
  );

  return () => {
    unsubBuyer();
    unsubSeller();
  };
}

export function subscribeConversationMessages(
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe {
  const convId = sanitizeId(conversationId);
  const path = `conversations/${convId}/messages`;
  return onSnapshot(
    collection(db, 'conversations', convId, 'messages'),
    (snap) => {
      const msgs: ChatMessage[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            senderId: String(data.senderId ?? ''),
            senderName: String(data.senderName ?? 'User'),
            text: String(data.text ?? ''),
            type: (data.type as ChatMessage['type']) || 'text',
            offerAmount: data.offerAmount !== undefined ? Number(data.offerAmount) : undefined,
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      onUpdate(msgs);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createDealInFirestore(deal: AdminDeal): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(deal.id);
  const path = `deals/${id}`;
  try {
    await setDoc(doc(db, 'deals', id), {
      id,
      title: clampText(deal.title, BLUEPRINT_LIMITS.TITLE_MAX),
      conversationId: sanitizeId(deal.conversationId),
      listingId: sanitizeId(deal.listingId),
      listingTitle: clampText(deal.listingTitle, BLUEPRINT_LIMITS.TITLE_MAX),
      listingImage: sanitizeImageUrl(deal.listingImage, ASSETS.efootballSquad),
      buyerId: sanitizeId(deal.buyerId),
      buyerName: clampText(deal.buyerName, BLUEPRINT_LIMITS.NAME_MAX, 'Buyer'),
      sellerId: sanitizeId(deal.sellerId),
      sellerName: clampText(deal.sellerName, BLUEPRINT_LIMITS.NAME_MAX, 'Seller'),
      adminId: sanitizeId(deal.adminId),
      adminName: clampText(deal.adminName, BLUEPRINT_LIMITS.NAME_MAX, 'Admin'),
      agreedAmount: clampPrice(deal.agreedAmount),
      serviceType: deal.serviceType,
      serviceFee: clampPrice(deal.serviceFee),
      buyerMethod: deal.buyerMethod,
      sellerMethod: deal.sellerMethod,
      crossDealRequired: Boolean(deal.crossDealRequired),
      crossDealAccepted: Boolean(deal.crossDealAccepted),
      crossDealFee: clampPrice(deal.crossDealFee),
      iosCheck: Boolean(deal.iosCheck),
      googleBindCheck: Boolean(deal.googleBindCheck),
      verificationFee: clampPrice(deal.verificationFee),
      totalAmount: clampPrice(deal.totalAmount),
      paymentContact: clampText(deal.paymentContact, 120),
      paymentProofNote: clampText(deal.paymentProofNote, BLUEPRINT_LIMITS.PROOF_NOTE_MAX),
      paymentProofUrl: sanitizeImageUrl(deal.paymentProofUrl, ''),
      buyerInitialDone: false,
      sellerExchanged: false,
      accountDetailsNote: '',
      status: 'confirming',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDealInFirestore(
  dealId: string,
  patch: Partial<Omit<AdminDeal, 'id' | 'createdAt' | 'updatedAt' | 'messages'>>
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(dealId);
  const path = `deals/${id}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (key === 'paymentProofNote') {
      payload[key] = clampText(String(val), BLUEPRINT_LIMITS.PROOF_NOTE_MAX);
    } else if (key === 'paymentProofUrl') {
      payload[key] = sanitizeImageUrl(String(val), '');
    } else if (key === 'accountDetailsNote') {
      payload[key] = clampText(String(val), BLUEPRINT_LIMITS.ACCOUNT_DETAILS_MAX);
    } else if (key === 'reviewComment') {
      payload[key] = clampText(String(val), BLUEPRINT_LIMITS.REVIEW_COMMENT_MAX);
    } else if (key === 'adminName') {
      payload[key] = clampText(String(val), BLUEPRINT_LIMITS.NAME_MAX);
    } else {
      payload[key] = val;
    }
  }

  try {
    await updateDoc(doc(db, 'deals', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function persistDealMessage(
  dealId: string,
  msg: ChatMessage
): Promise<void> {
  if (!auth.currentUser) return;
  const dId = sanitizeId(dealId);
  const msgId = sanitizeId(msg.id);
  const path = `deals/${dId}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'deals', dId, 'messages', msgId), {
      id: msgId,
      senderId: msg.senderId === 'system' ? 'system' : auth.currentUser.uid,
      senderName: clampText(msg.senderName, BLUEPRINT_LIMITS.NAME_MAX, 'User'),
      text: clampText(msg.text, BLUEPRINT_LIMITS.MESSAGE_MAX),
      type: msg.type,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function mapDealDoc(d: { id: string; data: () => Record<string, unknown> }): AdminDeal {
  const data = d.data();
  return {
    id: d.id,
    title: String(data.title ?? `${Number(data.agreedAmount ?? 0)} Deal`),
    conversationId: String(data.conversationId ?? ''),
    listingId: String(data.listingId ?? ''),
    listingTitle: String(data.listingTitle ?? 'Listing'),
    listingImage: sanitizeImageUrl(String(data.listingImage ?? ''), ASSETS.efootballSquad),
    buyerId: String(data.buyerId ?? ''),
    buyerName: String(data.buyerName ?? 'Buyer'),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Seller'),
    adminId: String(data.adminId ?? 'admin_abdur'),
    adminName: String(data.adminName ?? 'Abdur Rahman'),
    agreedAmount: Number(data.agreedAmount ?? 0),
    serviceType: (data.serviceType as AdminDeal['serviceType']) || 'pending',
    serviceFee: Number(data.serviceFee ?? 0),
    buyerMethod: (data.buyerMethod as AdminDeal['buyerMethod']) || 'pending',
    sellerMethod: (data.sellerMethod as AdminDeal['sellerMethod']) || 'pending',
    crossDealRequired: Boolean(data.crossDealRequired),
    crossDealAccepted: Boolean(data.crossDealAccepted),
    crossDealFee: Number(data.crossDealFee ?? 0),
    iosCheck: Boolean(data.iosCheck),
    googleBindCheck: Boolean(data.googleBindCheck),
    verificationFee: Number(data.verificationFee ?? 0),
    totalAmount: Number(data.totalAmount ?? data.agreedAmount ?? 0),
    paymentContact: String(data.paymentContact ?? '01755-842190 (DEALKORO Escrow)'),
    paymentProofNote: String(data.paymentProofNote ?? ''),
    paymentProofUrl: data.paymentProofUrl ? String(data.paymentProofUrl) : '',
    buyerInitialDone: Boolean(data.buyerInitialDone),
    sellerExchanged: Boolean(data.sellerExchanged),
    accountDetailsNote: String(data.accountDetailsNote ?? ''),
    reviewRating: data.reviewRating !== undefined ? Number(data.reviewRating) : undefined,
    reviewComment: data.reviewComment ? String(data.reviewComment) : undefined,
    status: (data.status as AdminDeal['status']) || 'confirming',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    messages: [],
  };
}

export function subscribeUserDeals(
  uid: string,
  isBootstrapAdmin: boolean,
  onUpdate: (deals: AdminDeal[]) => void
): Unsubscribe {
  const mapById = new Map<string, AdminDeal>();
  const emit = () => {
    const sorted = Array.from(mapById.values()).sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
    onUpdate(sorted);
  };

  if (isBootstrapAdmin) {
    return onSnapshot(
      collection(db, 'deals'),
      (snap) => {
        mapById.clear();
        snap.docs.forEach((d) => mapById.set(d.id, mapDealDoc(d)));
        emit();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'deals')
    );
  }

  const unsubBuyer = onSnapshot(
    query(collection(db, 'deals'), where('buyerId', '==', uid)),
    (snap) => {
      snap.docs.forEach((d) => mapById.set(d.id, mapDealDoc(d)));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'deals')
  );

  const unsubSeller = onSnapshot(
    query(collection(db, 'deals'), where('sellerId', '==', uid)),
    (snap) => {
      snap.docs.forEach((d) => mapById.set(d.id, mapDealDoc(d)));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'deals')
  );

  const unsubAdmin = onSnapshot(
    query(collection(db, 'deals'), where('adminId', '==', uid)),
    (snap) => {
      snap.docs.forEach((d) => mapById.set(d.id, mapDealDoc(d)));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'deals')
  );

  return () => {
    unsubBuyer();
    unsubSeller();
    unsubAdmin();
  };
}

export function subscribeDealMessages(
  dealId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe {
  const dId = sanitizeId(dealId);
  const path = `deals/${dId}/messages`;
  return onSnapshot(
    collection(db, 'deals', dId, 'messages'),
    (snap) => {
      const msgs: ChatMessage[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            senderId: String(data.senderId ?? ''),
            senderName: String(data.senderName ?? 'User'),
            text: String(data.text ?? ''),
            type: (data.type as ChatMessage['type']) || 'text',
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      onUpdate(msgs);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserNotifications(
  uid: string,
  isBootstrapAdmin: boolean,
  onUpdate: (items: NotificationItem[]) => void
): Unsubscribe {
  const q = isBootstrapAdmin
    ? collection(db, 'notifications')
    : query(collection(db, 'notifications'), where('recipientId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: NotificationItem[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            recipientId: String(data.recipientId ?? ''),
            actorName: String(data.actorName ?? 'DEALKORO'),
            message: String(data.message ?? ''),
            targetType: (data.targetType as NotificationItem['targetType']) || 'system',
            targetId: String(data.targetId ?? ''),
            isRead: Boolean(data.isRead),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onUpdate(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
  );
}

export async function persistNotificationToFirestore(
  notif: NotificationItem
): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(notif.id);
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      recipientId: sanitizeId(notif.recipientId),
      actorName: clampText(notif.actorName, BLUEPRINT_LIMITS.NAME_MAX, 'DEALKORO'),
      message: clampText(notif.message, BLUEPRINT_LIMITS.NOTIF_MESSAGE_MAX),
      targetType: notif.targetType,
      targetId: sanitizeId(notif.targetId),
      isRead: Boolean(notif.isRead),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationReadInFirestore(notifId: string): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(notifId);
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserStatements(
  uid: string,
  isBootstrapAdmin: boolean,
  onUpdate: (items: StatementEntry[]) => void
): Unsubscribe {
  const q = isBootstrapAdmin
    ? collection(db, 'statements')
    : query(collection(db, 'statements'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: StatementEntry[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? ''),
            dealId: String(data.dealId ?? ''),
            title: String(data.title ?? ''),
            type: (data.type as StatementEntry['type']) || 'sell_income',
            amount: Number(data.amount ?? 0),
            feeAmount: Number(data.feeAmount ?? 0),
            netAmount: Number(data.netAmount ?? 0),
            method: normalizePaymentMethod(String(data.method ?? 'bKash')),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onUpdate(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'statements')
  );
}

export async function persistStatementToFirestore(entry: StatementEntry): Promise<void> {
  if (!auth.currentUser) return;
  const id = sanitizeId(entry.id);
  const path = `statements/${id}`;
  try {
    await setDoc(doc(db, 'statements', id), {
      id,
      userId: sanitizeId(entry.userId),
      dealId: sanitizeId(entry.dealId),
      title: clampText(entry.title, BLUEPRINT_LIMITS.TITLE_MAX),
      type: entry.type,
      amount: clampPrice(entry.amount),
      feeAmount: clampPrice(entry.feeAmount),
      netAmount: clampPrice(entry.netAmount),
      method: normalizePaymentMethod(entry.method),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function compressImageToBoundedDataUrl(file: File): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  let sourceUrl = '';
  try {
    sourceUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = sourceUrl;
    });

    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || 640) * scale));
    const height = Math.max(1, Math.round((img.height || 360) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);

    const formats = ['image/webp', 'image/jpeg'];
    const qualities = [0.74, 0.58, 0.44, 0.32];
    for (const mime of formats) {
      for (const q of qualities) {
        const candidate = canvas.toDataURL(mime, q);
        if (
          candidate.startsWith(`data:${mime};base64,`) &&
          candidate.length <= BLUEPRINT_LIMITS.IMAGE_DATA_URL_MAX
        ) {
          return candidate;
        }
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

/**
 * Upload image file to Firebase Storage when available, and automatically fall back
 * to a bounded compressed image thumbnail (< 120 KB) when running on AI Studio Starter Tier.
 */
export async function uploadImageFile(
  folder: 'listings' | 'proofs',
  ownerId: string,
  file: File
): Promise<{ url?: string; error?: string; mode?: 'storage' | 'compressed' }> {
  if (!auth.currentUser) {
    return { error: 'Sign in with Google first to upload screenshots.' };
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'Please select an image file (PNG, JPG, or WebP).' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'Image must be smaller than 10 MB.' };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-48);
  const storageRef = ref(storage, `${folder}/${sanitizeId(ownerId)}/${Date.now()}_${safeName}`);

  try {
    const uploadTask = (async () => {
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    })();
    const timeoutGuard = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('storage_timeout')), 4000)
    );
    const url = await Promise.race([uploadTask, timeoutGuard]);
    if (url.length <= BLUEPRINT_LIMITS.URL_MAX) {
      return { url, mode: 'storage' };
    }
  } catch {
    // Starter Tier projects do not include Cloud Storage; fall back cleanly to compressed image
  }

  const compressed = await compressImageToBoundedDataUrl(file);
  if (compressed) {
    return { url: compressed, mode: 'compressed' };
  }

  return {
    error: 'Could not process this screenshot. Try a smaller JPG/PNG photo or paste an HTTPS link.',
  };
}
