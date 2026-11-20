import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Coffee,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  ShoppingBag,
  Train,
  X,
} from 'lucide-react';
import type { Language, ThemeMode } from '../types/dealkoro';

interface EscrowMapScreenProps {
  language: Language;
  theme: ThemeMode;
}

type MeetupCategory = {
  id: string;
  labelEn: string;
  labelBn: string;
  primaryType: string;
  icon: React.ReactNode;
};

type TravelModeOption = 'DRIVING' | 'TWO_WHEELER' | 'WALKING' | 'TRANSIT';

interface DiscoveredPlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
  googleMapsURI?: string | null;
}

interface RouteSummary {
  distanceMeters: number;
  durationMillis: number;
  destinationName: string;
}

const DEFAULT_DHAKA_CENTER: google.maps.LatLngLiteral = {
  lat: 23.8103,
  lng: 90.4125,
};

const MEETUP_CATEGORIES: MeetupCategory[] = [
  {
    id: 'bank',
    labelEn: 'Banks & Agents',
    labelBn: 'ব্যাংক ও এজেন্ট',
    primaryType: 'bank',
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  {
    id: 'cafe',
    labelEn: 'Public Cafes',
    labelBn: 'পাবলিক ক্যাফে',
    primaryType: 'cafe',
    icon: <Coffee className="w-3.5 h-3.5" />,
  },
  {
    id: 'shopping_mall',
    labelEn: 'Shopping Malls',
    labelBn: 'শপিং মল',
    primaryType: 'shopping_mall',
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
  },
  {
    id: 'transit_station',
    labelEn: 'Metro / Transit',
    labelBn: 'মেট্রো / স্টেশন',
    primaryType: 'transit_station',
    icon: <Train className="w-3.5 h-3.5" />,
  },
];

function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'object' && err !== null
      ? JSON.stringify(err)
      : String(err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  );
}

