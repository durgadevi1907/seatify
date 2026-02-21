import { useState, useCallback, useRef, useEffect } from "react";
import "./App.css";

const TOTAL_ROWS = 12;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function LocationInput({ label, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedValue = useDebounce(value, 350);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debouncedValue.length < 2) {
      const t = setTimeout(() => { setSuggestions([]); setShowSuggestions(false); }, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedValue)}&format=json&limit=5&addressdetails=1&accept-language=en&countrycodes=in`,
          { headers: { "User-Agent": "SeatifyApp" } }
        );
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [debouncedValue]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="input-group" ref={containerRef}>
      <label>{label}</label>
      <div className="autocomplete-wrapper">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => suggestions.length && setShowSuggestions(true)}
          className="location-input"
          autoComplete="off"
        />
        {loading && <span className="input-spinner" />}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((s, i) => (
              <li key={i} onMouseDown={() => {
                // Use only the first part of display_name (city name) for cleaner input
                const cityName = s.display_name.split(",")[0];
                onChange(cityName);
                setShowSuggestions(false);
                setSuggestions([]);
              }}>
                <span className="suggestion-icon">📍</span>
                {s.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tooltip({ children, content }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && <div className="tooltip-box">{content}</div>}
    </div>
  );
}

function SeatSVG({ seatData, onSeatClick, selectedSeat }) {
  const getSeatColor = (seatId) => {
    if (!seatData) return "#cbd5e1";
    const seat = seatData[seatId];
    if (!seat) return "#cbd5e1";
    const r = seat.exposure_ratio;
    if (r < 0.2) return "#22c55e";
    if (r < 0.6) return "#f59e0b";
    return "#ef4444";
  };

  const renderSeat = (id, x, y, label) => {
    const color = getSeatColor(id);
    const seat = seatData?.[id];
    const isSelected = selectedSeat === id;
    const isDimmed = seat?._dimmed; // ✅ filter support

    return (
      <g
        key={id}
        className="seat-group"
        onClick={() => !isDimmed && onSeatClick(id)}
        style={{
          cursor: seatData && !isDimmed ? "pointer" : "default",
          opacity: isDimmed ? 0.12 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <rect
          id={id}
          x={x} y={y}
          width="45" height="40"
          rx="6"
          fill={color}
          stroke={isSelected ? "#7c3aed" : "#94a3b8"}
          strokeWidth={isSelected ? "3" : "1.5"}
          className="seat-rect"
          style={{ transition: "fill 0.4s ease, stroke 0.2s ease" }}
        />
        {isSelected && (
          <rect x={x + 1} y={y + 1} width="43" height="38" rx="5"
            fill="none" stroke="#c4b5fd" strokeWidth="1.5" strokeDasharray="4 2" />
        )}
        <text x={x + 22.5} y={y + 24} fontSize="9" fill="white"
          textAnchor="middle" fontWeight="600" fontFamily="'DM Mono', monospace">
          {label}
        </text>
        {seat && (
          <text x={x + 22.5} y={y + 35} fontSize="7" fill="rgba(255,255,255,0.8)"
            textAnchor="middle" fontFamily="'DM Mono', monospace">
            {Math.round(seat.exposure_ratio * 100)}%
          </text>
        )}
      </g>
    );
  };

  return (
    <svg width="500" height="920" viewBox="0 0 500 920" className="bus-svg">
      <rect x="20" y="20" width="460" height="880" rx="40"
        fill="#f8fafc" stroke="#334155" strokeWidth="3" />
      <rect x="40" y="30" width="420" height="85" rx="20"
        fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1.5" />
      <text x="250" y="82" fontSize="11" fill="#0c4a6e"
        textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="600">
        FRONT
      </text>
      <rect x="378" y="50" width="54" height="42" rx="6" fill="#475569" stroke="#334155" />
      <text x="405" y="76" fontSize="10" fill="white" textAnchor="middle"
        fontFamily="'DM Sans', sans-serif" fontWeight="600">Driver</text>
      <circle cx="348" cy="71" r="16" stroke="#334155" strokeWidth="3" fill="none" />
      <circle cx="348" cy="71" r="4" fill="#334155" />
      <rect x="68" y="50" width="54" height="42" rx="6" fill="#64748b" stroke="#334155" />
      <text x="95" y="76" fontSize="10" fill="white" textAnchor="middle"
        fontFamily="'DM Sans', sans-serif" fontWeight="600">Cond.</text>
      <rect x="220" y="130" width="60" height="740" rx="4" fill="#e2e8f0" />
      <text x="250" y="510" fontSize="9" fill="#94a3b8" textAnchor="middle"
        fontFamily="'DM Sans', sans-serif" transform="rotate(-90, 250, 510)">
        AISLE
      </text>
      {[...Array(TOTAL_ROWS)].map((_, i) => (
        <text key={i} x="250" y={152 + i * 62} fontSize="9"
          fill="#64748b" textAnchor="middle"
          fontFamily="'DM Mono', monospace">
          {i + 1}
        </text>
      ))}
      <text x="105" y="125" fontSize="10" fill="#64748b" textAnchor="middle"
        fontFamily="'DM Sans', sans-serif" fontWeight="600" letterSpacing="2">LEFT</text>
      <text x="368" y="125" fontSize="10" fill="#64748b" textAnchor="middle"
        fontFamily="'DM Sans', sans-serif" fontWeight="600" letterSpacing="2">RIGHT</text>
      {[...Array(TOTAL_ROWS)].map((_, i) => {
        const row = i + 1;
        const y = 133 + i * 62;
        return (
          <g key={row}>
            {renderSeat(`L${row}A`, 60, y, `${row}A`)}
            {renderSeat(`L${row}B`, 115, y, `${row}B`)}
            {renderSeat(`R${row}A`, 290, y, `${row}A`)}
            {renderSeat(`R${row}B`, 345, y, `${row}B`)}
            {renderSeat(`R${row}C`, 400, y, `${row}C`)}
          </g>
        );
      })}
      {!seatData && (
        <rect x="20" y="20" width="460" height="880" rx="40"
          fill="url(#shimmer)" opacity="0.15" />
      )}
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
          <stop offset="50%" stopColor="#94a3b8" stopOpacity="1" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
          <animateTransform attributeName="gradientTransform" type="translate"
            from="-1 0" to="2 0" dur="1.5s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SeatDetailPanel({ seat, onClose }) {
  if (!seat) return null;
  const ratio = seat.exposure_ratio;
  const level = ratio < 0.2 ? "low" : ratio < 0.6 ? "moderate" : "high";
  const levelLabel = ratio < 0.2 ? "Low ✓" : ratio < 0.6 ? "Moderate ⚠" : "High ✗";
  const advice = ratio < 0.2
    ? "Great choice! Minimal sun exposure throughout your journey."
    : ratio < 0.6
    ? "Some sun exposure expected. Consider a window shade or light clothing."
    : "High sun exposure. Consider sunscreen or switching to the other side.";

  return (
    <div className={`seat-detail-panel ${level}`}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <div className="seat-detail-header">
        <span className="seat-detail-id">{seat.seat_id}</span>
        <span className={`exposure-badge-large ${level}`}>{levelLabel}</span>
      </div>
      <div className="seat-detail-stats">
        <div className="stat">
          <span className="stat-label">Position</span>
          <span className="stat-value">{seat.position}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Side</span>
          <span className="stat-value">{seat.side}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Sun Exposure</span>
          <span className="stat-value">{seat.exposure_minutes} mins</span>
        </div>
        <div className="stat">
          <span className="stat-label">Exposure %</span>
          <span className="stat-value">{Math.round(ratio * 100)}%</span>
        </div>
      </div>
      <div className="exposure-bar-wrapper">
        <div className="exposure-bar-track">
          <div className="exposure-bar-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
      <p className="seat-advice">{advice}</p>
    </div>
  );
}

export default function App() {
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [ampm, setAmpm] = useState("AM");
  const [journeyDate, setJourneyDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seatMap, setSeatMap] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedSeatData, setSelectedSeatData] = useState(null);

  const getFilteredSeatMap = useCallback(() => {
    if (!seatMap) return null;
    if (selectedFilter === "all") return seatMap;
    return Object.fromEntries(
      Object.entries(seatMap).map(([id, seat]) => {
        const r = seat.exposure_ratio;
        let visible = true;
        if (selectedFilter === "low" && r >= 0.2) visible = false;
        if (selectedFilter === "moderate" && (r < 0.2 || r >= 0.6)) visible = false;
        if (selectedFilter === "high" && r < 0.6) visible = false;
        return [id, { ...seat, _dimmed: !visible }];
      })
    );
  }, [seatMap, selectedFilter]);

  const handleSeatClick = useCallback((id) => {
    if (!seatMap) return;
    setSelectedSeat(id);
    setSelectedSeatData(seatMap[id] || null);
  }, [seatMap]);

  const findSeats = async () => {
    setError("");
    if (!startLocation || !endLocation || !hour || !minute || !journeyDate) {
      setError("Please fill all fields."); return;
    }
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);
    if (hourNum < 1 || hourNum > 12) { setError("Enter a valid hour (1–12)"); return; }
    if (minuteNum < 0 || minuteNum > 59) { setError("Enter valid minutes (0–59)"); return; }

    let hour24 = hourNum;
    if (ampm === "PM" && hourNum !== 12) hour24 = hourNum + 12;
    else if (ampm === "AM" && hourNum === 12) hour24 = 0;
    const time24 = `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

    try {
      setLoading(true);
      setSeatMap(null);
      setSummary(null);
      setSelectedSeat(null);
      setSelectedSeatData(null);

      const res = await fetch(
        `http://127.0.0.1:8000/seat_recommendation?start_location=${encodeURIComponent(startLocation)}&end_location=${encodeURIComponent(endLocation)}&time=${time24}&date=${journeyDate}`
      );

      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      if (data.error) { setError(data.error); return; }

      const map = {};
      data.seats.forEach(seat => { map[seat.seat_id] = seat; });
      setSeatMap(map);
      setSummary({
        leftMins: Math.round(data.front_left_minutes + data.back_left_minutes),
        rightMins: Math.round(data.front_right_minutes + data.back_right_minutes),
        time: `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`,
        date: journeyDate,
      });
    } catch (e) {
      console.error(e);
      setError("Unable to connect to backend. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const getBestSeats = () => {
    if (!seatMap) return [];
    return Object.values(seatMap)
      .filter(s => s.exposure_ratio < 0.2)
      .sort((a, b) => a.exposure_ratio - b.exposure_ratio)
      .slice(0, 5);
  };

  const betterSide = summary
    ? (summary.leftMins <= summary.rightMins ? "LEFT" : "RIGHT")
    : null;

  return (
    <div className="app-wrapper">
      <div className="app-container">

        <header className="app-header">
          <div className="logo-mark">☀</div>
          <h1>Seatify</h1>
          <p className="subtitle">Pick the shadiest seat for your bus journey</p>
        </header>

        <div className="legend">
          {[
            { color: "#22c55e", label: "Low Exposure", sub: "< 20%" },
            { color: "#f59e0b", label: "Moderate", sub: "20–60%" },
            { color: "#ef4444", label: "High Exposure", sub: "> 60%" },
          ].map(item => (
            <Tooltip key={item.label} content={`Seats with ${item.sub} of max sun exposure`}>
              <div className="legend-item">
                <div className="legend-color" style={{ background: item.color }} />
                <div>
                  <div className="legend-label">{item.label}</div>
                  <div className="legend-sub">{item.sub}</div>
                </div>
              </div>
            </Tooltip>
          ))}
        </div>

        <div className="controls">
          <LocationInput label="From" value={startLocation} onChange={setStartLocation} placeholder="e.g. Chennai" />
          <LocationInput label="To" value={endLocation} onChange={setEndLocation} placeholder="e.g. Bangalore" />

          <div className="input-group">
            <label>Date</label>
            <input
              type="date"
              value={journeyDate}
              onChange={e => setJourneyDate(e.target.value)}
              className="location-input date-input"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="input-group time-group">
            <label>Departure Time</label>
            <div className="time-picker-container">
              <select value={hour} onChange={e => setHour(e.target.value)} className="time-select hour-select">
                <option value="">HH</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span className="time-separator">:</span>
              <select value={minute} onChange={e => setMinute(e.target.value)} className="time-select minute-select">
                <option value="">MM</option>
                {[...Array(60)].map((_, i) => (
                  <option key={i} value={i.toString().padStart(2, "0")}>{i.toString().padStart(2, "0")}</option>
                ))}
              </select>
              <select value={ampm} onChange={e => setAmpm(e.target.value)} className="ampm-select">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <button onClick={findSeats} disabled={loading} className="find-button">
            {loading ? <><span className="btn-spinner" /> Calculating...</> : "☀ Find Best Seats"}
          </button>
        </div>

        {error && <div className="error-message">⚠ {error}</div>}

        {loading && (
          <div className="loading-message">
            <div className="loading-orbit">
              <div className="loading-planet" />
            </div>
            <div>
              <p className="loading-title">Calculating sun trajectory...</p>
              <p className="loading-sub">Fetching route · Computing solar angles · Scoring seats</p>
            </div>
          </div>
        )}

        {seatMap && (
          <div className="recommendations-panel">
            <div className="panel-header">
              <h2>Top Picks</h2>
              {betterSide && (
                <span className="side-badge">
                  {betterSide} side is shadier today
                </span>
              )}
            </div>

            <div className="best-seats">
              {getBestSeats().length === 0 && (
                <p className="no-seats">No low-exposure seats found for this route and time.</p>
              )}
              {getBestSeats().map(seat => (
                <button key={seat.seat_id}
                  className={`best-seat-card ${selectedSeat === seat.seat_id ? "selected" : ""}`}
                  onClick={() => handleSeatClick(seat.seat_id)}>
                  <span className="seat-id">{seat.seat_id}</span>
                  <span className="seat-position">{seat.position}</span>
                  <span className="exposure-badge low">{Math.round(seat.exposure_ratio * 100)}%</span>
                </button>
              ))}
            </div>

            <div className="filter-bar">
              <span>Filter:</span>
              {["all", "low", "moderate", "high"].map(f => (
                <button key={f}
                  className={`filter-btn ${f} ${selectedFilter === f ? "active" : ""}`}
                  onClick={() => setSelectedFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="main-layout">
          <div className="bus-container">
            <SeatSVG
              seatData={getFilteredSeatMap()}
              onSeatClick={handleSeatClick}
              selectedSeat={selectedSeat}
            />
          </div>

          <div className="side-panel">
            {selectedSeatData ? (
              <SeatDetailPanel
                seat={selectedSeatData}
                onClose={() => { setSelectedSeat(null); setSelectedSeatData(null); }}
              />
            ) : (
              <div className="side-panel-placeholder">
                <div className="placeholder-icon">🪑</div>
                <p>Click any seat to see<br />detailed sun exposure info</p>
              </div>
            )}

            {summary && (
              <div className="journey-summary">
                <h3>Journey Summary</h3>
                <div className="summary-row">
                  <span>📅</span>
                  <span>{new Date(summary.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="summary-row">
                  <span>🕐</span>
                  <span>Departure: {summary.time}</span>
                </div>
                <div className="exposure-grid">
                  <div className={`exposure-card ${summary.leftMins <= summary.rightMins ? "better" : ""}`}>
                    <span className="ec-label">Left Side</span>
                    <span className="ec-value">{summary.leftMins} min</span>
                    {summary.leftMins <= summary.rightMins && <span className="better-tag">Better</span>}
                  </div>
                  <div className={`exposure-card ${summary.rightMins < summary.leftMins ? "better" : ""}`}>
                    <span className="ec-label">Right Side</span>
                    <span className="ec-value">{summary.rightMins} min</span>
                    {summary.rightMins < summary.leftMins && <span className="better-tag">Better</span>}
                  </div>
                </div>
                <p className="tip">
                  💡 Green seats offer the least sun on this route. Aisle seats always have less exposure than window seats.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}