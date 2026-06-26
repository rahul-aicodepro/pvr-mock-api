// ============================================================
// PVR INOX Live API Proxy Routes
// ============================================================

const express = require('express');
const pvrApiUrls = require('../../libs/pvrApiUrls.json');
const pvrCities = require('../../libs/pvrCities.json');
const { createSeatLayoutTemplate } = require('../data/seatLayoutTemplate');

const router = express.Router();

const REQUIRED_HEADERS = {
  appVersion: '1.0',
  chain: 'PVR',
  country: 'INDIA',
  origin: 'https://www.pvrcinemas.com',
  platform: 'WEBSITE',
  flow: 'PVRINOX'
};

function getRequestValue(req, key, fallback = '') {
  return req.body?.[key] ?? req.query?.[key] ?? fallback;
}

function getLngRequestValue(req, fallback = '') {
  return req.body?.lng ?? req.query?.lng ?? req.body?.long ?? req.query?.long ?? fallback;
}

function coercePayloadValue(value, defaultValue) {
  if (typeof defaultValue === 'number' && value !== '') {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? defaultValue : numberValue;
  }

  if (typeof defaultValue === 'boolean' && value !== '') {
    if (value === true || value === false) return value;
    if (String(value).toLowerCase() === 'true') return true;
    if (String(value).toLowerCase() === 'false') return false;
    return defaultValue;
  }

  return value;
}

function normalizeDate(value) {
  return value || 'NA';
}

function normalizeCoordinate(value) {
  return value === undefined || value === null || value === '' ? '0.000' : String(value);
}

function normalizeCityName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function findCity(city) {
  const normalizedCity = normalizeCityName(city);
  if (!normalizedCity) return null;

  return pvrCities.find((entry) => normalizeCityName(entry.city) === normalizedCity) || null;
}

function getCityFromRequest(req, payload = {}) {
  return getRequestValue(req, 'city', payload.city || '');
}

function buildCoordinateOverrides(req, payload = {}, options = {}) {
  const includeCity = options.includeCity !== false;
  const city = getCityFromRequest(req, payload);
  const cityData = findCity(city);
  const lat = getRequestValue(req, 'lat', '');
  const lng = getLngRequestValue(req, '');

  const coordinates = {
    lat: normalizeCoordinate(lat || cityData?.latitude || payload.lat),
    lng: normalizeCoordinate(lng || cityData?.longitude || payload.lng)
  };

  return includeCity ? { city: city || payload.city, ...coordinates } : coordinates;
}

function buildHeaders(city, chain = REQUIRED_HEADERS.chain) {
  return {
    ...REQUIRED_HEADERS,
    Authorization: `Bearer ${process.env.PVR_AUTH_TOKEN || ''}`,
    city,
    chain,
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    referer: 'https://www.pvrcinemas.com/'
  };
}

function buildPayload(defaultPayload, req, overrides = {}) {
  const payload = { ...defaultPayload };

  Object.keys(payload).forEach((key) => {
    payload[key] = coercePayloadValue(getRequestValue(req, key, payload[key]), payload[key]);
  });

  return { ...payload, ...overrides };
}

function registerGetPost(path, handler) {
  router.get(path, handler);
  router.post(path, handler);
}

