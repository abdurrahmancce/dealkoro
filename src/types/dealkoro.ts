export type Language = 'en' | 'bn';

export type ThemeMode = 'light' | 'dark';

export type UserRole = 'user' | 'admin';

export type StaffRole = 'main_admin' | 'sub_admin' | 'moderator';

export type AdminIdType = 'NID' | 'Passport' | 'StudentID';

export type AuthTab = 'login' | 'signup' | 'admin';

export type LinkType =
  | 'Only Konami'
  | 'Konami + Glink'
  | 'Konami + iOSlink'
  | 'Gg Lost';

export type ListingCategory =
  | 'eFootball'
  | 'PUBG Mobile'
  | 'Free Fire'
  | 'Mobile Legends'
  | 'Other';

export type PaymentMethod = 'bKash' | 'Nagad';

export type DealServiceType = 'normal' | 'ultimate_safe';

export type DealStatus =
  | 'confirming'
  | 'finding_admin'
  | 'service_select'
  | 'payment_method'
  | 'cross_deal'
  | 'verification_checks'
  | 'cost_summary'
  | 'payment_instruction'
  | 'payment_received'
  | 'id_exchange'
  | 'review_prompt'
  | 'done'
  | 'cancelled';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  level: number;
  rating: number;
  sellCount: number;
  buyCount: number;
  joinedLabel: string;
  role: UserRole;
  staffRole?: StaffRole;
  payoutMethod: PaymentMethod;
  isDemo?: boolean;
}

export interface AdminVerificationBadges {
  emailVerified: boolean;
  mobileVerified: boolean;
  idVerified: boolean;
}

export interface AdminAgent {
  uid: string;
  name: string;
  verified: boolean;
  staffRole?: StaffRole;
  email?: string;
  phoneMasked?: string;
  idType?: AdminIdType;
  idLast4?: string;
  appointedBy?: string;
  inviteId?: string;
  verificationBadges?: AdminVerificationBadges;
  specialty: string;
  reviewNotes: string;
  completedDeals: number;
  rating: number;
}

export interface TeamVerificationInvite {
  id: string;
  candidateEmail: string;
  candidateName: string;
  candidatePhone: string;
  idType: AdminIdType;
  idLast4: string;
  staffRole: 'sub_admin' | 'moderator';
  specialty: string;
  verificationCode: string;
  status: 'pending' | 'verified' | 'revoked';
  createdBy: string;
  claimedUid?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewaySession {
  id: string;
  dealId: string;
  buyerId: string;
  method: PaymentMethod;
  amount: number;
  mode: 'live_api' | 'sandbox';
  status: 'initiated' | 'authorized' | 'verified' | 'failed' | 'expired';
  gatewayPaymentId: string;
  trxId?: string;
  senderMasked?: string;
  redirectUrl?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

export interface PlatformEscrowConfig {
  bkashNumber: string;
  nagadNumber: string;
  bkashAccountType?: 'Personal' | 'Merchant' | 'Agent';
  nagadAccountType?: 'Personal' | 'Merchant' | 'Agent';
  bkashPaymentLink?: string;
  nagadPaymentLink?: string;
  escrowLabel: string;
  announcement: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  category: ListingCategory;
  title: string;
  description: string;
  imageUrl: string;
  paidCount: string;
  linkType: LinkType;
  server: string;
  limitInfo: string;
  price: number;
  rating: number;
  status: 'active' | 'in_deal' | 'sold';
  createdAt: string;
}

export interface ListingComment {
  id: string;
  listingId: string;
  authorId: string;
  authorName: string;
  text: string;
  parentCommentId?: string;
  replyToAuthor?: string;
  likedBy?: string[];
  createdAt: string;
}

export interface SearchTermStat {
  id: string;
  term: string;
  normalizedTerm: string;
  searchCount: number;
  lastCategory?: 'All' | ListingCategory;
  lastResultCount?: number;
  lastSearchedBy?: string;
  lastSearchedAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'offer' | 'system' | 'proof' | 'account_details';
  offerAmount?: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  listingImage: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  lastMessage: string;
  unreadCount: number;
  negotiatedPrice: number;
  offerStatus: 'none' | 'offered' | 'accepted' | 'declined';
  dealId?: string;
  isSupport?: boolean;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AdminDeal {
  id: string;
  title: string;
  conversationId: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  adminId: string;
  adminName: string;
  agreedAmount: number;
  serviceType: DealServiceType | 'pending';
  serviceFee: number;
  buyerMethod: PaymentMethod | 'pending';
  sellerMethod: PaymentMethod | 'pending';
  crossDealRequired: boolean;
  crossDealAccepted: boolean;
  crossDealFee: number;
  iosCheck: boolean;
  googleBindCheck: boolean;
  verificationFee: number;
  totalAmount: number;
  paymentContact: string;
  paymentProofNote: string;
  paymentProofUrl?: string;
  buyerInitialDone: boolean;
  sellerExchanged: boolean;
  accountDetailsNote: string;
  reviewRating?: number;
  reviewComment?: string;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorName: string;
  message: string;
  targetType: 'listing' | 'deal' | 'conversation' | 'system';
  targetId: string;
  isRead: boolean;
  createdAt: string;
}

export interface StatementEntry {
  id: string;
  userId: string;
  dealId: string;
  title: string;
  type: 'sell_income' | 'buy_payment' | 'admin_fee_income';
  amount: number;
  feeAmount: number;
  netAmount: number;
  method: PaymentMethod;
  createdAt: string;
}

export type AppRoute =
  | { screen: 'home' }
  | { screen: 'search' }
  | { screen: 'notifications' }
  | { screen: 'profile' }
  | { screen: 'your_posts' }
  | { screen: 'personal_info' }
  | { screen: 'settings' }
  | { screen: 'security' }
  | { screen: 'statement' }
  | { screen: 'bookmarks' }
  | { screen: 'help' }
  | { screen: 'create_post' }
  | { screen: 'post_detail'; listingId: string }
  | { screen: 'admin_queue' }
  | { screen: 'admin_dashboard' }
  | { screen: 'admin_detail'; adminId: string }
  | { screen: 'inbox' }
  | { screen: 'chat'; conversationId: string }
  | { screen: 'deal'; dealId: string };
