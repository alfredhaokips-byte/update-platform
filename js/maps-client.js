/* Google Maps Places Autocomplete config — mirrors js/supabase-client.js's
   pattern (a placeholder you fill in, checked at runtime).

   Setup (see README for the full walkthrough):
   1. Create a Google Cloud project, attach a billing account to it (required
      even though a project this size stays within Google's free monthly
      Places credit — Google just won't serve Places API calls without one
      on file), then enable the "Places API".
   2. Create an API key (APIs & Services → Credentials → Create credentials
      → API key).
   3. Restrict it: Application restrictions → HTTP referrers → add your
      domain(s) (and http://localhost:* while developing). This is what
      actually keeps the key safe to ship client-side — Maps keys are
      designed to be public, the referrer restriction is the real boundary,
      the same way Supabase's anon key relies on RLS rather than secrecy.
   4. Paste the key below. */

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
const IS_MAPS_CONFIGURED = !GOOGLE_MAPS_API_KEY.startsWith("YOUR_");

let _mapsLoadPromise = null;

function loadGoogleMaps() {
  if (!IS_MAPS_CONFIGURED) return Promise.reject(new Error("Google Maps API key not configured"));
  if (window.google && window.google.maps && window.google.maps.places) return Promise.resolve();
  if (_mapsLoadPromise) return _mapsLoadPromise;
  _mapsLoadPromise = new Promise((resolve, reject) => {
    window.__onGoogleMapsLoaded = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&callback=__onGoogleMapsLoaded`;
    s.async = true;
    s.onerror = () => reject(new Error("Couldn't load Google Maps"));
    document.head.appendChild(s);
  });
  return _mapsLoadPromise;
}

/* Wires Places Autocomplete (restricted to India) onto a text input.
   onPlace({ locality, city, state, lat, lng }) fires only once the user
   picks a real suggestion from the dropdown — free-typed text that was
   never selected does NOT call onPlace, since only a real geocoded place
   gives us a trustworthy city/state to bucket "Nearby" by. */
async function mountPlacesAutocomplete(inputEl, onPlace) {
  await loadGoogleMaps();
  const autocomplete = new google.maps.places.Autocomplete(inputEl, {
    componentRestrictions: { country: "in" },
    fields: ["address_components", "geometry", "name"],
    types: ["geocode"],
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place || !place.address_components) return;
    const comp = (type) => {
      const c = place.address_components.find((c) => c.types.includes(type));
      return c ? c.long_name : null;
    };
    onPlace({
      locality: comp("sublocality") || comp("locality") || comp("administrative_area_level_2") || place.name,
      city: comp("locality") || comp("administrative_area_level_2") || place.name,
      state: comp("administrative_area_level_1"),
      lat: place.geometry && place.geometry.location ? place.geometry.location.lat() : null,
      lng: place.geometry && place.geometry.location ? place.geometry.location.lng() : null,
    });
  });
  return autocomplete;
}
