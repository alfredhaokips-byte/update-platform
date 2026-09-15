/* Real data layer — backed by Supabase (see supabase/schema.sql). No mock
   data, no localStorage: everything here talks to Postgres via `sb`
   (js/supabase-client.js) or reads from Store's in-memory cache.

   Cache pattern: a handful of functions (isSaved, getUser, getSellerById)
   are synchronous because they're called many times per render (once per
   card, once per Q&A item). Making every one of those an awaited network
   call would mean dozens of round-trips per page. Instead, pages call the
   async fetchers once (Store.primeCache(), Store.getListings(), ...), which
   populate the cache, and the sync helpers just read from it afterwards. */

const HOME_CITY = "Delhi NCR";
const CONDITIONS = ["New", "Used"];
const REPORT_TYPES = [
  "Scam or fraud attempt",
  "Fake or misleading listing",
  "Abusive or unsafe behavior",
  "Payment issue",
  "Bug or app problem",
  "Something else",
];

/* Fixed category set (replaces the earlier free-text/graduating-tag system —
   a closed list reads better at a glance and is what the category filter
   chips on Browse and the picker on Sell now both use). Existing listings
   posted before this change may carry an older free-text category value;
   CATEGORY_ICONS[cat] is simply undefined for those, which just means no
   icon renders next to them — harmless. */
const CATEGORIES = ["Electronics", "Stationary", "Books", "Utilities", "Accessories", "Fashion"];
const CATEGORY_ICONS = {
  Electronics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/></svg>`,
  Stationary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 9h6M9 13h6"/></svg>`,
  Books: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  Utilities: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  Accessories: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/></svg>`,
  Fashion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h4l2 3 2-3h4l3 4-4 3v10H7V11L3 8z"/></svg>`,
};

function formatPrice(n) { return "₹" + Number(n).toLocaleString("en-IN"); }

/* The optional, cosmetic character avatar — a flat silhouette in one of three
   colors, picked at signup or from Account, never required. avatarType is
   "female" | "male" | "neutral" (the DB default when never chosen). */
function characterAvatarHtml(avatarType) {
  const type = avatarType === "female" || avatarType === "male" ? avatarType : "neutral";
  const bg = type === "female" ? "var(--sage-bg)" : type === "male" ? "var(--clay-bg)" : "var(--surface-2)";
  const fill = type === "female" ? "var(--sage-deep)" : type === "male" ? "var(--clay)" : "var(--muted)";
  return `<svg viewBox="0 0 64 64" style="background:${bg};"><circle cx="32" cy="24" r="13" fill="${fill}"/><path d="M10 58c0-13 10-20 22-20s22 7 22 20" fill="${fill}"/></svg>`;
}

function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return days + " days ago";
}
const reviewTimeAgo = timeAgo;

