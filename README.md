# PVR INOX Mock API 🎬

Mock real-time availability API for the PVR INOX chatbot POC.  
Simulates seat availability, show timings, pricing, and seat maps across 6 cities.

---

## Quick Deploy (Render.com — Free, 2 minutes)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings auto-detected from `render.yaml`
5. Click **Deploy** → You get a live HTTPS URL

Your API will be live at:
```
https://pvr-mock-api.onrender.com
```

---

## Alternative: Railway.app (Also Free)

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Done — live in ~60 seconds

---

## Run Locally

```bash
npm install
npm start
# → http://localhost:3000
```

---

## API Endpoints

### Health Check
```
GET /api/health
```

### Cities
```
GET /api/cities
```
Returns all 6 cities with cinema lists.

---

### Cinemas in a City
```
GET /api/cinemas?city=delhi
```
**Cities:** `delhi`, `mumbai`, `bangalore`, `chennai`, `hyderabad`, `pune`

---

### Movies
```
GET /api/movies
GET /api/movies?status=NOW_SHOWING
GET /api/movies?status=UPCOMING
GET /api/movies?language=Hindi
GET /api/movies?genre=Action
GET /api/movies?format=IMAX
```

---

### Now Showing in a City
```
GET /api/nowshowing?city=delhi
```
Returns all now-showing movies with show count summaries.

---

### Show Schedule
```
GET /api/shows?movieId=36850&city=delhi&date=2026-06-23
GET /api/shows?movieId=35277&city=mumbai&format=IMAX
GET /api/shows?movieId=35277&city=delhi&format=4DX&date=2026-06-26
```

**Movie IDs:**
| ID | Movie |
|----|-------|
| 36850 | COCKTAIL 2 |
| 35277 | SUPERGIRL |
| 29988 | WELCOME TO THE JUNGLE |
| 35098 | THE ODYSSEY |
| 36637 | MINIONS AND MONSTERS |
| 35099 | DHAMAAL 4 |
| 35308 | RAMAYANA: PART 1 |
| 35312 | AVENGERS: DOOMSDAY |
| 36353 | KING |
| 34785 | TOXIC: A FAIRY TALE FOR GROWN-UPS |

---

### Full Seat Map
```
GET /api/shows/:showId/seats
```
Example showId from a `/api/shows` response.

Returns complete auditorium seat map with each seat's status (AVAILABLE/BOOKED).

---

### Quick Availability (Chatbot Optimised)
```
GET /api/availability/quick?movieId=36850&city=delhi
GET /api/availability/quick?movieId=35277&city=mumbai&date=2026-06-26
```
Lightweight response — ideal for chatbot to quickly summarise show availability without full seat map.

---

### Format-Specific Availability
```
GET /api/availability/format?movieId=35277&city=delhi&format=IMAX
GET /api/availability/format?movieId=35277&city=mumbai&format=4DX&date=2026-06-26
```

---

### All Shows at a Cinema
```
GET /api/cinema/DL002/shows
GET /api/cinema/MU004/shows?date=2026-06-25
```

**Cinema IDs (sample):**
| ID | Cinema |
|----|--------|
| DL001 | PVR Ambience Mall, Vasant Kunj |
| DL002 | PVR Select Citywalk, Saket |
| MU001 | PVR Juhu |
| MU004 | PVR Phoenix Palladium, Lower Parel |
| BL001 | PVR Orion Mall, Rajajinagar |

---

## Live PVR Proxy Endpoints

These routes call the scraped PVR APIs from `libs/pvrApiUrls.json` and attach the required headers:
`city`, `appVersion: 1.0`, `chain: PVR`, `country: INDIA`, `flow: PVRINOX`, `origin: https://www.pvrcinemas.com`, `platform: WEBSITE`, and `Authorization: Bearer`.

All live routes accept either `GET` query params or a `POST` JSON body.
When a route receives `city` without coordinates, it fills `lat` and `lng` from `libs/pvrCities.json`.

### Local PVR City List
```
GET /api/pvr/city-list
```

### PVR Cities
```
GET /api/pvr/cities?city=Delhi&lat=28.6139&lng=77.2090
GET /api/pvr/cities?city=Delhi
```

### PVR Cinemas
```
GET /api/pvr/cinemas?city=Delhi&lat=&lng=&text=
GET /api/pvr/cinemas?city=Delhi
```

### PVR Cinema-Wise Showtimes
```
GET /api/pvr/showtimes/cinemas?city=Delhi&dated=2026-06-26
GET /api/pvr/showtimes/cinemas?city=Delhi&date=2026-06-26
```

### PVR Movie-Wise Showtimes
```
GET /api/pvr/showtimes/movies?city=Delhi&dated=2026-06-26
GET /api/pvr/showtimes/movies?city=Delhi&date=2026-06-26
```

### PVR Cinema Sessions
```
GET /api/pvr/cinemas/DL001/sessions?city=Delhi&dated=2026-06-26
GET /api/pvr/sessions?city=Delhi&cid=DL001&date=2026-06-26
```

### PVR Offers
```
GET /api/pvr/offers?city=Mumbai-All&id=0&payment=false
POST /api/pvr/offers
```

### PVR Seat Layout / Availability
```
GET /api/pvr/seatlayout?city=Delhi&cid=348&dated=2026-06-27
GET /api/pvr/seatlayout?city=Delhi&cinemaName=PVR%20Select%20City%20Walk&date=2026-06-27
POST /api/pvr/seatlayout
```

This route uses a local PVR-style response template instead of calling PVR, so no `encrypted` token is required.
By default it fetches real PVR cinema/movie/show metadata from `/csessions` when `city` and `cid` are supplied, then injects that metadata into the local seat template.
The proxy randomizes seat availability per cinema/date/show seed, with available seats kept in the majority.
Pass `liveMeta=false` to skip the metadata lookup and use fully local demo metadata.

Each response returns the payload used under `payload` and the response body under `data`.

---

## Availability Status Values

| Status | Label | Emoji | Bookable |
|--------|-------|-------|----------|
| AVAILABLE | Available | ✅ | true |
| FILLING_FAST | Filling Fast | ⚡ | true |
| FAST_FILLING | Fast Filling | 🔥 | true |
| SOLD_OUT | Sold Out | ❌ | false |

---

## Seat Types & Pricing

| Type | Price Multiplier |
|------|-----------------|
| CLASSIC | 0.85x base price |
| PRIME | 1.0x base price |
| RECLINER | 1.35x base price |

---

## Formats Supported

`Standard`, `IMAX`, `4DX`, `3D`, `GOLD`, `PXL`, `DIRECTORS_CUT`, `SCREEN_X`, `ICE`, `ATMOS`, `MX4D`, `PLAYHOUSE`

---

## How to Connect to Flowise

In Flowise, add an **HTTP Tool** node:
```
Name: get_show_availability
URL: https://your-api-url.onrender.com/api/availability/quick
Method: GET
Params: movieId, city, date
```

The chatbot can call this tool whenever a user asks about seat availability or show timings.

---

## Notes

- Availability is **deterministic** — same movie + cinema + date + time always returns the same result
- Prime time (6 PM–10 PM) and weekends show higher occupancy
- IMAX and 4DX shows fill up faster than standard
- GOLD and Director's Cut shows have lower occupancy (premium audience)
