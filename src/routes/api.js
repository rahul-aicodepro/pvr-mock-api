// ============================================================
// PVR INOX MOCK API — Route Handlers
// ============================================================

const express = require('express');
const router = express.Router();
const { CITIES, MOVIES } = require('../data/masterData');
const { buildShowSchedule, generateSeatMap, getOccupancy, getAvailabilityStatus, getSeatsLeft } = require('../data/availabilityEngine');

// Helper: get today's date string
function getDateString(daysFromNow = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// Helper: validate city
function resolveCity(cityParam) {
  const key = cityParam?.toLowerCase();
  return CITIES[key] || null;
}

// Helper: validate movie
function resolveMovie(movieId) {
  return MOVIES[movieId] || null;
}

// ============================================================
// GET /api/cities
// List all cities with cinema counts
// ============================================================
router.get('/cities', (req, res) => {
  const result = Object.entries(CITIES).map(([key, city]) => ({
    cityKey: key,
    cityId: city.id,
    name: city.name,
    region: city.region,
    cinemaCount: city.cinemas.length,
    cinemas: city.cinemas
  }));

  res.json({
    status: "success",
    count: result.length,
    cities: result
  });
});

// ============================================================
// GET /api/cinemas?city=delhi
// List cinemas in a city
// ============================================================
router.get('/cinemas', (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ status: "error", message: "city query param required" });

  const cityData = resolveCity(city);
  if (!cityData) return res.status(404).json({ status: "error", message: `City '${city}' not found. Available: delhi, mumbai, bangalore, chennai, hyderabad, pune` });

  res.json({
    status: "success",
    city: cityData.name,
    cinemaCount: cityData.cinemas.length,
    cinemas: cityData.cinemas
  });
});

// ============================================================
// GET /api/movies?status=NOW_SHOWING|UPCOMING&city=delhi
// List movies — optionally filter by status
// ============================================================
router.get('/movies', (req, res) => {
  const { status, city, language, genre, format } = req.query;

  let movies = Object.values(MOVIES);

  if (status) {
    movies = movies.filter(m => m.status === status.toUpperCase());
  }
  if (language) {
    movies = movies.filter(m => m.languages.map(l => l.toLowerCase()).includes(language.toLowerCase()));
  }
  if (genre) {
    movies = movies.filter(m => m.genres.map(g => g.toLowerCase()).includes(genre.toLowerCase()));
  }
  if (format) {
    movies = movies.filter(m => m.formats.map(f => f.toLowerCase()).includes(format.toLowerCase()));
  }

  res.json({
    status: "success",
    count: movies.length,
    movies: movies.map(m => ({
      filmId: m.filmId,
      name: m.name,
      certification: m.certification,
      duration: m.duration,
      genres: m.genres,
      languages: m.languages,
      formats: m.formats,
      releaseDate: m.releaseDate,
      status: m.status,
      posterUrl: m.posterUrl
    }))
  });
});

// ============================================================
// GET /api/shows?movieId=36850&city=delhi&date=2026-06-23
// Get all shows for a movie in a city on a date
// ============================================================
router.get('/shows', (req, res) => {
  const { movieId, city, date } = req.query;

  if (!movieId) return res.status(400).json({ status: "error", message: "movieId is required" });
  if (!city)    return res.status(400).json({ status: "error", message: "city is required" });

  const movie = resolveMovie(movieId);
  if (!movie) return res.status(404).json({ status: "error", message: `Movie '${movieId}' not found` });

  const cityData = resolveCity(city);
  if (!cityData) return res.status(404).json({ status: "error", message: `City '${city}' not found` });

  const showDate = date || getDateString(0);
  const { format, cinemaId, language } = req.query;

  let allShows = [];

  cityData.cinemas.forEach(cinema => {
    if (cinemaId && cinema.id !== cinemaId) return;
    const shows = buildShowSchedule(movie, cinema, showDate, cityData.name);
    allShows = allShows.concat(shows);
  });

  // Filter by format
  if (format) {
    allShows = allShows.filter(s => s.format.toLowerCase() === format.toLowerCase());
  }

  // Filter by language
  if (language) {
    allShows = allShows.filter(s => s.availableLanguages.map(l => l.toLowerCase()).includes(language.toLowerCase()));
  }

  // Group by cinema
  const byCinema = {};
  allShows.forEach(show => {
    if (!byCinema[show.cinemaId]) {
      byCinema[show.cinemaId] = {
        cinemaId: show.cinemaId,
        cinemaName: show.cinemaName,
        area: show.area,
        shows: []
      };
    }
    byCinema[show.cinemaId].shows.push({
      showId: show.showId,
      showTime: show.showTime,
      format: show.format,
      language: show.language,
      pricing: show.pricing,
      availability: show.availability,
      bookingUrl: show.bookingUrl
    });
  });

  res.json({
    status: "success",
    movieId,
    movieName: movie.name,
    city: cityData.name,
    date: showDate,
    totalShows: allShows.length,
    cinemas: Object.values(byCinema)
  });
});