function toLatLngLiteral(
  loc: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined
): google.maps.LatLngLiteral | null {
  if (!loc) return null;
  if (typeof (loc as google.maps.LatLng).lat === 'function') {
    const ll = loc as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const lit = loc as google.maps.LatLngLiteral;
  if (typeof lit.lat === 'number' && typeof lit.lng === 'number') {
    return { lat: lit.lat, lng: lit.lng };
  }
  return null;
}

function PlaceMarkerItem({
  place,
  selected,
  onSelect,
  onComputeRoute,
  isBn,
}: {
  place: DiscoveredPlace;
  selected: boolean;
  onSelect: (place: DiscoveredPlace) => void;
  onComputeRoute: (place: DiscoveredPlace) => void;
  isBn: boolean;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.displayName}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={selected ? '#2563EB' : '#059669'}
          borderColor={selected ? '#1E40AF' : '#065F46'}
          glyphColor="#FFFFFF"
          scale={selected ? 1.2 : 1.0}
        />
      </AdvancedMarker>

      {selected && marker && (
        <InfoWindow anchor={marker} maxWidth={270} onCloseClick={() => onSelect(place)}>
          <div className="text-slate-900 space-y-1.5 p-0.5 text-xs">
            <div className="font-bold text-sm leading-snug">{place.displayName}</div>
            {place.formattedAddress && (
              <div className="text-slate-600 leading-relaxed">{place.formattedAddress}</div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums">
              {typeof place.rating === 'number' && (
                <span className="font-semibold text-amber-700">
                  ★ {place.rating.toFixed(1)}
                  {typeof place.userRatingCount === 'number'
                    ? ` (${place.userRatingCount})`
                    : ''}
                </span>
              )}
              {place.businessStatus === 'OPERATIONAL' && (
                <span className="text-emerald-700 font-semibold">
                  {isBn ? 'খোলা / সচল' : 'Operational'}
                </span>
              )}
            </div>
            <div className="pt-1 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onComputeRoute(place)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition-colors"
              >
                {isBn ? 'রুট দেখুন' : 'Get Route'}
              </button>
              {place.googleMapsURI && (
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                >
                  <span>{isBn ? 'গুগল ম্যাপস' : 'Maps'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function EscrowMapWorkspace({ language, theme }: EscrowMapScreenProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const map = useMap();
  const isApiLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [activeCategory, setActiveCategory] = useState<string>('bank');
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [places, setPlaces] = useState<DiscoveredPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DiscoveredPlace | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(
    null
  );
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeDestination, setRouteDestination] = useState<DiscoveredPlace | null>(null);

  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const initialSearchDoneRef = useRef(false);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearPolylines();
  }, [clearPolylines]);

  const mapPlaceResult = (place: google.maps.places.Place): DiscoveredPlace | null => {
    const loc = toLatLngLiteral(place.location);
    if (!loc) return null;
    return {
      id: place.id || `${loc.lat.toFixed(5)}_${loc.lng.toFixed(5)}`,
      displayName: place.displayName || 'Meetup Location',
      formattedAddress: place.formattedAddress || '',
      location: loc,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      businessStatus: place.businessStatus ?? null,
      googleMapsURI: place.googleMapsURI ?? null,
    };
  };

  const runNearbySearch = useCallback(
    async (center: google.maps.LatLngLiteral, categoryId: string) => {
      if (!placesLib) return;
      const cat =
        MEETUP_CATEGORIES.find((c) => c.id === categoryId) ?? MEETUP_CATEGORIES[0];
      setLoadingPlaces(true);
      setMapError(null);
      try {
        const { Place, SearchNearbyRankPreference } = placesLib;
        const { places: found } = await Place.searchNearby({
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'businessStatus',
            'googleMapsURI',
          ],
          locationRestriction: {
            center,
            radius: 5000,
          },
          includedPrimaryTypes: [cat.primaryType],
          maxResultCount: 10,
          rankPreference: SearchNearbyRankPreference.POPULARITY,
          language: isBn ? 'bn' : 'en',
          region: 'bd',
        });

        const mapped = (found ?? [])
          .map(mapPlaceResult)
          .filter((item): item is DiscoveredPlace => item !== null);
        setPlaces(mapped);
        setSelectedPlace(mapped[0] ?? null);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setMapError(
          isBn
            ? 'আশেপাশের মিটআপ লোকেশন লোড করা যায়নি।'
            : 'Could not load nearby meetup locations right now.'
        );
      } finally {
        setLoadingPlaces(false);
      }
    },
    [placesLib, isBn]
  );

  // Trigger initial live Places API (New) search once map + places library are ready
  useEffect(() => {
    if (!isApiLoaded || !placesLib || !map || initialSearchDoneRef.current) return;
    initialSearchDoneRef.current = true;
    void runNearbySearch(DEFAULT_DHAKA_CENTER, activeCategory);
  }, [isApiLoaded, placesLib, map, activeCategory, runNearbySearch]);

  // Modern AutocompleteSuggestion with AutocompleteSessionToken
  useEffect(() => {
    if (!placesLib) return;
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setLoadingSuggestions(true);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['bd'],
        });
        setSuggestions(res.suggestions ?? []);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [placesLib, searchInput]);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    setMapError(null);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
          'rating',
          'userRatingCount',
          'businessStatus',
          'googleMapsURI',
        ],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchInput(place.displayName || '');

      const mapped = mapPlaceResult(place);
      if (mapped) {
        if (map) {
          if (place.viewport) {
            map.fitBounds(place.viewport);
          } else {
            map.panTo(mapped.location);
            map.setZoom(14);
          }
        }
        await runNearbySearch(mapped.location, activeCategory);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        isBn ? 'সিলেক্ট করা লোকেশন লোড করা যায়নি।' : 'Could not load selected place details.'
      );
    }
  };

  const handleTextSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesLib || !searchInput.trim()) return;
    setLoadingPlaces(true);
    setMapError(null);
    setSuggestions([]);
    try {
      const { Place } = placesLib;
      const centerObj = map?.getCenter();
      const biasCenter = centerObj
        ? { lat: centerObj.lat(), lng: centerObj.lng() }
        : DEFAULT_DHAKA_CENTER;
      const { places: found } = await Place.searchByText({
        textQuery: searchInput.trim(),
        fields: [
          'id',
          'displayName',
          'location',
          'formattedAddress',
          'rating',
          'userRatingCount',
          'businessStatus',
          'googleMapsURI',
        ],
        locationBias: biasCenter,
        maxResultCount: 10,
        language: isBn ? 'bn' : 'en',
        region: 'bd',
      });

      const mapped = (found ?? [])
        .map(mapPlaceResult)
        .filter((item): item is DiscoveredPlace => item !== null);
      setPlaces(mapped);
      if (mapped[0]) {
        setSelectedPlace(mapped[0]);
        map?.panTo(mapped[0].location);
        map?.setZoom(14);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setMapError(
        isBn ? 'লোকেশন সার্চ ব্যর্থ হয়েছে।' : 'Unable to complete place search right now.'
      );
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMapError(
        isBn
          ? 'আপনার ব্রাউজারে লোকেশন সার্ভিস পাওয়া যায়নি।'
          : 'Geolocation is not supported in this browser.'
      );
      return;
    }
    setLocatingUser(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setLocatingUser(false);
        if (map) {
          map.panTo(coords);
          map.setZoom(14);
        }
        void runNearbySearch(coords, activeCategory);
      },
      () => {
        setLocatingUser(false);
        setMapError(
          isBn
            ? 'লোকেশন অ্যাক্সেস অনুমতি পাওয়া যায়নি। ম্যাপে শহর লিখে সার্চ করুন।'
            : 'Location permission was declined. Search any area in Bangladesh above.'
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const computeRouteToPlace = useCallback(
    async (dest: DiscoveredPlace, modeOverride?: TravelModeOption) => {
      if (!routesLib || !map) return;
      const originCenter =
        userLocation ??
        (map.getCenter()
          ? { lat: map.getCenter()!.lat(), lng: map.getCenter()!.lng() }
          : DEFAULT_DHAKA_CENTER);

      clearPolylines();
      setRouteDestination(dest);
      setLoadingRoute(true);
      setMapError(null);
      try {
        const RouteClass = routesLib.Route as unknown as {
          computeRoutes: (req: {
            origin: google.maps.LatLngLiteral;
            destination: google.maps.LatLngLiteral;
            travelMode: TravelModeOption;
            fields: string[];
          }) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: google.maps.LatLngBounds;
              createPolylines: () => google.maps.Polyline[];
            }>;
          }>;
        };

        const response = await RouteClass.computeRoutes({
          origin: originCenter,
          destination: dest.location,
          travelMode: modeOverride ?? travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
        });

        const primaryRoute = response.routes?.[0];
        if (!primaryRoute) {
          setRouteSummary(null);
          setMapError(
            isBn
              ? 'এই দুটি স্থানের মধ্যে রুট পাওয়া যায়নি।'
              : 'No route available for the selected travel mode.'
          );
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#2563EB',
            strokeWeight: 6,
            strokeOpacity: 0.9,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        setRouteSummary({
          distanceMeters: primaryRoute.distanceMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
          destinationName: dest.displayName,
        });
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setRouteSummary(null);
        setMapError(
          isBn
            ? 'রুট এবং সময় হিসাব করা যায়নি।'
            : 'Unable to calculate route right now.'
        );
      } finally {
        setLoadingRoute(false);
      }
    },
    [routesLib, map, userLocation, travelMode, clearPolylines, isBn]
  );

  return (
    <div className="space-y-4">
      {/* Header & Search Controls */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {isBn
                  ? 'নিরাপদ মিটআপ ও এজেন্ট লোকেটর'
                  : 'Safe Face-to-Face Meetup & Escrow Agent Locator'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isBn ? 'এস্ক্রো মিটআপ ম্যাপ' : 'Escrow Meetup Map'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn
                ? 'অফলাইন বা ইন-পার্সন অ্যাকাউন্ট হ্যান্ডওভারের জন্য কাছাকাছি পাবলিক ব্যাংক, ক্যাফে বা শপিং মল খুঁজুন এবং রুট দেখুন।'
                : 'Find verified public banks, cafes, shopping malls, and transit hubs for safe in-person account handovers with live route ETA.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locatingUser}
              className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              {locatingUser ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Compass className="w-4 h-4" />
              )}
              <span>{isBn ? 'আমার লোকেশন ব্যবহার করুন' : 'Use My Location'}</span>
            </button>
          </div>
        </div>

        {/* Places Autocomplete Search + Meetup Category Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
          <div className="relative">
            <form onSubmit={handleTextSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    isBn
                      ? 'এলাকা, ব্যাংক বা মার্কেট খুঁজুন (যেমন: Dhanmondi, Mirpur 10)...'
                      : 'Search area, mall, bank or meetup spot (e.g. Dhanmondi, Mirpur 10)...'
                  }
                  aria-label="Search meetup location"
                  className="w-full min-h-[42px] pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSuggestions([]);
                    }}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loadingPlaces || !searchInput.trim()}
                className="min-h-[42px] px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl whitespace-nowrap transition-colors"
              >
                {isBn ? 'খুঁজুন' : 'Search'}
              </button>
            </form>

            {(loadingSuggestions || suggestions.length > 0) && (
              <ul className="absolute left-0 right-0 mt-1.5 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                {loadingSuggestions && suggestions.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    {isBn ? 'লোকেশন খোঁজা হচ্ছে...' : 'Searching places...'}
                  </li>
                ) : (
                  suggestions.map((s, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => void handleSelectSuggestion(s)}
                        className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate">{s.placePrediction?.text.text}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Meetup place category"
          >
            {MEETUP_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const c = map?.getCenter()
                      ? { lat: map.getCenter()!.lat(), lng: map.getCenter()!.lng() }
                      : userLocation ?? DEFAULT_DHAKA_CENTER;
                    void runNearbySearch(c, cat.id);
                  }}
                  aria-pressed={active}
                  className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.icon}
                  <span>{isBn ? cat.labelBn : cat.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mapError && (
          <div
            role="alert"
            className="p-3 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl"
          >
            {mapError}
          </div>
        )}
      </section>

      {/* Map Viewport + Discovered Places & Route Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {apiStatus === APILoadingStatus.FAILED ||
          apiStatus === APILoadingStatus.AUTH_FAILURE ? (
            <div className="h-[460px] flex flex-col items-center justify-center p-6 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-7 h-7 text-amber-500" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {isBn
                  ? 'Google Maps API লোড করা যায়নি।'
                  : 'Unable to load Google Maps right now.'}
              </p>
              <p>
                {isBn
                  ? 'অনুগ্রহ করে আপনার নেটওয়ার্ক বা API কী অনুমতি যাচাই করুন।'
                  : 'Verify your network connection and Google Maps API key permissions.'}
              </p>
            </div>
          ) : (
            <div className="w-full h-[460px] sm:h-[540px] relative">
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={DEFAULT_DHAKA_CENTER}
                defaultZoom={12}
                gestureHandling="greedy"
                colorScheme={isDark ? 'DARK' : 'LIGHT'}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                {userLocation && (
                  <AdvancedMarker position={userLocation} title="Your Location">
                    <Pin background="#2563EB" borderColor="#1E3A8A" glyphColor="#FFFFFF" />
                  </AdvancedMarker>
                )}

                {places.map((place) => (
                  <PlaceMarkerItem
                    key={place.id}
                    place={place}
                    selected={selectedPlace?.id === place.id}
                    onSelect={(p) => setSelectedPlace(p)}
                    onComputeRoute={(p) => void computeRouteToPlace(p)}
                    isBn={isBn}
                  />
                ))}
              </GoogleMap>
            </div>
          )}
        </div>

        {/* Right Side Panel: Route Summary + Nearby Verified Places */}
        <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
          {/* Travel Mode & Active Route ETA */}
          <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{isBn ? 'যাতায়াত মাধ্যম ও রুট' : 'Travel Mode & Route'}</span>
              </span>
              {routeSummary && (
                <button
                  type="button"
                  onClick={() => {
                    clearPolylines();
                    setRouteSummary(null);
                    setRouteDestination(null);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {isBn ? 'রুট মুছুন' : 'Clear'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(
                [
                  { id: 'DRIVING', label: 'Car' },
                  { id: 'TWO_WHEELER', label: 'Bike' },
                  { id: 'WALKING', label: 'Walk' },
                  { id: 'TRANSIT', label: 'Transit' },
                ] as { id: TravelModeOption; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setTravelMode(m.id);
                    if (routeDestination) {
                      void computeRouteToPlace(routeDestination, m.id);
                    }
                  }}
                  className={`min-h-[34px] text-[11px] font-semibold rounded-lg transition-colors ${
                    travelMode === m.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {loadingRoute ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isBn ? 'রুট হিসাব হচ্ছে...' : 'Calculating route...'}</span>
              </div>
            ) : routeSummary ? (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {routeSummary.destinationName}
                </div>
                <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 font-semibold tabular-nums">
                  <span>{(routeSummary.distanceMeters / 1000).toFixed(2)} km</span>
                  <span>
                    {Math.max(1, Math.round(routeSummary.durationMillis / 60000))} mins
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn
                  ? 'যেকোনো মার্কারে "রুট দেখুন" ক্লিক করলে দূরত্ব ও সময় দেখাবে।'
                  : 'Select any meetup spot below to preview live distance and ETA.'}
              </p>
            )}
          </div>

          {/* Places List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
              <span>
                {isBn ? 'কাছাকাছি মিটআপ পয়েন্ট' : 'Nearby Meetup Spots'}
              </span>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {places.length}
              </span>
            </div>

            {loadingPlaces ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>{isBn ? 'জায়গা খোঁজা হচ্ছে...' : 'Finding meetup spots...'}</span>
              </div>
            ) : places.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {isBn
                  ? 'এই এলাকায় কোনো স্থান পাওয়া যায়নি। অন্য ক্যাটাগরি বা এলাকা চেষ্টা করুন।'
                  : 'No places found here. Try panning the map or switching categories.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {places.map((p) => {
                  const isSelected = selectedPlace?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border transition-colors text-xs space-y-1.5 ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlace(p);
                          map?.panTo(p.location);
                          map?.setZoom(15);
                        }}
                        className="w-full text-left space-y-0.5"
                      >
                        <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                          {p.displayName}
                        </div>
                        {p.formattedAddress && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {p.formattedAddress}
                          </div>
                        )}
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                          {typeof p.rating === 'number'
                            ? `★ ${p.rating.toFixed(1)}`
                            : 'Google Place'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlace(p);
                            void computeRouteToPlace(p);
                          }}
                          className="min-h-[30px] px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                        >
                          {isBn ? 'রুট' : 'Route'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            {isBn
              ? 'Google Maps Platform দ্বারা চালিত · লোকেশন ব্যবহার সম্পূর্ণ আপনার অনুমতির ওপর নির্ভরশীল।'
              : 'Powered by Google Maps Platform. Browser location is only used when you click Use My Location.'}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function EscrowMapScreen({ language, theme }: EscrowMapScreenProps) {
  const isBn = language === 'bn';
  const [apiKey, setApiKey] = useState<string>(() => {
    const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const definedKey =
      typeof __DEALKORO_GMP_API_KEY__ !== 'undefined' ? __DEALKORO_GMP_API_KEY__ : '';
    return (viteKey || definedKey || '').trim();
  });
  const [checkedServerKey, setCheckedServerKey] = useState(Boolean(apiKey));

  useEffect(() => {
    if (apiKey) {
      setCheckedServerKey(true);
      return;
    }
    let cancelled = false;
    fetch('/api/maps/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { apiKey?: string } | null) => {
        if (!cancelled && data?.apiKey) {
          setApiKey(data.apiKey.trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckedServerKey(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (!checkedServerKey) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>{isBn ? 'Google Maps প্রস্তুত করা হচ্ছে...' : 'Preparing Google Maps...'}</span>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
        <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          {isBn ? 'এস্ক্রো মিটআপ ম্যাপ' : 'Escrow Meetup Map'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {isBn
            ? 'Google Maps API key কনফিগার করা হলে এখানে লাইভ মিটআপ লোকেশন এবং রুট দেখাবে।'
            : 'Configure VITE_GOOGLE_MAPS_API_KEY in your environment to enable interactive meetup locations and live routing.'}
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language={isBn ? 'bn' : 'en'}
      region="BD"
      libraries={['places', 'marker', 'routes']}
    >
      <EscrowMapWorkspace language={language} theme={theme} />
    </APIProvider>
  );
}