function hashString(value) {
  let hash = 2166136261;
  const stringValue = String(value || '');

  for (let i = 0; i < stringValue.length; i += 1) {
    hash ^= stringValue.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed || 1;

  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function randomizeSeatLayoutAvailability(responseBody, payload) {
  const rows = responseBody?.output?.rows;
  if (!Array.isArray(rows)) return responseBody;

  const random = createSeededRandom(hashString(`${payload.seed || payload.encrypted || payload.cid || payload.cinemaCode}:${payload.dated}:${payload.showId || ''}`));
  const availableTarget = 0.72 + random() * 0.12;
  const summary = {
    totalSeats: 0,
    availableSeats: 0,
    unavailableSeats: 0,
    availabilityPercent: 0
  };

  rows.forEach((row) => {
    if (row?.t !== 'seats' || !Array.isArray(row.s)) return;

    row.s.forEach((seat) => {
      if (!seat?.b || !seat?.sn || seat.s === 0) return;

      const isAvailable = random() < availableTarget;
      seat.s = isAvailable ? 1 : 2;
      seat.st = isAvailable ? 0 : 1;
      seat.bu = !isAvailable;
      seat.availabilityStatus = isAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
      seat.available = isAvailable;

      summary.totalSeats += 1;
      if (isAvailable) summary.availableSeats += 1;
      else summary.unavailableSeats += 1;
    });
  });

  if (summary.totalSeats > 0 && summary.availableSeats <= summary.unavailableSeats) {
    rows.some((row) => {
      if (row?.t !== 'seats' || !Array.isArray(row.s)) return false;

      const seat = row.s.find((candidate) => candidate?.b && candidate?.sn && candidate.available === false);
      if (!seat) return false;

      seat.s = 1;
      seat.st = 0;
      seat.bu = false;
      seat.availabilityStatus = 'AVAILABLE';
      seat.available = true;
      summary.availableSeats += 1;
      summary.unavailableSeats -= 1;
      return summary.availableSeats > summary.unavailableSeats;
    });
  }

  summary.availabilityPercent = Math.round((summary.availableSeats / summary.totalSeats) * 100);
  responseBody.output.availabilitySummary = summary;

  return responseBody;
}

async function callPvrApi({ req, res, config, payload, city, transformResponse }) {
  const headerCity = city || payload.city || getRequestValue(req, 'city');
  const chain = getRequestValue(req, 'chain', REQUIRED_HEADERS.chain);

  if (!headerCity) {
    return res.status(400).json({
      status: 'error',
      message: 'city is required for the PVR API header'
    });
  }

  try {
    const pvrResponse = await fetch(config.url, {
      method: 'POST',
      headers: buildHeaders(headerCity, chain),
      body: JSON.stringify(payload)
    });

    const contentType = pvrResponse.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await pvrResponse.json()
      : await pvrResponse.text();

    if (!pvrResponse.ok) {
      return res.status(pvrResponse.status).json({
        status: 'error',
        message: 'PVR API request failed',
        upstreamStatus: pvrResponse.status,
        upstreamResponse: responseBody
      });
    }

    if (responseBody && typeof responseBody === 'object' && responseBody.result === 'error') {
      const statusCode = responseBody.status === 204 || responseBody.code === 12001 ? 404 : 502;

      return res.status(statusCode).json({
        status: 'error',
        message: responseBody.msg || 'PVR API returned an error',
        source: 'pvr',
        upstreamUrl: config.url,
        upstreamStatus: responseBody.status,
        upstreamCode: responseBody.code,
        payload,
        data: responseBody,
        hint: 'For sessions, verify cid with GET /api/pvr/cinemas?city=<CityName>.'
      });
    }

    return res.json({
      status: 'success',
      source: 'pvr',
      upstreamUrl: config.url,
      payload,
      data: transformResponse ? transformResponse(responseBody, payload) : responseBody
    });
  } catch (error) {
    return res.status(502).json({
      status: 'error',
      message: 'Unable to reach PVR API',
      detail: error.message
    });
  }
}

async function fetchPvrJson(config, payload, city, chain = REQUIRED_HEADERS.chain) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: buildHeaders(city, chain),
    body: JSON.stringify(payload)
  });
  const contentType = response.headers.get('content-type') || '';
  const responseBody = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error('PVR API request failed');
    error.status = response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return responseBody;
}

function flattenCinemaShows(sessionOutput) {
  const cinemas = sessionOutput?.cinemaMovieSessions;
  if (!Array.isArray(cinemas)) return [];
  const outputCinema = sessionOutput?.cinemaRe || {};

  return cinemas.flatMap((cinemaSession) => {
    const cinema = cinemaSession.cinemaRe || outputCinema;
    const movies = Array.isArray(cinemaSession.movieRe)
      ? cinemaSession.movieRe
      : [cinemaSession.movieRe].filter(Boolean);
    const movieById = new Map();

    movies.forEach((movie) => {
      const filmIds = Array.isArray(movie.filmIds) ? movie.filmIds : [];
      filmIds.forEach((filmId) => movieById.set(String(filmId), movie));
      if (movie.id) movieById.set(String(movie.id), movie);
    });

    return (cinemaSession.experienceSessions || []).flatMap((experienceSession) => (
      (experienceSession.shows || []).map((show) => {
        const movie = movieById.get(String(show.movieId)) || movies[0] || {};

        return {
          cinema,
          movie,
          experienceSession,
          show
        };
      })
    ));
  });
}