// ============================================================
// GET /api/shows/:showId/seats
// Get full seat map for a specific show
// ============================================================
router.get('/shows/:showId/seats', (req, res) => {
  const { showId } = req.params;

  // Parse showId: movieId-cinemaId-date-format-time
  const parts = showId.split('-');
  if (parts.length < 4) {
    return res.status(400).json({ status: "error", message: "Invalid showId format" });
  }

  const movieId = parts[0];
  const cinemaId = parts[1];
  const date = parts[2];
  const format = parts[3];
  const showTime = parts.slice(4).join(' ');

  const movie = resolveMovie(movieId);
  if (!movie) return res.status(404).json({ status: "error", message: "Movie not found" });

  // Find cinema across all cities
  let cinema = null;
  let cityName = '';
  Object.entries(CITIES).forEach(([key, cityData]) => {
    const found = cityData.cinemas.find(c => c.id === cinemaId);
    if (found) { cinema = found; cityName = cityData.name; }
  });
  if (!cinema) return res.status(404).json({ status: "error", message: "Cinema not found" });

  const occupancy = getOccupancy(movieId, cinemaId, date, showTime, format);
  const seatMap = generateSeatMap(occupancy, format);
  const availInfo = getAvailabilityStatus(occupancy);

  const { SEAT_CONFIG, PRICING } = require('../data/masterData');
  const config = SEAT_CONFIG[format] || SEAT_CONFIG['Standard'];
  const cityKey = cityName.toLowerCase();
  const basePrice = (PRICING[format] || PRICING['Standard'])[cityKey] || 300;

  res.json({
    status: "success",
    showId,
    movieId,
    movieName: movie.name,
    cinemaId,
    cinemaName: cinema.name,
    date,
    showTime,
    format,
    availability: {
      ...availInfo,
      occupancyPercent: occupancy,
      seatsLeft: getSeatsLeft(occupancy, format),
      totalSeats: config.totalSeats
    },
    pricing: {
      classic:  Math.round(basePrice * 0.85),
      prime:    basePrice,
      recliner: Math.round(basePrice * 1.35),
      currency: "INR"
    },
    legend: {
      AVAILABLE: "Available to book",
      BOOKED: "Already booked",
      BLOCKED: "Blocked/Unavailable"
    },
    seatMap
  });
});

// ============================================================
// GET /api/availability/quick?movieId=36850&city=delhi&date=2026-06-23
// Quick availability summary — no full seat map
// Perfect for chatbot responses
// ============================================================
router.get('/availability/quick', (req, res) => {
  const { movieId, city, date } = req.query;

  if (!movieId || !city) {
    return res.status(400).json({ status: "error", message: "movieId and city are required" });
  }

  const movie = resolveMovie(movieId);
  if (!movie) return res.status(404).json({ status: "error", message: "Movie not found" });

  const cityData = resolveCity(city);
  if (!cityData) return res.status(404).json({ status: "error", message: "City not found" });

  const showDate = date || getDateString(0);

  const summary = cityData.cinemas.map(cinema => {
    const shows = buildShowSchedule(movie, cinema, showDate, cityData.name);
    const byFormat = {};

    shows.forEach(show => {
      if (!byFormat[show.format]) byFormat[show.format] = [];
      byFormat[show.format].push({
        showTime: show.showTime,
        status: show.availability.status,
        label: show.availability.label,
        emoji: show.availability.emoji,
        seatsLeft: show.availability.seatsLeft,
        price: show.pricing.prime,
        bookingUrl: show.bookingUrl
      });
    });

    return {
      cinemaId: cinema.id,
      cinemaName: cinema.name,
      area: cinema.area,
      showsByFormat: byFormat,
      totalShows: shows.length,
      hasAvailableShows: shows.some(s => s.availability.bookable)
    };
  });

  res.json({
    status: "success",
    movieId,
    movieName: movie.name,
    city: cityData.name,
    date: showDate,
    cinemas: summary
  });
});