function listingImg(seed, w, h) {
  w = w || 480; h = h || 360;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function isPhotoUrl(s) { return typeof s === "string" && /^https?:\/\//.test(s); }

/* Single thumbnail for a card. Real uploaded photo if this listing has one,
   otherwise a stable placeholder (only true for listings posted before
   Phase 0.5, or during local testing without a Supabase Storage bucket set up). */
function listingThumbUrl(listing, w, h) {
  if (listing.images && listing.images.length && isPhotoUrl(listing.images[0])) return listing.images[0];
  return listingImg(listing.img, w, h);
}

/* Full gallery for the detail page — same fallback logic, but a fake 3-image
   set for the placeholder case so the old carousel UI still has something to scroll. */
function listingGalleryUrls(listing) {
  if (listing.images && listing.images.length && listing.images.every(isPhotoUrl)) return listing.images;
  return [listing.img, listing.img + "-b", listing.img + "-c"].map((s) => listingImg(s, 800, 600));
}

function initials(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function trustLine(seller) {
  if (!seller) return "";
  if (seller.verified) return `Verified · ${seller.deals} deal${seller.deals === 1 ? "" : "s"}`;
  return "New seller";
}

function starsHtml(rating, size) {
  size = size || 13;
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<span style="color:${i <= Math.round(rating) ? "#f5a623" : "#e3e2da"};font-size:${size}px;">★</span>`;
  }
  return out;
}

/* Maps a DB profile row to the shape the UI already expects. */
function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatarSeed: row.avatar_seed,
    verified: row.verified,
    deals: row.deals,
    memberSince: new Date(row.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    memberSinceDate: row.created_at,
    locality: row.locality,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    emailVerified: !!row.email_verified,
    phone: row.phone,
    phoneVerified: !!row.phone_verified,
    selfieVerified: !!row.selfie_verified,
    avatarType: row.avatar_type || "neutral",
  };
}

/* Price above which a listing requires selfie/liveness verification to publish. */
const SELFIE_VERIFICATION_PRICE_THRESHOLD = 10000;

/* Maps a DB listing row (with embedded seller profile) to the UI shape. */
function mapListing(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: row.price,
    locality: row.locality,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    sellerId: row.seller_id,
    condition: row.condition,
    desc: row.description,
    views: row.views,
    images: row.images || [],
    img: (row.images && row.images[0]) || row.id,
    createdAt: row.created_at,
  };
}

