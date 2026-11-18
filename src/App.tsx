import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type {
  AdminAgent,
  AdminDeal,
  AppRoute,
  ChatMessage,
  Conversation,
  Language,
  Listing,
  NotificationItem,
  PlatformEscrowConfig,
  StatementEntry,
  ThemeMode,
} from './types/dealkoro';
import {
  auth,
  googleProvider,
  testFirestoreConnection,
} from './firebase/config';
import { ASSETS } from './data/seedData';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  buildNewDealFromConversation,
  createDealInFirestore,
  deleteAdminAgentFromFirestore,
  deleteListingFromFirestore,
  ensureVerifiedAdminsInFirestore,
  getInitialState,
  getInitialTheme,
  markNotificationReadInFirestore,
  persistAdminAgentToFirestore,
  persistCommentToFirestore,
  persistConversationMessage,
  persistConversationToFirestore,
  persistDealMessage,
  persistListingToFirestore,
  persistNotificationToFirestore,
  persistPlatformEscrowConfig,
  persistStatementToFirestore,
  resolveUserProfileFromFirebase,
  saveLocalPreferences,
  saveThemePreference,
  subscribeConversationMessages,
  subscribeDealMessages,
  subscribeFirebaseAdmins,
  subscribeFirebaseListings,
  subscribeListingComments,
  subscribePlatformEscrowConfig,
  subscribeUserConversations,
  subscribeUserDeals,
  subscribeUserNotifications,
  subscribeUserStatements,
  syncFirebaseUserProfile,
  updateConversationInFirestore,
  updateDealInFirestore,
  updateListingStatusInFirestore,
  type DealkoroPersistedState,
} from './services/dealkoroService';
import { calculateDealBreakdown } from './utils/dealMath';
import { AuthScreen } from './components/AuthScreen';
import { AppShell } from './components/AppShell';
import { HomeFeedScreen } from './components/HomeFeedScreen';
import { SearchScreen } from './components/SearchScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { CreatePostScreen } from './components/CreatePostScreen';
import { PostDetailScreen } from './components/PostDetailScreen';
import { AdminQueueScreen } from './components/AdminQueueScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { InboxScreen } from './components/InboxScreen';
import { ChatScreen } from './components/ChatScreen';
import { DealRoomScreen } from './components/DealRoomScreen';
import { t } from './i18n/translations';