function pickShowForSeatLayout(showEntries, payload) {
  if (!showEntries.length) return null;

  const requestedShowId = payload.showId ? String(payload.showId) : '';
  const requestedFilmId = payload.filmId ? String(payload.filmId) : '';
  const requestedShowTime = payload.showTime ? String(payload.showTime).toLowerCase() : '';
  const requestedExperience = payload.experience ? String(payload.experience).toLowerCase() : '';

  return showEntries.find(({ show, movie, experienceSession }) => (
    (requestedShowId && (String(show.showId) === requestedShowId || String(show.sessionId) === requestedShowId))
    || (requestedFilmId && (String(show.movieId) === requestedFilmId || String(movie.id) === requestedFilmId))
    || (requestedShowTime && String(show.showTime || '').toLowerCase() === requestedShowTime)
    || (requestedExperience && String(experienceSession.experience || '').toLowerCase() === requestedExperience)
  )) || showEntries.find(({ show }) => show.status === 1) || showEntries[0];
}

function buildSeatTemplateOverridesFromShow(entry, fallbackPayload) {
  if (!entry) return fallbackPayload;

  const { cinema, movie, experienceSession, show } = entry;
  const showDate = fallbackPayload.dated || new Date().toISOString().split('T')[0];
  const showTime = show.showTimeStamp
    ? new Date(show.showTimeStamp).toISOString().replace('T', ' ').slice(0, 19)
    : `${showDate} ${show.showTime || '19:30'}:00`;

  return {
    ...fallbackPayload,
    cid: cinema.theatreId || fallbackPayload.cid,
    cinemaCode: cinema.theatreId || fallbackPayload.cinemaCode,
    cinemaName: cinema.name || fallbackPayload.cinemaName,
    filmId: show.movieId || movie.id || fallbackPayload.filmId,
    filmName: movie.n || movie.filmNameWeb || movie.filmName || fallbackPayload.filmName,
    showId: show.showId || show.sessionId || fallbackPayload.showId,
    showTime,
    showDateTime: `${showDate}, ${show.showTime || fallbackPayload.showTime || '7:30 PM'}`,
    endTime: show.endTimeStamp
      ? new Date(show.endTimeStamp).toISOString().replace('T', ' ').slice(0, 19)
      : fallbackPayload.endTime,
    experience: experienceSession.experience || show.filmFormat || fallbackPayload.experience,
    language: show.language || movie.otherlanguages || fallbackPayload.language,
    certificate: movie.ce || movie.certificate || fallbackPayload.certificate,
    genre: movie.othergenres || fallbackPayload.genre,
    runningTime: movie.mlength || fallbackPayload.runningTime,
    seed: fallbackPayload.seed || show.encrypted || show.showId || `${cinema.theatreId}:${show.movieId}:${show.showTime}`
  };
}

function findCinemaInCinemaList(cinemaResponse, cid) {
  const cinemas = cinemaResponse?.output?.c;
  if (!Array.isArray(cinemas)) return null;

  return cinemas.find((cinema) => String(cinema.theatreId) === String(cid)) || null;
}

async function enrichSeatLayoutPayload(req, payload) {
  if (getRequestValue(req, 'liveMeta', 'true') === 'false') return payload;

  const city = payload.city || getRequestValue(req, 'city', 'Delhi');
  const sessionPayload = buildPayload(pvrApiUrls.csessions.payload, req, {
    ...buildCoordinateOverrides(req, pvrApiUrls.csessions.payload),
    cid: payload.cid,
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', payload.dated || 'NA')))
  });

  if (!sessionPayload.cid) return payload;

  let cinemaFromList = null;
  try {
    const cinemasPayload = buildPayload(pvrApiUrls.cinemas.payload, req, buildCoordinateOverrides(req, pvrApiUrls.cinemas.payload));
    const cinemasResponse = await fetchPvrJson(
      pvrApiUrls.cinemas,
      cinemasPayload,
      city,
      getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
    );
    cinemaFromList = findCinemaInCinemaList(cinemasResponse, sessionPayload.cid);
  } catch (error) {
    cinemaFromList = null;
  }

  const responseBody = await fetchPvrJson(
    pvrApiUrls.csessions,
    sessionPayload,
    city,
    getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
  );

  if (!responseBody || responseBody.result !== 'success') return payload;

  const enrichedPayload = buildSeatTemplateOverridesFromShow(
    pickShowForSeatLayout(flattenCinemaShows(responseBody.output), payload),
    payload
  );

  if (cinemaFromList) {
    enrichedPayload.cinemaName = cinemaFromList.name || enrichedPayload.cinemaName;
    enrichedPayload.cinemaCode = cinemaFromList.theatreId || enrichedPayload.cinemaCode;
    enrichedPayload.cid = cinemaFromList.theatreId || enrichedPayload.cid;
    enrichedPayload.lat = cinemaFromList.latitude || enrichedPayload.lat;
    enrichedPayload.lng = cinemaFromList.longitude || enrichedPayload.lng;
  }

  return enrichedPayload;
}

