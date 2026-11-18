import React, { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type {
  Language,
  LinkType,
  Listing,
  ListingCategory,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { ASSETS } from '../data/seedData';
import { validatePostInput } from '../utils/dealMath';
import { buildNewListing } from '../services/dealkoroService';
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
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const check = validatePostInput({ title, priceText });
    if (!check.valid) {
      setError(
        check.errorKey === 'title_required'
          ? 'Please enter a listing title (at least 2 characters).'
          : 'Please enter a valid price in Tk (e.g. 1500).'
      );
      return;
    }

    const newListing = buildNewListing({
      seller: user,
      title,
      description,
      category,
      imageUrl,
      paidCount,
      linkType,
      server,
      limitInfo,
      price: check.price,
    });
    onCreatePost(newListing);
  };

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">{user.displayName}</div>
          <div className="text-xs text-slate-500">{t(language, 'createPostTitle')}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* + Gallery Uploader & Preview */}
        <div className="space-y-2">
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
            <ResilientImage
              src={imageUrl}
              alt="Listing preview"
              className="w-full h-full object-cover"
            />
            <label className="absolute inset-0 bg-slate-900/45 hover:bg-slate-900/55 transition-colors flex flex-col items-center justify-center cursor-pointer text-white">
              <ImagePlus className="w-7 h-7 mb-1" />
              <span className="text-sm font-bold">{t(language, 'galleryAdd')}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {PRESET_IMAGES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setImageUrl(preset.url)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap ${
                  imageUrl === preset.url
                    ? 'bg-blue-50 border-blue-600 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="post-title" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'titleLabel')}
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(language, 'titlePlaceholder')}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="post-desc" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'descriptionLabel')}
            </label>
            <textarea
              id="post-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(language, 'descriptionPlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label htmlFor="post-category" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'categoryLabel')}
            </label>
            <select
              id="post-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="post-paid" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'paidLabel')}
            </label>
            <input
              id="post-paid"
              type="text"
              value={paidCount}
              onChange={(e) => setPaidCount(e.target.value)}
              placeholder="e.g. 4"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="post-server" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'serverLabel')}
            </label>
            <input
              id="post-server"
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="e.g. Bangladesh"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="post-limit" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'limitLabel')}
            </label>
            <input
              id="post-limit"
              type="text"
              value={limitInfo}
              onChange={(e) => setLimitInfo(e.target.value)}
              placeholder="e.g. 7"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Link Selection Buttons matching Screen 07 */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Price + POST CTA */}
        <div className="pt-2 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="post-price" className="block text-xs font-semibold text-slate-700 mb-1">
              {t(language, 'price')} (Tk)
            </label>
            <input
              id="post-price"
              type="text"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="e.g. 1500"
              className="w-full min-h-[46px] px-3.5 py-2 text-sm font-semibold tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            className="min-h-[46px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
          >
            {t(language, 'postSubmit')}
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
