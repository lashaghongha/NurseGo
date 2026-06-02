import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const homeIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">📍</div>',
  iconSize: [32, 32], iconAnchor: [16, 32],
});

// რუკაზე დაჭერა → pin
function ClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng); } });
  return null;
}

// Pin გადაადგილება რომ map-ი re-center-დეს
function MapMover({ center }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (center) {
      if (first.current) { map.setView(center, 16); first.current = false; }
      else map.panTo(center);
    }
  }, [center]);
  return null;
}

const TBILISI_CENTER = [41.7151, 44.8271];
const KNOWN_DISTRICTS = ['ვაკე','საბურთალო','გლდანი','დიდუბე','ნაძალადევი','ისანი','სამგორი','კრწანისი','დიღომი','ვარკეთილი'];

export default function LocationPicker({ value, onChange, onAddressChange, onDistrictDetected }) {
  // value = { lat, lng, address }
  const [pos, setPos] = useState(value?.lat ? [value.lat, value.lng] : null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // forward geocode — მისამართი → კოორდინატები
  const geocodeAddress = useCallback(async (addr) => {
    if (!addr || addr.length < 4) return;
    setSearching(true);
    try {
      const q = encodeURIComponent(`${addr}, თბილისი, საქართველო`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ge`,
        { headers: { 'Accept-Language': 'ka' } }
      );
      const data = await res.json();
      if (data[0]) {
        const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setPos(latlng);
        onChange({ lat: latlng[0], lng: latlng[1] });
        // უბნის ავტო-განსაზღვრა display_name-დან
        const displayName = data[0].display_name || '';
        const found = KNOWN_DISTRICTS.find(d => displayName.includes(d));
        if (found && onDistrictDetected) onDistrictDetected(found);
      }
    } catch {}
    setSearching(false);
  }, [onChange, onDistrictDetected]);

  // reverse geocode — კოორდინატები → მისამართი + უბანი
  const reverseGeocode = useCallback(async (latlng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json`,
        { headers: { 'Accept-Language': 'ka' } }
      );
      const data = await res.json();
      if (data?.display_name) {
        const r = data.address;
        const short = [r.road, r.house_number]
          .filter(Boolean).join(', ');
        onAddressChange(short || data.display_name.split(',')[0].trim());

        // უბნის ავტო-განსაზღვრა — suburb / neighbourhood / quarter
        const districtHint = [
          r.suburb, r.neighbourhood, r.quarter, r.city_district, data.display_name
        ].filter(Boolean).join(' ');

        const found = KNOWN_DISTRICTS.find(d => districtHint.includes(d));
        if (found && onDistrictDetected) onDistrictDetected(found);
      }
    } catch {}
  }, [onAddressChange, onDistrictDetected]);

  const handlePick = useCallback((latlng) => {
    const coord = [latlng.lat, latlng.lng];
    setPos(coord);
    onChange({ lat: latlng.lat, lng: latlng.lng });
    reverseGeocode(coord);
  }, [onChange, reverseGeocode]);

  // მისამართის ველის ცვლილება → debounced geocode
  const handleAddressInput = (val) => {
    onAddressChange(val);
    clearTimeout(debounceRef.current);
    // debounce შემცირება 500ms-მდე — უფრო სწრაფი რეაგირება
    debounceRef.current = setTimeout(() => geocodeAddress(val), 500);
  };

  // გარე კოდს საშუალება მისცემს მიმდინარე pos-ი წაიკითხოს
  useEffect(() => {
    if (pos) onChange({ lat: pos[0], lng: pos[1] });
  }, [pos]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          type="text"
          className="form-input"
          placeholder="ქუჩა, სახლი, ბინა..."
          value={value?.address || ''}
          onChange={e => handleAddressInput(e.target.value)}
        />
        {searching && (
          <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'var(--gray)' }}>
            🔍 ეძებს...
          </span>
        )}
      </div>

      <div style={{ borderRadius: 14, overflow: 'hidden', border: '2px solid #e2e8f0', position: 'relative' }}>
        <MapContainer
          center={pos || TBILISI_CENTER}
          zoom={pos ? 16 : 13}
          style={{ width: '100%', height: 280 }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <ClickHandler onPick={handlePick} />
          {pos && <MapMover center={pos} />}
          {pos && <Marker position={pos} icon={homeIcon} />}
        </MapContainer>

        {!pos && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(255,255,255,0.92)', borderRadius: 10,
            padding: '8px 16px', fontSize: 13, color: 'var(--gray)',
            pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,.1)',
          }}>
            📍 რუკაზე დააჭირე მისამართის მოსანიშნად
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 6 }}>
        💡 ჩაწერე მისამართი ან პირდაპირ რუკაზე დააჭირე — pin ავტომატურად დაისმება
      </div>
    </div>
  );
}
