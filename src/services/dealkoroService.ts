import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase/config';
import type {
  AdminAgent,
  AdminDeal,
  Conversation,
  DealServiceType,
  Language,
  Listing,
  ListingCategory,
  ListingComment,
  LinkType,
  NotificationItem,
  PaymentMethod,
  StatementEntry,
  UserProfile,
} from '../types/dealkoro';
import {
  ASSETS,
  DEMO_USERS,
  SEED_ADMINS,
  SEED_COMMENTS,
  SEED_CONVERSATIONS,
  SEED_DEALS,
  SEED_LISTINGS,
  SEED_NOTIFICATIONS,
  SEED_STATEMENTS,
} from '../data/seedData';
import { calculateDealBreakdown } from '../utils/dealMath';

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
}

const STORAGE_KEY = 'dealkoro_app_state_v1';

export function getInitialState(): DealkoroPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DealkoroPersistedState>;
      return {
        currentUser: parsed.currentUser ?? null,
        language: parsed.language === 'bn' ? 'bn' : 'en',
        listings: parsed.listings?.length ? parsed.listings : SEED_LISTINGS,
        comments: parsed.comments?.length ? parsed.comments : SEED_COMMENTS,
        admins: parsed.admins?.length ? parsed.admins : SEED_ADMINS,
        conversations: parsed.conversations?.length
          ? parsed.conversations
          : SEED_CONVERSATIONS,
        deals: parsed.deals?.length ? parsed.deals : SEED_DEALS,
        notifications: parsed.notifications?.length
          ? parsed.notifications
          : SEED_NOTIFICATIONS,
        statements: parsed.statements?.length
          ? parsed.statements
          : SEED_STATEMENTS,
        bookmarks: parsed.bookmarks ?? ['listing_ronaldo_3250'],
      };
    }
  } catch {
    // Fallback to clean seed state if localStorage is unavailable or corrupt
  }

  return {
    currentUser: null,
    language: 'en',
    listings: SEED_LISTINGS,
    comments: SEED_COMMENTS,
    admins: SEED_ADMINS,
    conversations: SEED_CONVERSATIONS,
    deals: SEED_DEALS,
    notifications: SEED_NOTIFICATIONS,
    statements: SEED_STATEMENTS,
    bookmarks: ['listing_ronaldo_3250'],
  };
}

