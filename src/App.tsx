import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type {
  AdminAgent,
  AdminDeal,
  AppRoute,
  Conversation,
  Language,
  Listing,
  UserProfile,
} from './types/dealkoro';
import {
  auth,
  googleProvider,
  testFirestoreConnection,
} from './firebase/config';
import { ASSETS } from './data/seedData';
import {
  buildNewDealFromConversation,
  getInitialState,
  persistListingToFirestore,
  savePersistedState,
  subscribeFirebaseListings,
  syncFirebaseUserProfile,
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
  const [routeStack, setRouteStack] = useState<AppRoute[]>([{ screen: 'home' }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const currentRoute = routeStack[routeStack.length - 1];

  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  useEffect(() => {
    void testFirestoreConnection();

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) return;
      const profile: UserProfile = {
        uid: fbUser.uid,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'DEALKORO User',
        email: fbUser.email || '',
        phone: fbUser.phoneNumber || '+880 1700-000000',
        avatarUrl: fbUser.photoURL || ASSETS.ninjaAvatar,
        level: 5,
        rating: 5.0,
        sellCount: 0,
        buyCount: 0,
        joinedLabel: 'Nov 2026',
        role: fbUser.email === 'akash.abdur.2002@gmail.com' ? 'admin' : 'user',
        payoutMethod: 'bKash',
        isDemo: false,
      };
      setState((prev) => ({ ...prev, currentUser: profile }));
      void syncFirebaseUserProfile(profile);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!state.currentUser || state.currentUser.isDemo) return;
    const unsub = subscribeFirebaseListings((remoteListings) => {
      setState((prev) => ({
        ...prev,
        listings: remoteListings,
      }));
    });
    return () => unsub();
  }, [state.currentUser?.uid, state.currentUser?.isDemo]);

  const navigateTo = (next: AppRoute) => {
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
    setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleToggleLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setRouteStack([{ screen: 'home' }]);
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
  };

  if (!state.currentUser) {
    return (
      <AuthScreen
        language={state.language}
        onToggleLanguage={handleToggleLanguage}
        onAuthSuccess={(user) => {
          setState((prev) => ({ ...prev, currentUser: user }));
          setRouteStack([
            { screen: user.role === 'admin' ? 'admin_dashboard' : 'home' },
          ]);
        }}
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
    void persistListingToFirestore(listing);
    navigateTo({ screen: 'post_detail', listingId: listing.id });
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
      lastMessage: 'Started chat about this listing',
      unreadCount: 0,
      negotiatedPrice: listing.price,
      offerStatus: 'none',
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          senderId: user.uid,
          senderName: user.displayName,
          text: `Hi, I am interested in ${listing.title} (${listing.linkType}).`,
          type: 'text',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
    }));
    navigateTo({ screen: 'chat', conversationId: newConv.id });
  };

  const handleMessageAdmin = (admin: AdminAgent) => {
    const existing = state.conversations.find((c) => c.sellerId === admin.uid);
    if (existing) {
      navigateTo({ screen: 'chat', conversationId: existing.id });
      return;
    }
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
      lastMessage: 'Hello, I would like escrow verification help.',
      unreadCount: 0,
      negotiatedPrice: 0,
      offerStatus: 'none',
      isSupport: true,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          senderId: admin.uid,
          senderName: `${admin.name} ✓`,
          text: `Hello ${user.displayName.split(' ')[0]}, I am ${admin.name}. How can I assist with your deal?`,
          type: 'text',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
    }));
    navigateTo({ screen: 'chat', conversationId: newConv.id });
  };

  const handleAddComment = (listingId: string, text: string) => {
    const target = state.listings.find((l) => l.id === listingId);
    const newComment = {
      id: `cmt_${Date.now().toString(36)}`,
      listingId,
      authorId: user.uid,
      authorName: user.displayName,
      text,
      createdAt: new Date().toISOString(),
    };
    const newNotif = target
      ? {
          id: `notif_${Date.now().toString(36)}`,
          recipientId: target.sellerId,
          actorName: user.displayName,
          message: `Commented on your post: ${target.title}`,
          targetType: 'listing' as const,
          targetId: listingId,
          isRead: false,
          createdAt: new Date().toISOString(),
        }
      : null;

    setState((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
      notifications: newNotif
        ? [newNotif, ...prev.notifications]
        : prev.notifications,
    }));
  };

  const handleSendChatMessage = (conversationId: string, text: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: text,
              unreadCount: 0,
              updatedAt: new Date().toISOString(),
              messages: [
                ...c.messages,
                {
                  id: `m_${Date.now().toString(36)}`,
                  senderId: user.uid,
                  senderName: user.displayName,
                  text,
                  type: 'text',
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c
      ),
    }));
  };

  const handleProposeOffer = (conversationId: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              negotiatedPrice: amount,
              offerStatus: 'offered',
              lastMessage: `${amount} PLS`,
              updatedAt: new Date().toISOString(),
              messages: [
                ...c.messages,
                {
                  id: `m_${Date.now().toString(36)}`,
                  senderId: user.uid,
                  senderName: user.displayName,
                  text: `${amount} PLS`,
                  type: 'offer',
                  offerAmount: amount,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c
      ),
    }));
  };

  const handleRespondOffer = (conversationId: string, accept: boolean) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const sysText = accept
          ? `${c.sellerName.split(' ')[0]} accepted Tk ${c.negotiatedPrice.toLocaleString('en-US')}`
          : 'Price offer declined';
        return {
          ...c,
          offerStatus: accept ? 'accepted' : 'declined',
          lastMessage: sysText,
          updatedAt: new Date().toISOString(),
          messages: [
            ...c.messages,
            {
              id: `m_${Date.now().toString(36)}`,
              senderId: 'system',
              senderName: 'DEALKORO',
              text: sysText,
              type: 'system',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),
    }));
  };

  const handleRequestAdminDeal = (conversation: Conversation) => {
    const newDeal = buildNewDealFromConversation({
      conversation,
      agreedAmount: conversation.negotiatedPrice || conversation.listingPrice,
    });

    setState((prev) => ({
      ...prev,
      deals: [newDeal, ...prev.deals],
      conversations: prev.conversations.map((c) =>
        c.id === conversation.id ? { ...c, dealId: newDeal.id } : c
      ),
    }));
    navigateTo({ screen: 'deal', dealId: newDeal.id });
  };

  const handleUpdateDeal = (updated: AdminDeal) => {
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) => (d.id === updated.id ? updated : d)),
    }));
  };

  const handleCompleteReview = (dealId: string, rating: number, comment: string) => {
    setState((prev) => {
      const targetDeal = prev.deals.find((d) => d.id === dealId);
      if (!targetDeal) return prev;

      const breakdown = calculateDealBreakdown({
        agreedAmount: targetDeal.agreedAmount,
        serviceType: targetDeal.serviceType,
        buyerMethod: targetDeal.buyerMethod,
        sellerMethod: targetDeal.sellerMethod,
        crossDealAccepted: targetDeal.crossDealAccepted,
        iosCheck: targetDeal.iosCheck,
        googleBindCheck: targetDeal.googleBindCheck,
      });

      const method =
        targetDeal.sellerMethod !== 'pending' ? targetDeal.sellerMethod : 'bKash';
      const now = new Date().toISOString();

      const newStatements = [
        {
          id: `stmt_sell_${Date.now().toString(36)}`,
          userId: targetDeal.sellerId,
          dealId: targetDeal.id,
          title: `Sold: ${targetDeal.listingTitle} (${targetDeal.title})`,
          type: 'sell_income' as const,
          amount: breakdown.agreedAmount,
          feeAmount: 0,
          netAmount: breakdown.sellerNetPayout,
          method,
          createdAt: now,
        },
        {
          id: `stmt_buy_${Date.now().toString(36)}`,
          userId: targetDeal.buyerId,
          dealId: targetDeal.id,
          title: `Bought: ${targetDeal.listingTitle}`,
          type: 'buy_payment' as const,
          amount: breakdown.totalPayable,
          feeAmount: breakdown.platformTotalFee,
          netAmount: breakdown.totalPayable,
          method:
            targetDeal.buyerMethod !== 'pending' ? targetDeal.buyerMethod : 'Nagad',
          createdAt: now,
        },
        {
          id: `stmt_admin_${Date.now().toString(36)}`,
          userId: targetDeal.adminId,
          dealId: targetDeal.id,
          title: `Escrow Fee Income: ${targetDeal.title}`,
          type: 'admin_fee_income' as const,
          amount: breakdown.platformTotalFee,
          feeAmount: 0,
          netAmount: breakdown.platformTotalFee,
          method,
          createdAt: now,
        },
      ];

      const updatedUser = prev.currentUser
        ? {
            ...prev.currentUser,
            sellCount:
              prev.currentUser.uid === targetDeal.sellerId
                ? prev.currentUser.sellCount + 1
                : prev.currentUser.sellCount,
            buyCount:
              prev.currentUser.uid === targetDeal.buyerId
                ? prev.currentUser.buyCount + 1
                : prev.currentUser.buyCount,
          }
        : null;

      return {
        ...prev,
        currentUser: updatedUser,
        deals: prev.deals.map((d) =>
          d.id === dealId
            ? {
                ...d,
                reviewRating: rating,
                reviewComment: comment,
                status: 'done',
                updatedAt: now,
              }
            : d
        ),
        listings: prev.listings.map((l) =>
          l.id === targetDeal.listingId ? { ...l, status: 'sold' } : l
        ),
        statements: [...newStatements, ...prev.statements],
      };
    });
  };

  const handleReassignAdmin = (dealId: string, adminId: string) => {
    if (user.role !== 'admin') return;
    const targetAdmin = state.admins.find((a) => a.uid === adminId);
    if (!targetAdmin) return;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              adminId: targetAdmin.uid,
              adminName: targetAdmin.name,
              updatedAt: now,
              messages: [
                ...d.messages,
                {
                  id: `dm_reassign_${Date.now().toString(36)}`,
                  senderId: 'system',
                  senderName: 'DEALKORO',
                  text: `${targetAdmin.name} assigned as escrow mediator.`,
                  type: 'system',
                  createdAt: now,
                },
              ],
            }
          : d
      ),
    }));
  };

  const handleReleasePayout = (dealId: string) => {
    if (user.role !== 'admin') return;
    const targetDeal = state.deals.find((d) => d.id === dealId);
    if (!targetDeal || targetDeal.status === 'done') return;
    handleCompleteReview(
      dealId,
      targetDeal.reviewRating ?? 5,
      targetDeal.reviewComment || 'Escrow verified and payout released by admin.'
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
      route={currentRoute}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      drawerOpen={drawerOpen}
      onOpenDrawer={() => setDrawerOpen(true)}
      onCloseDrawer={() => setDrawerOpen(false)}
      onNavigate={navigateTo}
      onLogout={() => void handleLogout()}
      onBack={showBack ? goBack : undefined}
      headerTitle={headerTitle}
    >
      {currentRoute.screen === 'home' && (
        <HomeFeedScreen
          language={state.language}
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
          onMarkAllRead={() =>
            setState((prev) => ({
              ...prev,
              notifications: prev.notifications.map((n) => ({
                ...n,
                isRead: true,
              })),
            }))
          }
          onOpenNotification={(item) => {
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
          subScreen={currentRoute.screen}
          listings={state.listings}
          bookmarks={state.bookmarks}
          statements={state.statements}
          onNavigate={navigateTo}
          onUpdateProfile={(updates) =>
            setState((prev) =>
              prev.currentUser
                ? { ...prev, currentUser: { ...prev.currentUser, ...updates } }
                : prev
            )
          }
          onToggleLanguage={handleToggleLanguage}
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
              Listing not found.
            </div>
          );
        }
        return (
          <PostDetailScreen
            language={state.language}
            listing={listing}
            comments={state.comments.filter((c) => c.listingId === listing.id)}
            isBookmarked={state.bookmarks.includes(listing.id)}
            onToggleBookmark={() => handleToggleBookmark(listing.id)}
            onMessageSeller={() => handleOpenOrCreateChatForListing(listing)}
            onAddComment={(text) => handleAddComment(listing.id, text)}
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
          onNavigate={navigateTo}
          onReassignAdmin={handleReassignAdmin}
          onReleasePayout={handleReleasePayout}
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
              Deal not found.
            </div>
          );
        }
        return (
          <DealRoomScreen
            user={user}
            language={state.language}
            deal={deal}
            onUpdateDeal={handleUpdateDeal}
            onSendGroupMessage={(text) =>
              handleUpdateDeal({
                ...deal,
                messages: [
                  ...deal.messages,
                  {
                    id: `dm_${Date.now().toString(36)}`,
                    senderId: user.uid,
                    senderName: user.displayName,
                    text,
                    type: 'text',
                    createdAt: new Date().toISOString(),
                  },
                ],
              })
            }
            onCompleteReview={handleCompleteReview}
            onBackToInbox={() => navigateTo({ screen: 'inbox' })}
          />
        );
      })()}
    </AppShell>
  );
}
