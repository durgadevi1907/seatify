from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from astral import Observer
from astral.sun import azimuth, elevation
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from functools import lru_cache
import math
import httpx
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Seatify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_geocode_cache: dict[str, tuple[float, float] | None] = {}
_route_cache: dict[str, tuple[list, float]] = {}

TOTAL_ROWS = 12
SIDE_THRESHOLD = 30
SAMPLE_INTERVAL_KM = 5.0


def normalize(angle: float) -> float:
    return (angle + 180) % 360 - 180


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


async def geocode_location(place_name: str) -> tuple[float, float] | None:
    key = place_name.strip().lower()
    if key in _geocode_cache:
        return _geocode_cache[key]

    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": place_name, "format": "json", "limit": 1}
    headers = {"User-Agent": "SeatifyApp/2.0"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if not data:
            _geocode_cache[key] = None
            return None

        result = (float(data[0]["lat"]), float(data[0]["lon"]))
        _geocode_cache[key] = result
        logger.info(f"Geocoded '{place_name}' → {result}")
        return result

    except Exception as e:
        logger.warning(f"Geocoding failed for '{place_name}': {e}")
        _geocode_cache[key] = None
        return None


async def get_route(
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float
) -> tuple[list, float]:
    key = f"{start_lat:.4f},{start_lon:.4f};{end_lat:.4f},{end_lon:.4f}"
    if key in _route_cache:
        return _route_cache[key]

    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
        f"?overview=full&geometries=geojson"
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    coords = data["routes"][0]["geometry"]["coordinates"]
    duration = data["routes"][0]["duration"]
    _route_cache[key] = (coords, duration)
    logger.info(f"Route fetched: {len(coords)} points, {duration/60:.1f} min")
    return coords, duration


def compute_exposure(
    coords: list,
    total_duration: float,
    dt: datetime,
) -> dict:
    front_left = back_left = front_right = back_right = 0.0

    segment_distances = []
    total_distance = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        d = haversine(lat1, lon1, lat2, lon2)
        segment_distances.append(d)
        total_distance += d

    if total_distance == 0:
        return dict(front_left=0, back_left=0, front_right=0, back_right=0)

    current_time = dt

    for i, seg_dist in enumerate(segment_distances):
        seg_time_s = (seg_dist / total_distance) * total_duration

        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        seg_bearing = calculate_bearing(lat1, lon1, lat2, lon2)

        n_sub = max(1, math.ceil(seg_dist / SAMPLE_INTERVAL_KM))
        sub_time_s = seg_time_s / n_sub

        for sub in range(n_sub):
            frac_mid = (sub + 0.5) / n_sub

            sub_lat = lat1 + (lat2 - lat1) * frac_mid
            sub_lon = lon1 + (lon2 - lon1) * frac_mid
            sub_time = current_time + timedelta(seconds=seg_time_s * frac_mid)

            observer = Observer(latitude=sub_lat, longitude=sub_lon)
            sun_az = azimuth(observer, sub_time)
            sun_el = elevation(observer, sub_time)

            if sun_el > 0:
                relative = normalize(sun_az - seg_bearing)
                abs_rel = abs(relative)

                if SIDE_THRESHOLD <= abs_rel <= 150:
                    mins = sub_time_s / 60

                    if relative > 0:
                        if abs_rel <= 90:
                            front_right += mins
                        else:
                            back_right += mins
                    else:
                        if abs_rel <= 90:
                            front_left += mins
                        else:
                            back_left += mins

        current_time += timedelta(seconds=seg_time_s)

    return dict(
        front_left=front_left,
        back_left=back_left,
        front_right=front_right,
        back_right=back_right,
    )


def build_seat_list(exposure: dict, total_rows: int = TOTAL_ROWS) -> list[dict]:
    front_left   = exposure["front_left"]
    back_left    = exposure["back_left"]
    front_right  = exposure["front_right"]
    back_right   = exposure["back_right"]

    seats = []

    for row in range(1, total_rows + 1):
        front_w = (total_rows - row) / total_rows
        back_w  = row / total_rows

        left_base  = front_w * front_left  + back_w * back_left
        right_base = front_w * front_right + back_w * back_right

        seats += [
            dict(seat_id=f"L{row}A", row=row, side="LEFT",  position="WINDOW", exposure_minutes=round(left_base  * 1.00, 2)),
            dict(seat_id=f"L{row}B", row=row, side="LEFT",  position="AISLE",  exposure_minutes=round(left_base  * 0.25, 2)),
            dict(seat_id=f"R{row}C", row=row, side="RIGHT", position="WINDOW", exposure_minutes=round(right_base * 1.00, 2)),
            dict(seat_id=f"R{row}B", row=row, side="RIGHT", position="MIDDLE", exposure_minutes=round(right_base * 0.40, 2)),
            dict(seat_id=f"R{row}A", row=row, side="RIGHT", position="AISLE",  exposure_minutes=round(right_base * 0.15, 2)),
        ]

    max_exp = max((s["exposure_minutes"] for s in seats), default=0)
    for seat in seats:
        seat["exposure_ratio"] = round(seat["exposure_minutes"] / max_exp, 3) if max_exp > 0 else 0.0

    return seats


@app.get("/seat_recommendation")
async def seat_recommendation(
    start_location: str,
    end_location: str,
    time: str,
    date: str | None = None,
):
    start_coords, end_coords = await asyncio.gather(
        geocode_location(start_location),
        geocode_location(end_location),
    )

    if not start_coords:
        raise HTTPException(status_code=400, detail=f"Could not find location: '{start_location}'")
    if not end_coords:
        raise HTTPException(status_code=400, detail=f"Could not find location: '{end_location}'")

    start_lat, start_lon = start_coords
    end_lat, end_lon = end_coords

    try:
        journey_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now(ZoneInfo("Asia/Kolkata")).date()
        dt = datetime.strptime(f"{journey_date} {time}", "%Y-%m-%d %H:%M")
        dt = dt.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date or time format: {e}")

    try:
        coords, total_duration = await get_route(start_lat, start_lon, end_lat, end_lon)
    except Exception as e:
        logger.error(f"Route fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not fetch route. Please try again.")

    exposure = compute_exposure(coords, total_duration, dt)
    seats = build_seat_list(exposure)

    return {
        "front_left_minutes":  round(exposure["front_left"],  2),
        "back_left_minutes":   round(exposure["back_left"],   2),
        "front_right_minutes": round(exposure["front_right"], 2),
        "back_right_minutes":  round(exposure["back_right"],  2),
        "seats": seats,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}