// ============================================================
// GET/POST /api/pvr/cities?city=Delhi&lat=28.6139&lng=77.2090
// Fetch city list/nearest city from PVR.
// ============================================================
registerGetPost('/cities', (req, res) => {
  const config = pvrApiUrls.city;
  const payload = buildPayload(config.payload, req, buildCoordinateOverrides(req, config.payload, { includeCity: false }));
  const city = getRequestValue(req, 'city', 'CityName');

  return callPvrApi({ req, res, config, payload, city });
});

// ============================================================
// GET /api/pvr/city-list
// List known PVR cities with coordinates from libs/pvrCities.json.
// ============================================================
router.get('/city-list', (req, res) => {
  res.json({
    status: 'success',
    count: pvrCities.length,
    cities: pvrCities
  });
});

// ============================================================
// GET/POST /api/pvr/cinemas?city=Delhi&lat=&lng=&text=
// Fetch cinemas from PVR for a city.
// ============================================================
registerGetPost('/cinemas', (req, res) => {
  const config = pvrApiUrls.cinemas;
  const payload = buildPayload(config.payload, req, buildCoordinateOverrides(req, config.payload));

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/showtimes/cinemas?city=Delhi&dated=2026-06-26
// Fetch cinema-wise showtimes from PVR.
// ============================================================
registerGetPost('/showtimes/cinemas', (req, res) => {
  const config = pvrApiUrls.showtimes.cshowtimes;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/showtimes/movies?city=Delhi&dated=2026-06-26
// Fetch movie-wise showtimes from PVR.
// ============================================================
registerGetPost('/showtimes/movies', (req, res) => {
  const config = pvrApiUrls.showtimes.mshowtimes;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/cinemas/:cinemaId/sessions?city=Delhi&dated=2026-06-26
// Fetch sessions for one PVR cinema.
// ============================================================
registerGetPost('/cinemas/:cinemaId/sessions', (req, res) => {
  const config = pvrApiUrls.csessions;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    cid: req.params.cinemaId,
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/sessions?city=Delhi&cid=DL001&dated=2026-06-26
// Fetch sessions for a cinema when cid is supplied as a query/body field.
// ============================================================
registerGetPost('/sessions', (req, res) => {
  const config = pvrApiUrls.csessions;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  if (!payload.cid) {
    return res.status(400).json({
      status: 'error',
      message: 'cid is required'
    });
  }

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/offers?city=Mumbai-All&id=0&payment=false
// Fetch PVR offer list for a city.
// ============================================================
registerGetPost('/offers', (req, res) => {
  const config = pvrApiUrls.offers;
  const payload = buildPayload(config.payload, req);

  return callPvrApi({ req, res, config, payload });
});

// ============================================================
// GET/POST /api/pvr/seatlayout?city=Delhi&cid=348&dated=2026-06-27
// Fetch local template seat layout with randomized availability.
// ============================================================
registerGetPost('/seatlayout', async (req, res) => {
  const config = pvrApiUrls.seatlayout;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, { city: getRequestValue(req, 'city', 'Delhi') }),
    cid: getRequestValue(req, 'cid', getRequestValue(req, 'cinemaCode', '000')),
    cinemaCode: getRequestValue(req, 'cinemaCode', getRequestValue(req, 'cid', '000')),
    cinemaName: getRequestValue(req, 'cinemaName', getRequestValue(req, 'cinema', 'PVR Demo Cinema')),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', new Date().toISOString().split('T')[0]))),
    filmId: getRequestValue(req, 'filmId', '35277'),
    filmName: getRequestValue(req, 'filmName', 'SUPERGIRL'),
    showId: getRequestValue(req, 'showId', '35002'),
    showTime: getRequestValue(req, 'showTime', ''),
    seed: getRequestValue(req, 'seed', '')
  });

  try {
    const enrichedPayload = await enrichSeatLayoutPayload(req, payload);
    const data = randomizeSeatLayoutAvailability(createSeatLayoutTemplate(enrichedPayload), enrichedPayload);

    return res.json({
      status: 'success',
      source: enrichedPayload === payload ? 'local-template' : 'pvr-metadata-local-seats',
      upstreamUrl: null,
      payload: enrichedPayload,
      data
    });
  } catch (error) {
    const data = randomizeSeatLayoutAvailability(createSeatLayoutTemplate(payload), payload);

    return res.json({
      status: 'success',
      source: 'local-template',
      upstreamUrl: null,
      payload,
      metadataWarning: error.message,
      data
    });
  }
});

module.exports = router;