export default function App() {
  const [state, setState] = useState<DealkoroPersistedState>(() =>
    getInitialState()
  );
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [authResolved, setAuthResolved] = useState(false);
  const [routeStack, setRouteStack] = useState<AppRoute[]>([{ screen: 'home' }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const currentRoute = routeStack[routeStack.length - 1];

  useEffect(() => {
    saveLocalPreferences(state.language, state.bookmarks);
  }, [state.language, state.bookmarks]);

  useEffect(() => {
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    void testFirestoreConnection();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setState((prev) => ({ ...prev, currentUser: null }));
        setAuthResolved(true);
        return;
      }

      try {
        const profile = await resolveUserProfileFromFirebase(fbUser);
        setState((prev) => ({ ...prev, currentUser: profile }));
        setRouteStack((prev) => {
          if (prev.length === 1 && prev[0].screen === 'home' && profile.role === 'admin') {
            return [{ screen: 'admin_dashboard' }];
          }
          return prev;
        });
        await syncFirebaseUserProfile(profile).catch(() => {});
        await ensureVerifiedAdminsInFirestore(profile).catch(() => {});
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to load verified Firebase profile.'
        );
      } finally {
        setAuthResolved(true);
      }
    });

    return () => unsubAuth();
  }, []);

  // Full real-time Firestore subscriptions when signed in
  useEffect(() => {
    const activeUser = state.currentUser;
    if (!activeUser) return;
    const isBootstrapAdmin = activeUser.email === BOOTSTRAP_ADMIN_EMAIL;

    const unsubAdmins = subscribeFirebaseAdmins((remoteAdmins) => {
      setState((prev) => ({ ...prev, admins: remoteAdmins }));
    });

    const unsubListings = subscribeFirebaseListings((remoteListings) => {
      setState((prev) => ({ ...prev, listings: remoteListings }));
    });

    const unsubConvs = subscribeUserConversations(
      activeUser.uid,
      isBootstrapAdmin,
      (remoteConvs) => {
        setState((prev) => {
          const existingMsgMap = new Map(
            prev.conversations.map((c) => [c.id, c.messages])
          );
          const merged = remoteConvs.map((rc) => ({
            ...rc,
            messages: existingMsgMap.get(rc.id) ?? rc.messages,
          }));
          return { ...prev, conversations: merged };
        });
      }
    );

    const unsubDeals = subscribeUserDeals(
      activeUser.uid,
      isBootstrapAdmin,
      (remoteDeals) => {
        setState((prev) => {
          const existingMsgMap = new Map(
            prev.deals.map((d) => [d.id, d.messages])
          );
          const merged = remoteDeals.map((rd) => ({
            ...rd,
            messages: existingMsgMap.get(rd.id) ?? rd.messages,
          }));
          return { ...prev, deals: merged };
        });
      }
    );

    const unsubNotifs = subscribeUserNotifications(
      activeUser.uid,
      isBootstrapAdmin,
      (remoteNotifs) => {
        setState((prev) => ({ ...prev, notifications: remoteNotifs }));
      }
    );

    const unsubStatements = subscribeUserStatements(
      activeUser.uid,
      isBootstrapAdmin,
      (remoteStatements) => {
        setState((prev) => ({ ...prev, statements: remoteStatements }));
      }
    );

    const unsubConfig = subscribePlatformEscrowConfig((remoteCfg) => {
      setState((prev) => ({ ...prev, platformConfig: remoteCfg }));
    });

    return () => {
      unsubAdmins();
      unsubListings();
      unsubConvs();
      unsubDeals();
      unsubNotifs();
      unsubStatements();
      unsubConfig();
    };
  }, [state.currentUser?.uid, state.currentUser?.email]);

  // Subcollection real-time listeners for active detail / chat / deal screens
  useEffect(() => {
    if (!state.currentUser) return;

    if (currentRoute.screen === 'post_detail') {
      const targetId = currentRoute.listingId;
      return subscribeListingComments(targetId, (remoteComments) => {
        setState((prev) => ({
          ...prev,
          comments: [
            ...prev.comments.filter((c) => c.listingId !== targetId),
            ...remoteComments,
          ],
        }));
      });
    }

    if (currentRoute.screen === 'chat') {
      const convId = currentRoute.conversationId;
      return subscribeConversationMessages(convId, (remoteMsgs) => {
        setState((prev) => ({
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === convId && remoteMsgs.length > 0
              ? { ...c, messages: remoteMsgs }
              : c
          ),
        }));
      });
    }

    if (currentRoute.screen === 'deal') {
      const dealId = currentRoute.dealId;
      return subscribeDealMessages(dealId, (remoteMsgs) => {
        setState((prev) => ({
          ...prev,
          deals: prev.deals.map((d) =>
            d.id === dealId && remoteMsgs.length > 0
              ? { ...d, messages: remoteMsgs }
              : d
          ),
        }));
      });
    }

    return undefined;
  }, [state.currentUser?.uid, currentRoute]);

  const navigateTo = (next: AppRoute) => {
    setSyncNotice(null);
    setRouteStack((prev) => {
      const topLevel = [
        'home',
        'profile',
        'create_post',
        'admin_queue',
        'admin_dashboard',
        'inbox',
      ];
      if (topLevel.includes(next.screen)) {
        return [next];
      }
      return [...prev, next];
    });
  };

  const goBack = () => {
    setSyncNotice(null);
    setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleToggleLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const handleToggleTheme = (next?: ThemeMode) => {
    setTheme((prev) => next ?? (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in could not complete in this preview window.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    setState((prev) => ({ ...prev, currentUser: null }));
    setRouteStack([{ screen: 'home' }]);
    setSyncNotice(null);
  };

  const reportSyncError = (fallbackMsg: string) => {
    setSyncNotice(fallbackMsg);
  };

  if (!authResolved) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
          Verifying Firebase session...
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
    return (
      <AuthScreen
        language={state.language}
        theme={theme}
        onToggleLanguage={handleToggleLanguage}
        onToggleTheme={handleToggleTheme}
        onGoogleSignIn={handleGoogleSignIn}
        googleLoading={googleLoading}
        authError={authError}
      />
    );
  }

  const user = state.currentUser;

  const handleToggleBookmark = (listingId: string) => {
    setState((prev) => {
      const exists = prev.bookmarks.includes(listingId);
      return {
        ...prev,
        bookmarks: exists
          ? prev.bookmarks.filter((id) => id !== listingId)
          : [...prev.bookmarks, listingId],
      };
    });
  };

  const handleCreatePost = (listing: Listing) => {
    setState((prev) => ({
      ...prev,
      listings: [listing, ...prev.listings],
    }));
    void persistListingToFirestore(listing).catch(() =>
      reportSyncError('Could not save listing to Firestore. Verify your Google account is verified.')
    );
    navigateTo({ screen: 'post_detail', listingId: listing.id });
  };

  const handleDeleteListing = (listingId: string) => {
    const target = state.listings.find((l) => l.id === listingId);
    if (!target) return;
    if (target.sellerId !== user.uid && user.role !== 'admin') {
      reportSyncError('Only the listing owner or a verified Admin can delete this post.');
      return;
    }
    setState((prev) => ({
      ...prev,
      listings: prev.listings.filter((l) => l.id !== listingId),
      bookmarks: prev.bookmarks.filter((id) => id !== listingId),
    }));
    void deleteListingFromFirestore(listingId).catch(() =>
      reportSyncError('Could not remove listing from Firestore.')
    );
    setRouteStack([{ screen: 'home' }]);
  };

  const handleOpenOrCreateChatForListing = (listing: Listing) => {
    const existing = state.conversations.find(
      (c) =>
        !c.isSupport &&
        c.listingId === listing.id &&
        (c.buyerId === user.uid || c.sellerId === user.uid)
    );
    if (existing) {
      navigateTo({ screen: 'chat', conversationId: existing.id });
      return;
    }

    const now = new Date().toISOString();
    const firstMsg: ChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: `Hi, I am interested in ${listing.title} (${listing.linkType}).`,
      type: 'text',
      createdAt: now,
    };

    const newConv: Conversation = {
      id: `conv_${Date.now().toString(36)}`,
      listingId: listing.id,
      listingTitle: listing.title,
      listingPrice: listing.price,
      listingImage: listing.imageUrl,
      buyerId: user.uid === listing.sellerId ? 'user_salim' : user.uid,
      buyerName: user.uid === listing.sellerId ? 'Salim Khan' : user.displayName,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      lastMessage: firstMsg.text,
      unreadCount: 0,
      negotiatedPrice: listing.price,
      offerStatus: 'none',
      updatedAt: now,
      messages: [firstMsg],
    };

    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
    }));
    void persistConversationToFirestore(newConv)
      .then(() => persistConversationMessage(newConv.id, firstMsg))
      .catch(() =>
        reportSyncError(
          'Sample preview listing is local-only. Create a live post to start a multi-device Firestore deal.'
        )
      );
    navigateTo({ screen: 'chat', conversationId: newConv.id });
  };

  const handleMessageAdmin = (admin: AdminAgent) => {
    const existing = state.conversations.find(
      (c) => c.isSupport && c.sellerId === admin.uid && c.buyerId === user.uid
    );
    if (existing) {
      navigateTo({ screen: 'chat', conversationId: existing.id });
      return;
    }
    const now = new Date().toISOString();
    const introMsg: ChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: `Hello ${admin.name}, I would like escrow verification help.`,
      type: 'text',
      createdAt: now,
    };
    const newConv: Conversation = {
      id: `conv_admin_${Date.now().toString(36)}`,
      listingId: 'admin_support',
      listingTitle: `Verified Admin: ${admin.name}`,
      listingPrice: 0,
      listingImage: ASSETS.promoBanner,
      buyerId: user.uid,
      buyerName: user.displayName,
      sellerId: admin.uid,
      sellerName: admin.name,
      lastMessage: introMsg.text,
      unreadCount: 0,
      negotiatedPrice: 0,
      offerStatus: 'none',
      isSupport: true,
      updatedAt: now,
      messages: [introMsg],
    };
    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
    }));
    void persistConversationToFirestore(newConv)
      .then(() => persistConversationMessage(newConv.id, introMsg))
      .catch(() => {});
    navigateTo({ screen: 'chat', conversationId: newConv.id });
  };

  const handleAddComment = (listingId: string, text: string) => {
    const target = state.listings.find((l) => l.id === listingId);
    const now = new Date().toISOString();
    const newComment = {
      id: `cmt_${Date.now().toString(36)}`,
      listingId,
      authorId: user.uid,
      authorName: user.displayName,
      text,
      createdAt: now,
    };
    const newNotif: NotificationItem | null = target
      ? {
          id: `notif_${Date.now().toString(36)}`,
          recipientId: target.sellerId,
          actorName: user.displayName,
          message: `Commented on your post: ${target.title}`,
          targetType: 'listing',
          targetId: listingId,
          isRead: false,
          createdAt: now,
        }
      : null;

    setState((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
      notifications: newNotif
        ? [newNotif, ...prev.notifications]
        : prev.notifications,
    }));

    void persistCommentToFirestore(newComment).catch(() =>
      reportSyncError('Sample listing comments stay local; live posts sync across devices.')
    );
    if (newNotif) {
      void persistNotificationToFirestore(newNotif).catch(() => {});
    }
  };

  const handleSendChatMessage = (conversationId: string, text: string) => {
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: `m_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text,
      type: 'text',
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: text,
              unreadCount: 0,
              updatedAt: now,
              messages: [...c.messages, msg],
            }
          : c
      ),
    }));
    void persistConversationMessage(conversationId, msg).catch(() => {});
    void updateConversationInFirestore(conversationId, {
      lastMessage: text,
      unreadCount: 0,
    }).catch(() => {});
  };

  const handleProposeOffer = (conversationId: string, amount: number) => {
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: `m_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: `${amount} PLS`,
      type: 'offer',
      offerAmount: amount,
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              negotiatedPrice: amount,
              offerStatus: 'offered',
              lastMessage: `${amount} PLS`,
              updatedAt: now,
              messages: [...c.messages, msg],
            }
          : c
      ),
    }));
    void persistConversationMessage(conversationId, msg).catch(() => {});
    void updateConversationInFirestore(conversationId, {
      negotiatedPrice: amount,
      offerStatus: 'offered',
      lastMessage: `${amount} PLS`,
    }).catch(() => {});
  };

  const handleRespondOffer = (conversationId: string, accept: boolean) => {
    const target = state.conversations.find((c) => c.id === conversationId);
    if (!target) return;
    const now = new Date().toISOString();
    const sysText = accept
      ? `${target.sellerName.split(' ')[0]} accepted Tk ${target.negotiatedPrice.toLocaleString('en-US')}`
      : 'Price offer declined';
    const msg: ChatMessage = {
      id: `m_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: sysText,
      type: 'system',
      createdAt: now,
    };
    const nextOfferStatus = accept ? 'accepted' : 'declined';

    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              offerStatus: nextOfferStatus,
              lastMessage: sysText,
              updatedAt: now,
              messages: [...c.messages, msg],
            }
          : c
      ),
    }));
    void persistConversationMessage(conversationId, msg).catch(() => {});
    void updateConversationInFirestore(conversationId, {
      offerStatus: nextOfferStatus,
      lastMessage: sysText,
    }).catch(() => {});
  };

  const handleRequestAdminDeal = (conversation: Conversation) => {
    const selectedAdmin = state.admins[0];
    const newDeal = buildNewDealFromConversation({
      conversation,
      agreedAmount: conversation.negotiatedPrice || conversation.listingPrice,
      selectedAdmin,
      platformConfig: state.platformConfig,
    });
    const initMsg: ChatMessage = {
      ...newDeal.messages[0],
      senderId: user.uid,
      senderName: user.displayName,
    };
    const dealForState: AdminDeal = {
      ...newDeal,
      messages: [initMsg],
    };

    setState((prev) => ({
      ...prev,
      deals: [dealForState, ...prev.deals],
      conversations: prev.conversations.map((c) =>
        c.id === conversation.id ? { ...c, dealId: dealForState.id } : c
      ),
    }));

    void createDealInFirestore(dealForState)
      .then(() => persistDealMessage(dealForState.id, initMsg))
      .then(() =>
        updateConversationInFirestore(conversation.id, { dealId: dealForState.id })
      )
      .catch(() => {});

    const targetListing = state.listings.find((l) => l.id === conversation.listingId);
    if (
      targetListing &&
      (targetListing.sellerId === user.uid || user.role === 'admin')
    ) {
      void updateListingStatusInFirestore(targetListing.id, 'in_deal').catch(() => {});
    }

    navigateTo({ screen: 'deal', dealId: dealForState.id });
  };

  const handleUpdateDeal = (
    updated: AdminDeal,
    firestorePatch?: Partial<AdminDeal>
  ) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => (d.id === updated.id ? updated : d)),
    }));
    if (firestorePatch) {
      void updateDealInFirestore(updated.id, firestorePatch).catch(() =>
        reportSyncError(
          'Deal action was blocked by Firestore security rules. Only an Admin can verify payment or release payouts.'
        )
      );
    }
  };

  const handleSendDealGroupMessage = (deal: AdminDeal, text: string) => {
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: `dm_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text,
      type: 'text',
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === deal.id
          ? { ...d, messages: [...d.messages, msg], updatedAt: now }
          : d
      ),
    }));
    void persistDealMessage(deal.id, msg).catch(() => {});
  };

  const handleVerifyPayment = (dealId: string) => {
    if (user.role !== 'admin') {
      reportSyncError('Only verified Admins can confirm payment receipt.');
      return;
    }
    const targetDeal = state.deals.find((d) => d.id === dealId);
    if (!targetDeal) return;
    const now = new Date().toISOString();
    const verifyMsg: ChatMessage = {
      id: `dm_verify_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: `Payment verified by Admin (${user.displayName}). ID Exchange is now unlocked.`,
      type: 'system',
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              buyerInitialDone: true,
              status: 'id_exchange',
              updatedAt: now,
              messages: [...d.messages, verifyMsg],
            }
          : d
      ),
    }));

    void updateDealInFirestore(dealId, {
      buyerInitialDone: true,
      status: 'id_exchange',
    }).catch(() =>
      reportSyncError('Could not verify payment in Firestore.')
    );
    void persistDealMessage(dealId, verifyMsg).catch(() => {});
  };

  const handleCompleteReview = (
    dealId: string,
    rating: number,
    comment: string
  ) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              reviewRating: rating,
              reviewComment: comment,
              updatedAt: now,
            }
          : d
      ),
    }));
    void updateDealInFirestore(dealId, {
      reviewRating: rating,
      reviewComment: comment,
    }).catch(() =>
      reportSyncError('Could not save review feedback to Firestore.')
    );
  };

  const handleReassignAdmin = (dealId: string, adminId: string) => {
    if (user.role !== 'admin') return;
    const targetAdmin = state.admins.find((a) => a.uid === adminId);
    if (!targetAdmin) return;
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: `dm_reassign_${Date.now().toString(36)}`,
      senderId: user.uid,
      senderName: user.displayName,
      text: `${targetAdmin.name} assigned as escrow mediator.`,
      type: 'system',
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              adminId: targetAdmin.uid,
              adminName: targetAdmin.name,
              updatedAt: now,
              messages: [...d.messages, msg],
            }
          : d
      ),
    }));
    void updateDealInFirestore(dealId, {
      adminId: targetAdmin.uid,
      adminName: targetAdmin.name,
    }).catch(() => {});
    void persistDealMessage(dealId, msg).catch(() => {});
  };

  const handleReleasePayout = (dealId: string) => {
    if (user.role !== 'admin') {
      reportSyncError('Only verified Admins can release payouts.');
      return;
    }
    const targetDeal = state.deals.find((d) => d.id === dealId);
    if (!targetDeal || targetDeal.status === 'done') return;

    const breakdown = calculateDealBreakdown({
      agreedAmount: targetDeal.agreedAmount,
      serviceType: targetDeal.serviceType,
      buyerMethod: targetDeal.buyerMethod,
      sellerMethod: targetDeal.sellerMethod,
      crossDealAccepted: targetDeal.crossDealAccepted,
      iosCheck: targetDeal.iosCheck,
      googleBindCheck: targetDeal.googleBindCheck,
    });

    const sellerPayoutMethod =
      targetDeal.sellerMethod !== 'pending' ? targetDeal.sellerMethod : 'bKash';
    const buyerPayMethod =
      targetDeal.buyerMethod !== 'pending' ? targetDeal.buyerMethod : 'Nagad';
    const now = new Date().toISOString();
    const stamp = Date.now().toString(36);
    const finalRating = targetDeal.reviewRating ?? 5;
    const finalComment =
      targetDeal.reviewComment || 'Escrow verified and payout released by admin.';

    const newStatements: StatementEntry[] = [
      {
        id: `stmt_sell_${stamp}`,
        userId: targetDeal.sellerId,
        dealId: targetDeal.id,
        title: `Sold: ${targetDeal.listingTitle} (${targetDeal.title})`,
        type: 'sell_income',
        amount: breakdown.agreedAmount,
        feeAmount: 0,
        netAmount: breakdown.sellerNetPayout,
        method: sellerPayoutMethod,
        createdAt: now,
      },
      {
        id: `stmt_buy_${stamp}`,
        userId: targetDeal.buyerId,
        dealId: targetDeal.id,
        title: `Bought: ${targetDeal.listingTitle}`,
        type: 'buy_payment',
        amount: breakdown.totalPayable,
        feeAmount: breakdown.platformTotalFee,
        netAmount: breakdown.totalPayable,
        method: buyerPayMethod,
        createdAt: now,
      },
      {
        id: `stmt_admin_${stamp}`,
        userId: targetDeal.adminId,
        dealId: targetDeal.id,
        title: `Escrow Fee Income: ${targetDeal.title}`,
        type: 'admin_fee_income',
        amount: breakdown.platformTotalFee,
        feeAmount: 0,
        netAmount: breakdown.platformTotalFee,
        method: sellerPayoutMethod,
        createdAt: now,
      },
    ];

    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              buyerInitialDone: true,
              sellerExchanged: true,
              reviewRating: finalRating,
              reviewComment: finalComment,
              status: 'done',
              updatedAt: now,
            }
          : d
      ),
      listings: prev.listings.map((l) =>
        l.id === targetDeal.listingId ? { ...l, status: 'sold' } : l
      ),
      statements: [...newStatements, ...prev.statements],
    }));

    void updateDealInFirestore(dealId, {
      buyerInitialDone: true,
      sellerExchanged: true,
      reviewRating: finalRating,
      reviewComment: finalComment,
      status: 'done',
    }).catch(() =>
      reportSyncError('Failed to finalize deal payout in Firestore.')
    );
    void updateListingStatusInFirestore(targetDeal.listingId, 'sold').catch(() => {});
    for (const stmt of newStatements) {
      void persistStatementToFirestore(stmt).catch(() => {});
    }
    void persistNotificationToFirestore({
      id: `notif_payout_${stamp}`,
      recipientId: targetDeal.sellerId,
      actorName: user.displayName,
      message: `Payout released for ${targetDeal.listingTitle}`,
      targetType: 'deal',
      targetId: targetDeal.id,
      isRead: false,
      createdAt: now,
    }).catch(() => {});
  };

  const handleSavePlatformConfig = (config: PlatformEscrowConfig) => {
    if (user.role !== 'admin') return;
    setState((prev) => ({ ...prev, platformConfig: config }));
    void persistPlatformEscrowConfig(config).catch(() =>
      reportSyncError('Could not save escrow payment settings to Firestore.')
    );
  };

  const handleAddVerifiedAdmin = (agent: AdminAgent) => {
    if (user.role !== 'admin') return;
    setState((prev) => ({
      ...prev,
      admins: [agent, ...prev.admins.filter((a) => a.uid !== agent.uid)],
    }));
    void persistAdminAgentToFirestore(agent).catch(() =>
      reportSyncError('Could not add verified admin to Firestore.')
    );
  };

  const handleRemoveVerifiedAdmin = (adminUid: string) => {
    if (user.role !== 'admin' || adminUid === user.uid || adminUid === 'admin_abdur') return;
    setState((prev) => ({
      ...prev,
      admins: prev.admins.filter((a) => a.uid !== adminUid),
    }));
    void deleteAdminAgentFromFirestore(adminUid).catch(() =>
      reportSyncError('Could not remove verified moderator from Firestore.')
    );
  };

  const unreadNotifications = state.notifications.filter(
    (n) => !n.isRead && (n.recipientId === user.uid || user.role === 'admin')
  ).length;
  const unreadMessages = state.conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0
  );

  const showBack = routeStack.length > 1;
  let headerTitle: string | undefined;
  if (currentRoute.screen === 'profile') headerTitle = 'PROFILE';
  if (currentRoute.screen === 'admin_dashboard') {
    headerTitle = t(state.language, 'adminDashboard');
  }
  if (currentRoute.screen === 'deal') {
    const d = state.deals.find((item) => item.id === currentRoute.dealId);
    headerTitle = d?.title;
  }

  return (
    <AppShell
      user={user}
      language={state.language}
      theme={theme}
      route={currentRoute}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      drawerOpen={drawerOpen}
      onToggleTheme={handleToggleTheme}
      onOpenDrawer={() => setDrawerOpen(true)}
      onCloseDrawer={() => setDrawerOpen(false)}
      onNavigate={navigateTo}
      onLogout={() => void handleLogout()}
      onBack={showBack ? goBack : undefined}
      headerTitle={headerTitle}
    >
      {syncNotice && (
        <div
          role="alert"
          className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 text-xs font-medium text-amber-900 dark:text-amber-200"
        >
          <span>{syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="px-2 py-1 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg"
          >
            Dismiss
          </button>
        </div>
      )}

      {currentRoute.screen === 'home' && (
        <HomeFeedScreen
          language={state.language}
          theme={theme}
          listings={state.listings}
          bookmarks={state.bookmarks}
          onToggleBookmark={handleToggleBookmark}
          onOpenListing={(listingId) =>
            navigateTo({ screen: 'post_detail', listingId })
          }
          onMessageSeller={handleOpenOrCreateChatForListing}
          onOpenCreatePost={() => navigateTo({ screen: 'create_post' })}
        />
      )}

      {currentRoute.screen === 'search' && (
        <SearchScreen
          language={state.language}
          listings={state.listings}
          onOpenListing={(listingId) =>
            navigateTo({ screen: 'post_detail', listingId })
          }
        />
      )}

      {currentRoute.screen === 'notifications' && (
        <NotificationsScreen
          language={state.language}
          notifications={state.notifications}
          onMarkAllRead={() => {
            state.notifications
              .filter((n) => !n.isRead && n.recipientId === user.uid)
              .forEach((n) => {
                void markNotificationReadInFirestore(n.id).catch(() => {});
              });
            setState((prev) => ({
              ...prev,
              notifications: prev.notifications.map((n) => ({
                ...n,
                isRead: true,
              })),
            }));
          }}
          onOpenNotification={(item) => {
            if (!item.isRead && item.recipientId === user.uid) {
              void markNotificationReadInFirestore(item.id).catch(() => {});
            }
            setState((prev) => ({
              ...prev,
              notifications: prev.notifications.map((n) =>
                n.id === item.id ? { ...n, isRead: true } : n
              ),
            }));
            if (item.targetType === 'listing') {
              navigateTo({ screen: 'post_detail', listingId: item.targetId });
            } else if (item.targetType === 'conversation') {
              navigateTo({ screen: 'chat', conversationId: item.targetId });
            } else if (item.targetType === 'deal') {
              navigateTo({ screen: 'deal', dealId: item.targetId });
            }
          }}
        />
      )}

      {(currentRoute.screen === 'profile' ||
        currentRoute.screen === 'your_posts' ||
        currentRoute.screen === 'personal_info' ||
        currentRoute.screen === 'settings' ||
        currentRoute.screen === 'security' ||
        currentRoute.screen === 'statement' ||
        currentRoute.screen === 'bookmarks' ||
        currentRoute.screen === 'help') && (
        <ProfileScreen
          user={user}
          language={state.language}
          theme={theme}
          subScreen={currentRoute.screen}
          listings={state.listings}
          bookmarks={state.bookmarks}
          statements={state.statements}
          onNavigate={navigateTo}
          onUpdateProfile={(updates) => {
            const nextUser = { ...user, ...updates };
            setState((prev) =>
              prev.currentUser ? { ...prev, currentUser: nextUser } : prev
            );
            void syncFirebaseUserProfile(nextUser).catch(() => {});
          }}
          onToggleLanguage={handleToggleLanguage}
          onToggleTheme={handleToggleTheme}
          onLogout={() => void handleLogout()}
          onToggleBookmark={handleToggleBookmark}
        />
      )}

      {currentRoute.screen === 'create_post' && (
        <CreatePostScreen
          user={user}
          language={state.language}
          onCreatePost={handleCreatePost}
        />
      )}

      {currentRoute.screen === 'post_detail' && (() => {
        const listing = state.listings.find(
          (l) => l.id === currentRoute.listingId
        );
        if (!listing) {
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Listing not found.
            </div>
          );
        }
        const canDelete = listing.sellerId === user.uid || user.role === 'admin';
        return (
          <PostDetailScreen
            language={state.language}
            listing={listing}
            comments={state.comments.filter((c) => c.listingId === listing.id)}
            isBookmarked={state.bookmarks.includes(listing.id)}
            canDelete={canDelete}
            onToggleBookmark={() => handleToggleBookmark(listing.id)}
            onMessageSeller={() => handleOpenOrCreateChatForListing(listing)}
            onAddComment={(text) => handleAddComment(listing.id, text)}
            onDeleteListing={() => handleDeleteListing(listing.id)}
          />
        );
      })()}

      {currentRoute.screen === 'admin_dashboard' && (
        <AdminDashboard
          user={user}
          language={state.language}
          admins={state.admins}
          deals={state.deals}
          listings={state.listings}
          statements={state.statements}
          notifications={state.notifications}
          platformConfig={state.platformConfig}
          onNavigate={navigateTo}
          onReassignAdmin={handleReassignAdmin}
          onVerifyPayment={handleVerifyPayment}
          onReleasePayout={handleReleasePayout}
          onSavePlatformConfig={handleSavePlatformConfig}
          onAddVerifiedAdmin={handleAddVerifiedAdmin}
          onRemoveVerifiedAdmin={handleRemoveVerifiedAdmin}
        />
      )}

      {(currentRoute.screen === 'admin_queue' ||
        currentRoute.screen === 'admin_detail') && (
        <AdminQueueScreen
          language={state.language}
          admins={state.admins}
          deals={state.deals}
          selectedAdminId={
            currentRoute.screen === 'admin_detail'
              ? currentRoute.adminId
              : undefined
          }
          isAdmin={user.role === 'admin'}
          onOpenDashboard={() => navigateTo({ screen: 'admin_dashboard' })}
          onSelectAdmin={(adminId) =>
            navigateTo({ screen: 'admin_detail', adminId })
          }
          onMessageAdmin={handleMessageAdmin}
          onOpenDeal={(dealId) => navigateTo({ screen: 'deal', dealId })}
        />
      )}

      {currentRoute.screen === 'inbox' && (
        <InboxScreen
          user={user}
          language={state.language}
          conversations={state.conversations}
          deals={state.deals}
          onOpenConversation={(conversationId) => {
            setState((prev) => ({
              ...prev,
              conversations: prev.conversations.map((c) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
              ),
            }));
            void updateConversationInFirestore(conversationId, { unreadCount: 0 }).catch(
              () => {}
            );
            navigateTo({ screen: 'chat', conversationId });
          }}
          onOpenDeal={(dealId) => navigateTo({ screen: 'deal', dealId })}
        />
      )}

      {currentRoute.screen === 'chat' && (() => {
        const conv = state.conversations.find(
          (c) => c.id === currentRoute.conversationId
        );
        if (!conv) {
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Conversation not found.
            </div>
          );
        }
        return (
          <ChatScreen
            user={user}
            language={state.language}
            conversation={conv}
            onSendMessage={(text) => handleSendChatMessage(conv.id, text)}
            onProposeOffer={(amount) => handleProposeOffer(conv.id, amount)}
            onRespondOffer={(accept) => handleRespondOffer(conv.id, accept)}
            onRequestAdminDeal={() => handleRequestAdminDeal(conv)}
            onDeclineAdminDeal={() => handleRespondOffer(conv.id, false)}
            onOpenExistingDeal={(dealId) =>
              navigateTo({ screen: 'deal', dealId })
            }
          />
        );
      })()}

      {currentRoute.screen === 'deal' && (() => {
        const deal = state.deals.find((d) => d.id === currentRoute.dealId);
        if (!deal) {
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Deal not found.
            </div>
          );
        }
        return (
          <DealRoomScreen
            user={user}
            language={state.language}
            deal={deal}
            platformConfig={state.platformConfig}
            onUpdateDeal={handleUpdateDeal}
            onVerifyPayment={handleVerifyPayment}
            onReleasePayout={handleReleasePayout}
            onSendGroupMessage={(text) => handleSendDealGroupMessage(deal, text)}
            onCompleteReview={handleCompleteReview}
            onBackToInbox={() => navigateTo({ screen: 'inbox' })}
          />
        );
      })()}
    </AppShell>
  );
}