// ============================================================
// GET /api/availability/format?movieId=35277&city=delhi&format=IMAX&date=2026-06-26
// All IMAX (or any format) shows for a movie in a city
// ============================================================
router.get('/availability/format', (req, res) => {
  const { movieId, city, format, date } = req.query;

  if (!movieId || !city || !format) {
    return res.status(400).json({ status: "error", message: "movieId, city, and format are required" });
  }

  const movie = resolveMovie(movieId);
  if (!movie) return res.status(404).json({ status: "error", message: "Movie not found" });

  const cityData = resolveCity(city);
  if (!cityData) return res.status(404).json({ status: "error", message: "City not found" });

  if (!movie.formats.includes(format)) {
    return res.status(200).json({
      status: "success",
      message: `${movie.name} is not available in ${format} format`,
      shows: []
    });
  }

  const showDate = date || getDateString(0);
  let formatShows = [];

  cityData.cinemas.forEach(cinema => {
    const shows = buildShowSchedule(movie, cinema, showDate, cityData.name);
    const filtered = shows.filter(s => s.format === format);
    filtered.forEach(s => {
      formatShows.push({
        cinemaId: s.cinemaId,
        cinemaName: s.cinemaName,
        area: s.area,
        showTime: s.showTime,
        availability: s.availability,
        pricing: s.pricing,
        bookingUrl: s.bookingUrl
      });
    });
  });

  res.json({
    status: "success",
    movieId,
    movieName: movie.name,
    format,
    city: cityData.name,
    date: showDate,
    totalShows: formatShows.length,
    shows: formatShows
  });
});

// ============================================================
// GET /api/nowshowing?city=delhi
// All now showing movies with quick availability
// ============================================================
router.get('/nowshowing', (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ status: "error", message: "city is required" });

  const cityData = resolveCity(city);
  if (!cityData) return res.status(404).json({ status: "error", message: "City not found" });

  const nowShowingMovies = Object.values(MOVIES).filter(m => m.status === 'NOW_SHOWING');
  const date = getDateString(0);

  const result = nowShowingMovies.map(movie => {
    // Quick count of available shows across all cinemas
    let totalAvailableShows = 0;
    let totalSoldOutShows = 0;

    cityData.cinemas.forEach(cinema => {
      const shows = buildShowSchedule(movie, cinema, date, cityData.name);
      shows.forEach(s => {
        if (s.availability.bookable) totalAvailableShows++;
        else totalSoldOutShows++;
      });
    });

    return {
      filmId: movie.filmId,
      name: movie.name,
      certification: movie.certification,
      duration: movie.duration,
      genres: movie.genres,
      languages: movie.languages,
      formats: movie.formats,
      releaseDate: movie.releaseDate,
      posterUrl: movie.posterUrl,
      showSummary: {
        totalAvailableShows,
        totalSoldOutShows,
        cinemasShowing: cityData.cinemas.length
      }
    };
  });

  res.json({
    status: "success",
    city: cityData.name,
    date,
    movieCount: result.length,
    movies: result
  });
});

// ============================================================
// GET /api/cinema/:cinemaId/shows?date=2026-06-23
// All shows at a specific cinema on a date
// ============================================================
router.get('/cinema/:cinemaId/shows', (req, res) => {
  const { cinemaId } = req.params;
  const { date } = req.query;

  let cinema = null;
  let cityName = '';
  Object.entries(CITIES).forEach(([key, cityData]) => {
    const found = cityData.cinemas.find(c => c.id === cinemaId);
    if (found) { cinema = found; cityName = cityData.name; }
  });

  if (!cinema) return res.status(404).json({ status: "error", message: `Cinema '${cinemaId}' not found` });

  const showDate = date || getDateString(0);
  const nowShowingMovies = Object.values(MOVIES).filter(m => m.status === 'NOW_SHOWING');

  const result = nowShowingMovies.map(movie => {
    const shows = buildShowSchedule(movie, cinema, showDate, cityName);
    return {
      filmId: movie.filmId,
      movieName: movie.name,
      certification: movie.certification,
      genres: movie.genres,
      posterUrl: movie.posterUrl,
      shows: shows.map(s => ({
        showId: s.showId,
        showTime: s.showTime,
        format: s.format,
        language: s.language,
        pricing: s.pricing,
        availability: s.availability,
        bookingUrl: s.bookingUrl
      }))
    };
  });

  res.json({
    status: "success",
    cinemaId,
    cinemaName: cinema.name,
    city: cityName,
    date: showDate,
    movies: result
  });
});

// ============================================================
// GET /api/health
// Health check
// ============================================================
router.get('/health', (req, res) => {
  res.json({
    status: "ok",
    service: "PVR INOX Mock API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    movies: Object.keys(MOVIES).length,
    cities: Object.keys(CITIES).length,
    totalCinemas: Object.values(CITIES).reduce((sum, c) => sum + c.cinemas.length, 0)
  });
});

module.exports = router;