const Store = {
  _cache: { profile: null, savedIds: new Set(), listings: null, profileById: new Map() },

  /* Call once per page, before any render that uses the sync helpers below. */
  async primeCache() {
    const session = await Auth.getSession();
    if (session) {
      const { data: profileRow } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
      this._cache.profile = mapProfile(profileRow);

      // email_verified is a mirror of Supabase Auth's own email_confirmed_at
      // (RLS can't read the auth schema, so we sync it into profiles here).
      const authConfirmed = !!session.user.email_confirmed_at;
      if (this._cache.profile && authConfirmed && !this._cache.profile.emailVerified) {
        await sb.from("profiles").update({ email_verified: true }).eq("id", session.user.id);
        this._cache.profile.emailVerified = true;
      }
      if (this._cache.profile) this._cache.profileById.set(this._cache.profile.id, this._cache.profile);

      const { data: savedRows } = await sb.from("saved_items").select("listing_id").eq("user_id", session.user.id);
      this._cache.savedIds = new Set((savedRows || []).map((r) => r.listing_id));
    } else {
      this._cache.profile = null;
      this._cache.savedIds = new Set();
    }
  },

  isLoggedIn() { return !!this._cache.profile; },
  getUser() { return this._cache.profile; },

  /* Saves the signed-in user's locality from a Google Places result (see
     js/maps-client.js) and updates the cached profile so "Nearby" reflects
     it immediately. `place` is { locality, city, state, lat, lng }. */
  async setLocality(place) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to set a locality");
    const { error } = await sb.from("profiles").update({
      locality: place.locality, city: place.city, state: place.state, lat: place.lat, lng: place.lng,
    }).eq("id", user.id);
    if (error) throw error;
    Object.assign(user, { locality: place.locality, city: place.city, state: place.state, lat: place.lat, lng: place.lng });
    return user;
  },

  async getListings() {
    const { data, error } = await sb
      .from("listings")
      .select("*, seller:profiles!listings_seller_id_fkey(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const mapped = data.map((row) => {
      if (row.seller) {
        const p = mapProfile(row.seller);
        this._cache.profileById.set(p.id, p);
      }
      return mapListing(row);
    });
    this._cache.listings = mapped;
    return mapped;
  },

  /* Loads a profile straight from the DB and caches it — use this on any
     page that might be the first to touch that user this session (profile.html
     reached via a shared link, for instance), where getSellerById's cache
     wouldn't have been primed by a prior listings/reviews/etc. fetch. */
  async fetchProfile(id) {
    const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    const mapped = mapProfile(data);
    if (mapped) this._cache.profileById.set(mapped.id, mapped);
    return mapped;
  },

  async getListingById(id) {
    const { data, error } = await sb
      .from("listings")
      .select("*, seller:profiles!listings_seller_id_fkey(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.seller) {
      const p = mapProfile(data.seller);
      this._cache.profileById.set(p.id, p);
    }
    // also bump the view counter, fire-and-forget
    sb.from("listings").update({ views: (data.views || 0) + 1 }).eq("id", id).then(() => {});
    return mapListing(data);
  },

  /* `place` is { locality, city, state, lat, lng } from Google Places
     Autocomplete on the Sell form — falls back to the seller's own profile
     location if the form's place field wasn't (or couldn't be) filled in. */
  async addListing({ title, category, price, place, condition, desc }) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to post a listing");
    const loc = place || { locality: user.locality, city: user.city, state: user.state, lat: user.lat, lng: user.lng };
    const { data, error } = await sb
      .from("listings")
      .insert({
        seller_id: user.id, title, category, price, condition, description: desc, images: [],
        locality: loc.locality, city: loc.city || HOME_CITY, state: loc.state, lat: loc.lat, lng: loc.lng,
      })
      .select()
      .single();
    if (error) throw error;
    return mapListing(data);
  },

  /* Uploads one file to the listing-photos bucket under {user_id}/{listing_id}/{filename}
     and returns its public URL. Doesn't touch the listing row — call
     updateListingImages() once all files are up, so a failure partway through
     a multi-photo upload doesn't leave the listing half-pointed at photos
     that may or may not have made it. */
  async uploadListingPhoto(listingId, file) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to upload photos");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("listing-photos").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = sb.storage.from("listing-photos").getPublicUrl(path);
    return data.publicUrl;
  },

  async updateListingImages(listingId, images) {
    const { error } = await sb.from("listings").update({ images }).eq("id", listingId);
    if (error) throw error;
  },

  getSaved() { return Array.from(this._cache.savedIds); },
  isSaved(id) { return this._cache.savedIds.has(id); },

  async toggleSaved(id) {
    const user = this.getUser();
    if (!user) { window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search); return false; }
    if (this._cache.savedIds.has(id)) {
      await sb.from("saved_items").delete().eq("user_id", user.id).eq("listing_id", id);
      this._cache.savedIds.delete(id);
      return false;
    } else {
      await sb.from("saved_items").insert({ user_id: user.id, listing_id: id });
      this._cache.savedIds.add(id);
      return true;
    }
  },

  async getReviews(sellerId) {
    const { data, error } = await sb
      .from("reviews")
      .select("*, reviewer:profiles!reviews_reviewer_id_fkey(*), listing:listings(title)")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((r) => ({
      id: r.id,
      reviewerName: r.reviewer ? r.reviewer.name : "Former user",
      reviewerAvatarType: r.reviewer ? (r.reviewer.avatar_type || "neutral") : "neutral",
      rating: r.rating,
      text: r.text,
      createdAt: r.created_at,
      listingTitle: r.listing ? r.listing.title : null,
    }));
  },

  async addReview(sellerId, { rating, text, listingId }) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to leave a review");
    const { error } = await sb.from("reviews").insert({
      seller_id: sellerId, reviewer_id: user.id, rating, text, listing_id: listingId || null,
    });
    if (error) throw error;
  },

  reviewStats(reviews) {
    if (!reviews || reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
  },

  /* A review is only allowed once a real message thread exists between the
     two of you — mirrors the DB-level check in trust-verification.sql's RLS
     policy, so the UI can hide the button proactively instead of just letting
     the insert fail. */
  async canReview(sellerId) {
    const user = this.getUser();
    if (!user || user.id === sellerId) return false;
    const { data, error } = await sb
      .from("message_threads")
      .select("id")
      .eq("seller_id", sellerId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /* Response rate is derived from real message history (see
     seller_response_stats in trust-verification.sql) — no separate tracking
     table. Completion rate / cancellations aren't included: this app has no
     transaction/order lifecycle to derive them from honestly. */
  async getSellerTrustStats(sellerId) {
    const { data, error } = await sb.from("seller_response_stats").select("*").eq("seller_id", sellerId).maybeSingle();
    if (error) throw error;
    const received = data ? data.threads_received : 0;
    const replied = data ? data.threads_replied : 0;
    return {
      threadsReceived: received,
      threadsReplied: replied,
      responseRatePct: received > 0 ? Math.round((replied / received) * 100) : null,
    };
  },

  /* A handful of the most established sellers, for the landing page's
     "Trusted sellers" section — real data, ranked by deals then verification. */
  async getFeaturedSellers(limit) {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("deals", { ascending: false })
      .order("verified", { ascending: false })
      .limit(limit || 4);
    if (error) throw error;
    return data.map((row) => {
      const p = mapProfile(row);
      this._cache.profileById.set(p.id, p);
      return p;
    });
  },

  /* Batched, count-only vouch totals for a set of sellers — one query, no
     voucher profile data. Used for listing/browse cards, where fetching
     full voucher details per card would mean one query per card. */
  async getVouchCounts(sellerIds) {
    const ids = Array.from(new Set(sellerIds)).filter(Boolean);
    if (ids.length === 0) return new Map();
    const { data, error } = await sb.from("vouches").select("seller_id").in("seller_id", ids);
    if (error) throw error;
    const counts = new Map();
    data.forEach((r) => counts.set(r.seller_id, (counts.get(r.seller_id) || 0) + 1));
    return counts;
  },

  /* Full vouch detail for one seller — count, whether the signed-in user has
     already vouched, and a few real vouchers to show. Used on a seller's own
     profile/detail view, where only one seller is in play at a time. */
  async getVouchStats(sellerId) {
    const { data, error } = await sb
      .from("vouches")
      .select("voucher_id, voucher:profiles!vouches_voucher_id_fkey(*)")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const vouchers = [];
    data.forEach((row) => {
      if (row.voucher) {
        const p = mapProfile(row.voucher);
        this._cache.profileById.set(p.id, p);
        vouchers.push(p);
      }
    });
    const user = this.getUser();
    return {
      count: data.length,
      vouched: !!(user && data.some((r) => r.voucher_id === user.id)),
      sample: vouchers.slice(0, 3),
    };
  },

  async toggleVouch(sellerId) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to vouch");
    if (user.id === sellerId) throw new Error("You can't vouch for yourself");
    const { data: existing, error: selErr } = await sb
      .from("vouches").select("voucher_id").eq("voucher_id", user.id).eq("seller_id", sellerId).maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
      const { error } = await sb.from("vouches").delete().eq("voucher_id", user.id).eq("seller_id", sellerId);
      if (error) throw error;
      return false;
    } else {
      const { error } = await sb.from("vouches").insert({ voucher_id: user.id, seller_id: sellerId });
      if (error) throw error;
      return true;
    }
  },

  async setPhone(phone) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in");
    const { error } = await sb.from("profiles").update({ phone }).eq("id", user.id);
    if (error) throw error;
    user.phone = phone;
  },

  /* Optional, cosmetic only — never required to use the app. */
  async setAvatarType(avatarType) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in");
    const { error } = await sb.from("profiles").update({ avatar_type: avatarType }).eq("id", user.id);
    if (error) throw error;
    user.avatarType = avatarType;
  },

  /* RLS ("users can delete their own listings" in schema.sql) already
     restricts this to the listing's own seller_id — this call just has to
     be made as that user. */
  async deleteListing(id) {
    const { error } = await sb.from("listings").delete().eq("id", id);
    if (error) throw error;
    if (this._cache.listings) this._cache.listings = this._cache.listings.filter((l) => l.id !== id);
  },

  async getQA(listingId) {
    const { data, error } = await sb
      .from("qa_questions")
      .select("*, user:profiles!qa_questions_user_id_fkey(*)")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    data.forEach((row) => { if (row.user) this._cache.profileById.set(row.user.id, mapProfile(row.user)); });

    const byId = new Map(data.map((r) => [r.id, { id: r.id, userId: r.user_id, text: r.text, votes: r.votes, replies: [] }]));
    const roots = [];
    data.forEach((r) => {
      const node = byId.get(r.id);
      if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).replies.push(node);
      else roots.push(node);
    });
    return roots;
  },

  async postQuestion(listingId, text, parentId) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to post");
    const { error } = await sb.from("qa_questions").insert({
      listing_id: listingId, user_id: user.id, text, parent_id: parentId || null,
    });
    if (error) throw error;
  },

  async voteQA(questionId, delta) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to vote");
    const { error } = await sb.rpc("cast_qa_vote", { q_id: questionId, new_value: delta });
    if (error) throw error;
  },

  async getThreads() {
    const user = this.getUser();
    if (!user) return [];
    const { data, error } = await sb
      .from("message_threads")
      .select(`
        id, listing_id, buyer_id, seller_id,
        buyer:profiles!message_threads_buyer_id_fkey(*),
        seller:profiles!message_threads_seller_id_fkey(*),
        messages(id, sender_id, text, read, created_at)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    if (error) throw error;

    return data.map((t) => {
      const iAmBuyer = t.buyer_id === user.id;
      const counterpart = iAmBuyer ? t.seller : t.buyer;
      if (counterpart) this._cache.profileById.set(counterpart.id, mapProfile(counterpart));
      const msgs = (t.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const unread = msgs.filter((m) => m.sender_id !== user.id && !m.read).length;
      return {
        id: t.id,
        listingId: t.listing_id,
        sellerId: iAmBuyer ? t.seller_id : t.buyer_id, // the OTHER participant, for profile/avatar lookups
        tag: iAmBuyer ? "buying" : "selling",
        unread,
        messages: msgs.map((m) => ({ from: m.sender_id === user.id ? "me" : "them", text: m.text, time: new Date(m.created_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" }) })),
      };
    }).sort((a, b) => {
      const at = a.messages.length ? a.messages[a.messages.length - 1].time : "";
      const bt = b.messages.length ? b.messages[b.messages.length - 1].time : "";
      return bt.localeCompare(at);
    });
  },

  async markThreadRead(threadId) {
    const user = this.getUser();
    if (!user) return;
    await sb.from("messages").update({ read: true }).eq("thread_id", threadId).neq("sender_id", user.id);
  },

  async sendMessage(threadId, text) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to message");
    const { error } = await sb.from("messages").insert({ thread_id: threadId, sender_id: user.id, text });
    if (error) throw error;
  },

  /* Finds or creates the (listing, me-as-buyer) thread, then sends the message. */
  async startOrAppendThread(listing, text) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to message a seller");

    let { data: thread } = await sb
      .from("message_threads")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (!thread) {
      const { data: created, error } = await sb
        .from("message_threads")
        .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.sellerId })
        .select("id")
        .single();
      if (error) throw error;
      thread = created;
    }

    await this.sendMessage(thread.id, text);
    return thread.id;
  },

  async getReports() {
    const user = this.getUser();
    if (!user) return [];
    const { data, error } = await sb.from("reports").select("*").eq("reporter_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((r) => ({
      id: r.id, type: r.type, description: r.description,
      listingId: r.listing_id, sellerId: r.reported_seller_id, status: r.status, createdAt: r.created_at,
    }));
  },

  async addReport({ type, description, listingId, sellerId }) {
    const user = this.getUser();
    if (!user) throw new Error("Must be signed in to file a report");
    const { error } = await sb.from("reports").insert({
      reporter_id: user.id, type, description, listing_id: listingId || null, reported_seller_id: sellerId || null,
    });
    if (error) throw error;
  },
};

function getSellerById(id) {
  return Store._cache.profileById.get(id) || null;
}