export function savePersistedState(state: DealkoroPersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function createDemoAccount(params: {
  name: string;
  identifier: string;
  role: 'user' | 'admin';
}): UserProfile {
  const cleanId = params.identifier.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'member';
  const uid = `${params.role}_${cleanId}_${Date.now().toString(36)}`;
  const isEmail = params.identifier.includes('@');
  return {
    uid,
    displayName: params.name.trim() || (params.role === 'admin' ? 'Verified Admin' : 'DEALKORO Trader'),
    email: isEmail ? params.identifier.trim() : `${cleanId}@dealkoro.app`,
    phone: isEmail ? '+880 1700-000000' : params.identifier.trim(),
    avatarUrl: ASSETS.ninjaAvatar,
    level: params.role === 'admin' ? 20 : 1,
    rating: 5.0,
    sellCount: 0,
    buyCount: 0,
    joinedLabel: 'Nov 2026',
    role: params.role,
    payoutMethod: 'bKash',
    isDemo: true,
  };
}

export function buildNewListing(params: {
  seller: UserProfile;
  title: string;
  description: string;
  category: ListingCategory;
  imageUrl: string;
  paidCount: string;
  linkType: LinkType;
  server: string;
  limitInfo: string;
  price: number;
}): Listing {
  const id = `listing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    sellerId: params.seller.uid,
    sellerName: params.seller.displayName,
    category: params.category,
    title: params.title.trim(),
    description: params.description.trim() || `${params.category} account · ${params.linkType}`,
    imageUrl: params.imageUrl || ASSETS.efootballSquad,
    paidCount: params.paidCount.trim() || '4',
    linkType: params.linkType,
    server: params.server.trim() || 'Bangladesh',
    limitInfo: params.limitInfo.trim() || '7',
    price: params.price,
    rating: 5.0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

export function buildNewDealFromConversation(params: {
  conversation: Conversation;
  agreedAmount: number;
}): AdminDeal {
  const id = `deal_${Date.now().toString(36)}`;
  const assignedAdmin = SEED_ADMINS[1]; // NM SHANTO as in Screen 18
  return {
    id,
    title: `${params.agreedAmount} Deal`,
    conversationId: params.conversation.id,
    listingId: params.conversation.listingId,
    listingTitle: params.conversation.listingTitle,
    listingImage: params.conversation.listingImage,
    buyerId: params.conversation.buyerId,
    buyerName: params.conversation.buyerName,
    sellerId: params.conversation.sellerId,
    sellerName: params.conversation.sellerName,
    adminId: assignedAdmin.uid,
    adminName: assignedAdmin.name,
    agreedAmount: params.agreedAmount,
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
    totalAmount: params.agreedAmount,
    paymentContact: '01755-842190 (DEALKORO Escrow)',
    paymentProofNote: '',
    buyerInitialDone: false,
    sellerExchanged: false,
    accountDetailsNote: '',
    status: 'confirming',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `dm_init_${Date.now()}`,
        senderId: 'system',
        senderName: 'DEALKORO',
        text: `This is the automated group chat for ${assignedAdmin.name}, ${params.conversation.sellerName.split(' ')[0]} and ${params.conversation.buyerName.split(' ')[0]}.`,
        type: 'system',
        createdAt: new Date().toISOString(),
      },
      {
        id: `dm_admin_${Date.now() + 1}`,
        senderId: assignedAdmin.uid,
        senderName: `${assignedAdmin.name} ✓`,
        text: 'Hello, this is admin.',
        type: 'text',
        createdAt: new Date().toISOString(),
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
 * Sync helper: when user authenticates via real Firebase Google Sign-In,
 * mirrors profile, listings, and deals to Firestore safely with handleFirestoreError.
 */
export async function syncFirebaseUserProfile(user: UserProfile): Promise<void> {
  if (!auth.currentUser || user.isDemo) return;
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || '',
        level: user.level,
        rating: user.rating,
        sellCount: user.sellCount,
        buyCount: user.buyCount,
        joinedLabel: user.joinedLabel,
        role: user.role,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, 'users', user.uid, 'private', 'info'),
      {
        uid: user.uid,
        email: user.email,
        phone: user.phone,
        payoutMethod: user.payoutMethod,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function persistListingToFirestore(listing: Listing): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== listing.sellerId) return;
  const path = `listings/${listing.id}`;
  try {
    await setDoc(doc(db, 'listings', listing.id), {
      id: listing.id,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      category: listing.category,
      title: listing.title,
      description: listing.description,
      imageUrl: listing.imageUrl,
      paidCount: listing.paidCount,
      linkType: listing.linkType,
      server: listing.server,
      limitInfo: listing.limitInfo,
      price: listing.price,
      rating: listing.rating,
      status: listing.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeFirebaseListings(
  onUpdate: (items: Listing[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'listings'),
    where('status', 'in', ['active', 'in_deal', 'sold']),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const remote: Listing[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sellerId: String(data.sellerId ?? ''),
          sellerName: String(data.sellerName ?? 'Trader'),
          category: (data.category as ListingCategory) || 'eFootball',
          title: String(data.title ?? ''),
          description: String(data.description ?? ''),
          imageUrl: String(data.imageUrl ?? ASSETS.efootballSquad),
          paidCount: String(data.paidCount ?? '4'),
          linkType: (data.linkType as LinkType) || 'Only Konami',
          server: String(data.server ?? 'Bangladesh'),
          limitInfo: String(data.limitInfo ?? '7'),
          price: Number(data.price ?? 0),
          rating: Number(data.rating ?? 5),
          status: (data.status as Listing['status']) || 'active',
          createdAt: new Date().toISOString(),
        };
      });
      if (remote.length > 0) {
        onUpdate(remote);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    }
  );
}

export async function updateDealServiceInFirestore(
  dealId: string,
  serviceType: DealServiceType,
  serviceFee: number,
  totalAmount: number
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `deals/${dealId}`;
  try {
    await updateDoc(doc(db, 'deals', dealId), {
      serviceType,
      serviceFee,
      totalAmount,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Local/demo deal IDs may not exist in Firestore yet; ignore when demo-originated
  }
}

export { DEMO_USERS };
