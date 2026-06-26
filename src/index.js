// ============================================================
// PVR INOX MOCK API — Main Server
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const apiRoutes = require('./routes/api');
const pvrLiveRoutes = require('./routes/pvrLive');

const app = express();
const PORT = process.env.PORT || 3002;

// ── Middleware ────────────────────────────────────────────────
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'city', 'chain', 'appVersion', 'platform', 'country', 'flow']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// ── Routes ───────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api/pvr', pvrLiveRoutes);

// ── Root ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: "PVR INOX Mock API",
    version: "1.0.0",
    description: "Mock real-time availability API for PVR INOX POC",
    endpoints: {
      health:             "GET /api/health",
      cities:             "GET /api/cities",
      cinemas:            "GET /api/cinemas?city=delhi",
      movies:             "GET /api/movies?status=NOW_SHOWING&language=Hindi&genre=Action",
      shows:              "GET /api/shows?movieId=36850&city=delhi&date=2026-06-23",
      showSeats:          "GET /api/shows/:showId/seats",
      quickAvailability:  "GET /api/availability/quick?movieId=36850&city=delhi&date=2026-06-23",
      formatAvailability: "GET /api/availability/format?movieId=35277&city=delhi&format=IMAX",
      nowShowing:         "GET /api/nowshowing?city=delhi",
      cinemaShows:        "GET /api/cinema/:cinemaId/shows?date=2026-06-23",
      pvrCities:          "GET /api/pvr/cities?city=Delhi&lat=28.6139&lng=77.2090",
      pvrCityList:        "GET /api/pvr/city-list",
      pvrCinemas:         "GET /api/pvr/cinemas?city=Delhi",
      pvrCinemaShowtimes: "GET /api/pvr/showtimes/cinemas?city=Delhi&dated=2026-06-26",
      pvrMovieShowtimes:  "GET /api/pvr/showtimes/movies?city=Delhi&dated=2026-06-26",
      pvrCinemaSessions:  "GET /api/pvr/cinemas/:cinemaId/sessions?city=Delhi&dated=2026-06-26",
      pvrOffers:          "GET /api/pvr/offers?city=Mumbai-All&id=0&payment=false",
      pvrSeatLayout:      "GET /api/pvr/seatlayout?city=Delhi&cid=348&dated=2026-06-27"
    },
    availableCities: ["delhi", "mumbai", "bangalore", "chennai", "hyderabad", "pune"],
    sampleMovieIds: {
      "36850": "COCKTAIL 2",
      "35277": "SUPERGIRL",
      "29988": "WELCOME TO THE JUNGLE",
      "35098": "THE ODYSSEY (upcoming)",
      "36637": "MINIONS AND MONSTERS (upcoming)"
    }
  });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.path} not found`,
    hint: "Visit / for available endpoints"
  });
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   PVR INOX Mock API — Running!         ║
║   http://localhost:${PORT}               ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
