#  Seatify

**Pick the shadiest seat for your bus journey.**

Seatify calculates real sun exposure for every seat on your bus — based on your actual route, date, and departure time. No more squinting through a sun-drenched window for 4 hours.


## What It Does

You enter:
- Where you're traveling **from** and **to**
- Your **departure date and time**

Seatify tells you:
- Which seats get the **least sun** on your specific journey
- Whether the **left or right side** of the bus is shadier
- The **exact exposure %** for every single seat
- **Top 5 shadiest seats** to pick from instantly

---

##  How It Works

1. Your origin and destination are geocoded using **OpenStreetMap (Nominatim)**
2. The **actual road route** is fetched using **OSRM** (not just a straight line)
3. For every segment of the route, the **sun's position** is calculated using the `astral` library
4. The sun angle relative to the bus direction determines which side gets hit
5. Every seat (window / middle / aisle) is scored based on its position and side
6. Results are shown on an interactive bus layout

All calculations use **real solar physics** — results change based on season, time of day, and road direction.

---

## Tech Stack

| Part | Technology |
|------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Sun calculation | `astral` library |
| Road routing | OSRM (free & open source) |
| Geocoding | Nominatim (OpenStreetMap) |

**100% free. No paid APIs.**

---

## Run It Locally

### Prerequisites
- Python 3.10+
- Node.js 18+

---

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/seatify.git
cd seatify
```

---

### 2. Start the Backend

```bash
cd backend
python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at → `http://127.0.0.1:8000`

---

### 3. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at → `http://localhost:5173`

---

### 4. Open in Browser

Go to `http://localhost:5173`, enter your journey details and click **Find Best Seats**.

---


## Project Structure

```
seatify/
├── README.md
├── .gitignore
├── backend/
│   ├── main.py              # FastAPI app
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx          # Main React component
        ├── App.css          # Styles
        └── main.jsx         # Entry point
```

---

## FAQ

**Why do results change for different dates?**
Because the sun's position in the sky changes throughout the year. A seat that's shady in January may not be shady in June. That's intentional — Seatify uses real solar calculations.

**Does it work for any route in India?**
Yes, as long as both locations are in India and reachable by road.

**Is it free to use?**
Yes, completely. It uses only free, open-source APIs with no usage limits for personal use.

---

##  License

MIT License — free to use, modify, and distribute.