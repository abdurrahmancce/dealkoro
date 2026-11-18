import React, { useState } from 'react';
import { ImagePlus, Link as LinkIcon, Loader2, RotateCcw } from 'lucide-react';
import type {
  Language,
  LinkType,
  Listing,
  ListingCategory,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { ASSETS } from '../data/seedData';
import { formatTk, validatePostInput } from '../utils/dealMath';
import { buildNewListing, uploadImageFile } from '../services/dealkoroService';
import { BLUEPRINT_LIMITS, sanitizeImageUrl } from '../utils/payloadSanitizer';
import { ResilientImage } from './ResilientImage';

interface CreatePostScreenProps {
  user: UserProfile;
  language: Language;
  onCreatePost: (listing: Listing) => void;
}

const LINK_OPTIONS: LinkType[] = [
  'Only Konami',
  'Konami + Glink',
  'Konami + iOSlink',
  'Gg Lost',
];

const CATEGORIES: ListingCategory[] = [
  'eFootball',
  'PUBG Mobile',
  'Free Fire',
  'Mobile Legends',
  'Other',
];

const PRESET_IMAGES = [
  { label: 'eFootball Squad', url: ASSETS.efootballSquad },
  { label: 'Legend Trio', url: ASSETS.efootballLegends },
  { label: 'PUBG Loadout', url: ASSETS.pubgAccount },
];

export function CreatePostScreen({
  user,
  language,
  onCreatePost,
}: CreatePostScreenProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ListingCategory>('eFootball');
  const [paidCount, setPaidCount] = useState('4');
  const [server, setServer] = useState('Bangladesh');
  const [limitInfo, setLimitInfo] = useState('7');
  const [linkType, setLinkType] = useState<LinkType>('Only Konami');
  const [priceText, setPriceText] = useState('');
  const [imageUrl, setImageUrl] = useState<string>(ASSETS.efootballSquad);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedReady, setUploadedReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPrice = Number(priceText.replace(/[^0-9.]/g, ''));
  const hasValidPreviewPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('eFootball');
    setPaidCount('4');
    setServer('Bangladesh');
    setLimitInfo('7');
    setLinkType('Only Konami');
    setPriceText('');
    setImageUrl(ASSETS.efootballSquad);
    setCustomUrlInput('');
    setUploadedReady(false);
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadedReady(false);
    setUploadingImage(true);
    const result = await uploadImageFile('listings', user.uid, file);
    setUploadingImage(false);
    if (result.url) {
      setImageUrl(result.url);
      setCustomUrlInput(result.url.startsWith('https://') ? result.url : '');
      setUploadedReady(true);
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleApplyUrl = () => {
    setError(null);
    setUploadedReady(false);
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      setImageUrl(ASSETS.efootballSquad);
      return;
    }
    if (trimmed.startsWith('data:')) {
      setError('Paste an HTTPS link here, or tap the preview banner above to upload a photo.');
      return;
    }
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      setError('Image URL must start with https://');
      return;
    }
    if (trimmed.length > BLUEPRINT_LIMITS.URL_MAX) {
      setError(`Image URL must be ${BLUEPRINT_LIMITS.URL_MAX} characters or less.`);
      return;
    }
    setImageUrl(sanitizeImageUrl(trimmed, ASSETS.efootballSquad));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (uploadingImage) {
      setError('Please wait for the screenshot upload to finish.');
      return;
    }
    const check = validatePostInput({ title, priceText });
    if (!check.valid) {
      setError(
        check.errorKey === 'title_required'
          ? 'Please enter a listing title (at least 2 characters).'
          : 'Please enter a valid price in Tk (e.g. 1500).'
      );
      return;
    }

    const finalImageUrl = customUrlInput.trim()
      ? sanitizeImageUrl(customUrlInput.trim(), imageUrl)
      : sanitizeImageUrl(imageUrl, ASSETS.efootballSquad);

    const newListing = buildNewListing({
      seller: user,
      title,
      description,
      category,
      imageUrl: finalImageUrl,
      paidCount,
      linkType,
      server,
      limitInfo,
      price: check.price,
    });
    onCreatePost(newListing);
  };

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {user.displayName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t(language, 'createPostTitle')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetForm}
          className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl inline-flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'রিসেট' : 'Reset'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Uploader, HTTPS Link & Presets */}
        <div className="space-y-2.5">
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800">
            <ResilientImage
              src={imageUrl}
              alt="Listing preview"
              className="w-full h-full object-cover"
            />
            <label className="absolute inset-0 bg-slate-900/45 hover:bg-slate-900/55 transition-colors flex flex-col items-center justify-center cursor-pointer text-white">
              {uploadingImage ? (
                <>
                  <Loader2 className="w-7 h-7 mb-1 animate-spin" />
                  <span className="text-sm font-bold">Uploading screenshot...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-7 h-7 mb-1" />
                  <span className="text-sm font-bold">{t(language, 'galleryAdd')}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={(e) => void handleFileUpload(e)}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.URL_MAX}
                aria-label="HTTPS image URL"
                placeholder="Optional HTTPS screenshot URL (max 512 chars)"
                className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyUrl}
              className="min-h-[40px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl whitespace-nowrap"
            >
              Preview URL
            </button>
          </div>

          {uploadedReady && (
            <div className="px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl">
              Screenshot attached &amp; compressed for instant multi-device sync!
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {PRESET_IMAGES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setImageUrl(preset.url);
                  setCustomUrlInput('');
                  setUploadedReady(false);
                  setError(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors ${
                  imageUrl === preset.url
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="post-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'titleLabel')}
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(language, 'titlePlaceholder')}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="post-desc"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'descriptionLabel')}
            </label>
            <textarea
              id="post-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(language, 'descriptionPlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="post-category"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'categoryLabel')}
            </label>
            <select
              id="post-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="post-paid"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'paidLabel')}
            </label>
            <input
              id="post-paid"
              type="text"
              value={paidCount}
              onChange={(e) => setPaidCount(e.target.value)}
              placeholder="e.g. 4"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            />
          </div>

          <div>
            <label
              htmlFor="post-server"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'serverLabel')}
            </label>
            <input
              id="post-server"
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="e.g. Bangladesh"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            />
          </div>

          <div>
            <label
              htmlFor="post-limit"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t(language, 'limitLabel')}
            </label>
            <input
              id="post-limit"
              type="text"
              value={limitInfo}
              onChange={(e) => setLimitInfo(e.target.value)}
              placeholder="e.g. 7"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            />
          </div>
        </div>

        {/* Link Selection Buttons */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t(language, 'linkLabel')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {LINK_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setLinkType(opt)}
                className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  linkType === opt
                    ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Price + Live Seller Payout Preview + POST CTA */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="post-price"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t(language, 'price')} (Tk)
              </label>
              <input
                id="post-price"
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full min-h-[46px] px-3.5 py-2 text-sm font-semibold tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={uploadingImage}
              className="min-h-[46px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {t(language, 'postSubmit')}
            </button>
          </div>

          {hasValidPreviewPrice && (
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
              <span>
                {language === 'bn'
                  ? 'এস্ক্রো ডিলের পর সেলার পাবেন:'
                  : 'Seller net payout on deal:'}
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatTk(parsedPrice)} (100% — Buyer pays escrow fee)
              </span>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
          >
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
