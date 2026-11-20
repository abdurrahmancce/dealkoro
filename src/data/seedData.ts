import type {
  AdminAgent,
  AdminDeal,
  Conversation,
  Listing,
  ListingComment,
  NotificationItem,
  StatementEntry,
  UserProfile,
} from '../types/dealkoro';

export const ASSETS = {
  promoBanner: '/src/assets/images/promo_banner_dealkoro_1795012503417.jpg',
  efootballSquad: '/src/assets/images/listing_efootball_squad_1795012504882.jpg',
  efootballLegends: '/src/assets/images/listing_efootball_legends_1795012504380.jpg',
  pubgAccount: '/src/assets/images/listing_pubg_account_1795012504255.jpg',
  ninjaAvatar: '/src/assets/images/avatar_ninja_pro_1795012504780.jpg',
} as const;

export const LEGACY_DEMO_LISTING_IDS = [
  'listing_ronaldo_3250',
  'listing_eto_3259',
  'listing_rummi_neymar',
  'listing_romario_3100',
  'listing_pubg_glacier',
] as const;

export const LEGACY_DEMO_COMMENT_PATHS: ReadonlyArray<{ listingId: string; commentId: string }> = [
  { listingId: 'listing_rummi_neymar', commentId: 'cmt_1' },
  { listingId: 'listing_rummi_neymar', commentId: 'cmt_2' },
];

export const LEGACY_DEMO_CONVERSATION_IDS = ['conv_salim_rummi', 'conv_support'] as const;

export const LEGACY_DEMO_DEAL_IDS = ['deal_1400_sample', 'deal_2000_active'] as const;

export const LEGACY_DEMO_NOTIFICATION_IDS = ['notif_1', 'notif_2', 'notif_3'] as const;

export const LEGACY_DEMO_STATEMENT_IDS = ['stmt_1', 'stmt_2', 'stmt_3'] as const;

export const LEGACY_REMOVED_ADMIN_IDS = ['admin_shanto', 'admin_sunny', 'admin_ovi'] as const;

export const DEMO_USERS: Record<'seller' | 'buyer' | 'admin', UserProfile> = {
  seller: {
    uid: 'user_abdullah',
    displayName: 'Abdullah',
    email: 'junaiedahmeds44@gmail.com',
    phone: '',
    avatarUrl: '',
    level: 1,
    rating: 5.0,
    sellCount: 0,
    buyCount: 0,
    joinedLabel: '2026',
    role: 'user',
    payoutMethod: 'bKash',
    isDemo: true,
  },
  buyer: {
    uid: 'user_salim',
    displayName: 'Salim Khan',
    email: 'salim.khan@dealkoro.app',
    phone: '',
    avatarUrl: '',
    level: 1,
    rating: 5.0,
    sellCount: 0,
    buyCount: 0,
    joinedLabel: '2026',
    role: 'user',
    payoutMethod: 'Nagad',
    isDemo: true,
  },
  admin: {
    uid: 'admin_abdur',
    displayName: 'Abdur Rahman',
    email: 'akash.abdur.2002@gmail.com',
    phone: '',
    avatarUrl: '',
    level: 1,
    rating: 5.0,
    sellCount: 0,
    buyCount: 0,
    joinedLabel: '2026',
    role: 'admin',
    staffRole: 'main_admin',
    payoutMethod: 'bKash',
    isDemo: true,
  },
};

export const SEED_ADMINS: AdminAgent[] = [
  {
    uid: 'admin_abdur',
    name: 'Abdur Rahman',
    verified: true,
    staffRole: 'main_admin',
    email: 'akash.abdur.2002@gmail.com',
    phoneMasked: '019****9900',
    idType: 'NID',
    idLast4: '9001',
    verificationBadges: {
      emailVerified: true,
      mobileVerified: true,
      idVerified: true,
    },
    specialty: 'Main Project Admin · eFootball & Konami / iOS Bind Escrow',
    reviewNotes:
      'Main Project Admin & senior escrow mediator. Verifies Konami ID unlink, Game Center / iOS bind status, and oversees Sub-Admins & Moderators.',
    completedDeals: 0,
    rating: 5.0,
  },
];

export const SEED_LISTINGS: Listing[] = [];

export const SEED_COMMENTS: ListingComment[] = [];

export const SEED_CONVERSATIONS: Conversation[] = [];

export const SEED_DEALS: AdminDeal[] = [];

export const SEED_NOTIFICATIONS: NotificationItem[] = [];

export const SEED_STATEMENTS: StatementEntry[] = [];
