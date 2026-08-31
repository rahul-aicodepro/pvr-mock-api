// ============================================================
// PVR INOX Live API Proxy Routes
// ============================================================

const express = require('express');
const pvrApiUrls = require('../../libs/pvrApiUrls.json');
const pvrCities = require('../../libs/pvrCities.json');
const requestDatabase = require('../lib/requestDatabase');
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

const COOKIE_CACHE_TTL_MS = 5 * 60 * 1000;
let pvrCookieCache = {
  value: '',
  expiresAt: 0
};

function getRequestValue(req, key, fallback = '') {
  const lowerKey = key.toLowerCase();
  return (
    req.body?.[key] ??
    req.query?.[key] ??
    req.body?.[lowerKey] ??
    req.query?.[lowerKey] ??
    req.headers?.[lowerKey] ??
    req.headers?.[key] ??
    req.headers?.[`x-${lowerKey}`] ??
    fallback
  );
}

function getLngRequestValue(req, fallback = '') {
  return (
    req.body?.lng ??
    req.query?.lng ??
    req.body?.long ??
    req.query?.long ??
    req.body?.longitude ??
    req.query?.longitude ??
    req.headers?.lng ??
    req.headers?.longitude ??
    req.headers?.['x-lng'] ??
    req.headers?.['x-longitude'] ??
    fallback
  );
}

function getLatRequestValue(req, fallback = '') {
  return (
    req.body?.lat ??
    req.query?.lat ??
    req.body?.latitude ??
    req.query?.latitude ??
    req.headers?.lat ??
    req.headers?.latitude ??
    req.headers?.['x-lat'] ??
    req.headers?.['x-latitude'] ??
    fallback
  );
}

function getShowIdRequestValue(req, fallback = '') {
  const keys = [
    'showId', 'show_id', 'showid', 'showID', 'show_Id',
    'sessionId', 'session_id', 'sessionid', 'sessionID', 'session_Id',
    'sid', 'show', 'session', 'id'
  ];
  for (const k of keys) {
    const val = getRequestValue(req, k, '');
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
}

function getFilmNameRequestValue(req, fallback = '') {
  const keys = [
    'filmName', 'film_name', 'filmname', 'movie', 'movieName', 'movie_name', 'moviename', 'film', 'title'
  ];
  for (const k of keys) {
    const val = getRequestValue(req, k, '');
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
}

function getShowTimeRequestValue(req, fallback = '') {
  const keys = [
    'showTime', 'show_time', 'showtime', 'time', 'show_Time', 'timeSlot', 'slot'
  ];
  for (const k of keys) {
    const val = getRequestValue(req, k, '');
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
}

function getCidRequestValue(req, fallback = '') {
  const keys = [
    'cid', 'cinemaCode', 'cinema_code', 'cinemacode', 'cinemaId', 'cinema_id', 'cinemaid', 'theatreId', 'theatre_id', 'theatreid', 'cinema', 'theatre'
  ];
  for (const k of keys) {
    const val = getRequestValue(req, k, '');
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
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

function findNearestCity(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng) || (nLat === 0 && nLng === 0)) return null;

  let closest = null;
  let minDistance = Infinity;

  for (const entry of pvrCities) {
    if (entry.latitude && entry.longitude) {
      const dLat = entry.latitude - nLat;
      const dLng = entry.longitude - nLng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDistance) {
        minDistance = dist;
        closest = entry;
      }
    }
  }
  return closest;
}

function findCity(city) {
  const normalizedCity = normalizeCityName(city);
  if (!normalizedCity) return null;

  return pvrCities.find((entry) => normalizeCityName(entry.city) === normalizedCity) || null;
}

function getCityFromRequest(req, payload = {}) {
  const fromReq = (
    req.body?.city ??
    req.query?.city ??
    req.headers?.city ??
    req.headers?.['x-city'] ??
    req.headers?.['x-location'] ??
    req.headers?.location ??
    payload.city ??
    ''
  );

  if (fromReq) return String(fromReq).trim();

  // If no city name provided, attempt reverse geolocation lookup from lat/lng
  const lat = getLatRequestValue(req, payload.lat || '');
  const lng = getLngRequestValue(req, payload.lng || '');
  if (lat && lng) {
    const nearest = findNearestCity(lat, lng);
    if (nearest) return nearest.city;
  }

  return '';
}

function buildCoordinateOverrides(req, payload = {}, options = {}) {
  const includeCity = options.includeCity !== false;
  const city = getCityFromRequest(req, payload);
  const cityData = findCity(city);
  const lat = getLatRequestValue(req, '');
  const lng = getLngRequestValue(req, '');

  const resolvedLat = lat || (cityData?.latitude ? String(cityData.latitude) : payload.lat);
  const resolvedLng = lng || (cityData?.longitude ? String(cityData.longitude) : payload.lng);

  const coordinates = {
    lat: normalizeCoordinate(resolvedLat),
    lng: normalizeCoordinate(resolvedLng)
  };

  return includeCity ? { city: city || payload.city, ...coordinates } : coordinates;
}

async function getPvrCookieHeader() {
  if (process.env.PVR_COOKIE) return process.env.PVR_COOKIE;
  if (pvrCookieCache.value && Date.now() < pvrCookieCache.expiresAt) return pvrCookieCache.value;

  try {
    const response = await fetch('https://www.pvrcinemas.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const setCookie = response.headers.get('set-cookie') || '';
    const cookieHeader = setCookie
      .split(/,(?=[^;,]+=)/)
      .map((cookie) => cookie.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    pvrCookieCache = {
      value: cookieHeader,
      expiresAt: Date.now() + COOKIE_CACHE_TTL_MS
    };

    return cookieHeader;
  } catch (error) {
    return '';
  }
}

async function buildHeaders(city, chain = REQUIRED_HEADERS.chain) {
  const authToken = process.env.PVR_AUTH_TOKEN || '';
  const cookieHeader = await getPvrCookieHeader();

  const headers = {
    Origin: REQUIRED_HEADERS.origin,
    Referer: 'https://www.pvrcinemas.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    city,
    appVersion: REQUIRED_HEADERS.appVersion,
    chain,
    country: REQUIRED_HEADERS.country,
    flow: REQUIRED_HEADERS.flow,
    platform: REQUIRED_HEADERS.platform,
    Authorization: authToken ? `Bearer ${authToken}` : 'Bearer',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site'
  };

  if (cookieHeader) headers.Cookie = cookieHeader;

  return headers;
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

async function callPvrApi({ req, res, config, payload, city, endpoint, transformResponse }) {
  const headerCity = city || payload.city || getRequestValue(req, 'city');
  const chain = getRequestValue(req, 'chain', REQUIRED_HEADERS.chain);
  const forceRefresh = String(getRequestValue(req, 'forceRefresh', 'false')).toLowerCase() === 'true' || req.body?.forceRefresh === true;

  if (!headerCity) {
    return res.status(400).json({
      status: 'error',
      message: 'city is required for the PVR API header'
    });
  }

  const headers = await buildHeaders(headerCity, chain);
  const fetcher = async () => {
    const pvrResponse = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const contentType = pvrResponse.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await pvrResponse.json()
      : await pvrResponse.text();

    if (!pvrResponse.ok) {
      const error = new Error('PVR API request failed');
      error.status = pvrResponse.status;
      error.responseBody = responseBody;
      throw error;
    }

    return responseBody;
  };

  try {
    const responseBody = await requestDatabase.execute({
      endpoint,
      method: 'POST',
      url: config.url,
      payload,
      headers,
      fetcher,
      forceRefresh,
      hashHeaders: false,
      apiVersion: 'v1'
    });

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
      data: transformResponse ? transformResponse(responseBody, payload, req) : responseBody
    });
  } catch (error) {
    if (error.status === 404 && requestDatabase) {
      return res.status(404).json({
        status: 'error',
        message: error.message || 'Request not stored'
      });
    }

    return res.status(error.status || 502).json({
      status: 'error',
      message: error.message === 'Request not stored' ? 'Request not stored' : 'Unable to reach PVR API',
      detail: error.responseBody || error.message
    });
  }
}

async function fetchPvrJson(config, payload, city, endpoint, chain = REQUIRED_HEADERS.chain) {
  const headers = await buildHeaders(city, chain);
  const fetcher = async () => {
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
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
  };

  return requestDatabase.execute({
    endpoint,
    method: 'POST',
    url: config.url,
    payload,
    headers,
    fetcher,
    forceRefresh: false,
    hashHeaders: false,
    apiVersion: 'v1'
  });
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
  if (!Array.isArray(showEntries) || !showEntries.length) return null;

  const requestedShowId = payload.showId ? String(payload.showId) : (payload.sessionId ? String(payload.sessionId) : '');
  const requestedFilmId = payload.filmId ? String(payload.filmId) : '';
  const requestedFilmName = payload.filmName ? String(payload.filmName).toLowerCase().trim() : '';
  const requestedShowTime = payload.showTime ? String(payload.showTime).toLowerCase().trim() : '';
  const requestedExperience = payload.experience ? String(payload.experience).toLowerCase().trim() : '';

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // 1. If showId is requested, STRICTLY match by showId / sessionId. Do NOT fall back to other shows!
  if (requestedShowId) {
    return showEntries.find(({ show }) =>
      String(show.showId) === requestedShowId ||
      String(show.sessionId) === requestedShowId ||
      String(show.id) === requestedShowId
    ) || null;
  }

  // 2. If film and showTime are requested
  if ((requestedFilmId || requestedFilmName) && requestedShowTime) {
    const match = showEntries.find(({ show, movie }) => {
      const matchFilm = (requestedFilmId && (String(show.movieId) === requestedFilmId || String(movie.id) === requestedFilmId)) ||
        (requestedFilmName && (normalize(movie.name || movie.n || movie.filmNameWeb).includes(normalize(requestedFilmName)) || normalize(requestedFilmName).includes(normalize(movie.name || movie.n || movie.filmNameWeb))));
      const matchTime = String(show.showTime || show.time || '').toLowerCase().trim().includes(requestedShowTime);
      return matchFilm && matchTime;
    });
    if (match) return match;
  }

  // 3. Match by film
  if (requestedFilmId || requestedFilmName) {
    const match = showEntries.find(({ show, movie }) =>
      (requestedFilmId && (String(show.movieId) === requestedFilmId || String(movie.id) === requestedFilmId)) ||
      (requestedFilmName && (normalize(movie.name || movie.n || movie.filmNameWeb).includes(normalize(requestedFilmName)) || normalize(requestedFilmName).includes(normalize(movie.name || movie.n || movie.filmNameWeb))))
    );
    if (match) return match;
  }

  // 4. Match by showTime
  if (requestedShowTime) {
    const match = showEntries.find(({ show }) =>
      String(show.showTime || show.time || '').toLowerCase().trim().includes(requestedShowTime)
    );
    if (match) return match;
  }

  // 5. Match by experience format
  if (requestedExperience) {
    const match = showEntries.find(({ show, experienceSession }) =>
      String(experienceSession?.experience || '').toLowerCase().trim() === requestedExperience ||
      String(show.filmFormat || show.experience || show.format || '').toLowerCase().trim() === requestedExperience
    );
    if (match) return match;
  }

  // 6. If no showId, film, time, or format requested at all, return null. Never arbitrarily pick a random show!
  return null;
}

function buildSeatTemplateOverridesFromShow(entry, fallbackPayload) {
  if (!entry) return null;

  const { cinema, movie, experienceSession, show } = entry;
  const showDate = show.showDate || show.date || fallbackPayload.dated || new Date().toISOString().split('T')[0];
  const showTimeStr = show.showTime || show.time || fallbackPayload.showTime || '19:30';
  const showIdVal = String(show.sessionId || show.showId || show.id || fallbackPayload.showId || '');
  const filmNameVal = movie.name || movie.n || movie.filmNameWeb || movie.filmName || fallbackPayload.filmName || '';
  const filmIdVal = String(show.movieId || movie.id || fallbackPayload.filmId || '');
  const cinemaNameVal = cinema.name || fallbackPayload.cinemaName || 'PVR Cinema';
  const cinemaIdVal = String(cinema.id || cinema.theatreId || fallbackPayload.cid || '');

  const showTimeFormatted = show.showTimeStamp
    ? new Date(show.showTimeStamp).toISOString().replace('T', ' ').slice(0, 19)
    : `${showDate} ${showTimeStr.length <= 5 ? `${showTimeStr}:00` : showTimeStr}`;

  return {
    ...fallbackPayload,
    cid: cinemaIdVal,
    cinemaCode: cinemaIdVal,
    cinemaName: cinemaNameVal,
    filmId: filmIdVal,
    filmName: filmNameVal,
    showId: showIdVal,
    sessionId: showIdVal,
    showTime: showTimeStr,
    showDateTime: `${showDate}, ${showTimeStr}`,
    dated: showDate,
    endTime: show.endTimeStamp
      ? new Date(show.endTimeStamp).toISOString().replace('T', ' ').slice(0, 19)
      : (show.endTime || fallbackPayload.endTime || ''),
    experience: experienceSession?.experience || show.experience || show.format || show.filmFormat || fallbackPayload.experience || 'Standard',
    language: show.language || movie.otherlanguages || movie.language || fallbackPayload.language || 'English',
    certificate: movie.ce || movie.certificate || fallbackPayload.certificate || 'UA',
    genre: movie.othergenres || movie.genre || fallbackPayload.genre || 'Action',
    runningTime: movie.mlength || fallbackPayload.runningTime || 120,
    seed: fallbackPayload.seed || show.encrypted || showIdVal || `${cinemaIdVal}:${filmIdVal}:${showTimeStr}`
  };
}

function findCinemaInCinemaList(cinemas, cidOrName) {
  if (!Array.isArray(cinemas) || !cidOrName) return null;

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const target = normalize(cidOrName);

  return cinemas.find((c) =>
    String(c.theatreId) === String(cidOrName) ||
    String(c.id) === String(cidOrName) ||
    (c.theatreCode && String(c.theatreCode) === String(cidOrName)) ||
    normalize(c.name) === target ||
    normalize(c.name).includes(target) ||
    target.includes(normalize(c.name))
  ) || null;
}

async function enrichSeatLayoutPayload(req, payload) {
  const city = payload.city || getCityFromRequest(req, payload) || 'Delhi';
  const rawCid = payload.cid || payload.cinemaCode || getRequestValue(req, 'cinema', '');
  const dated = normalizeDate(payload.dated || getRequestValue(req, 'dated', getRequestValue(req, 'date', new Date().toISOString().split('T')[0])));
  const requestedShowId = payload.showId ? String(payload.showId) : (payload.sessionId ? String(payload.sessionId) : '');

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // 1. Fetch cinema list for the city to resolve cinema ID and metadata
  let resolvedCinema = null;
  let cinemaList = [];

  try {
    const cinemasPayload = buildPayload(pvrApiUrls.cinemas.payload, req, buildCoordinateOverrides(req, pvrApiUrls.cinemas.payload));
    const cinemasResponse = await fetchPvrJson(
      pvrApiUrls.cinemas,
      cinemasPayload,
      city,
      'cinemas',
      getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
    );
    cinemaList = cinemasResponse?.output?.c || [];

    if (rawCid) {
      resolvedCinema = findCinemaInCinemaList(cinemaList, rawCid);
    }
  } catch (error) {
    cinemaList = [];
    resolvedCinema = null;
  }

  const numericCid = resolvedCinema ? String(resolvedCinema.theatreId) : (rawCid && /^\d+$/.test(String(rawCid)) ? String(rawCid) : null);

  let matchedShowEntry = null;

  // 2. If we have a numeric cid, fetch csessions for this cinema
  if (numericCid) {
    try {
      const sessionPayload = buildPayload(pvrApiUrls.csessions.payload, req, {
        ...buildCoordinateOverrides(req, pvrApiUrls.csessions.payload),
        cid: numericCid,
        dated
      });

      const responseBody = await fetchPvrJson(
        pvrApiUrls.csessions,
        sessionPayload,
        city,
        'csessions',
        getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
      );

      if (responseBody && responseBody.result === 'success') {
        const showEntries = flattenCinemaShows(responseBody.output);
        matchedShowEntry = pickShowForSeatLayout(showEntries, payload);
      }
    } catch (err) {
      matchedShowEntry = null;
    }
  }

  // 3. If show not found yet, search across city showtimes (cshowtimes)
  if (!matchedShowEntry && (requestedShowId || payload.filmId || payload.filmName || rawCid)) {
    try {
      const cshowtimesPayload = buildPayload(pvrApiUrls.cshowtimes.payload, req, {
        ...buildCoordinateOverrides(req, pvrApiUrls.cshowtimes.payload),
        city,
        dated
      });

      const cshowtimesResp = await fetchPvrJson(
        pvrApiUrls.cshowtimes,
        cshowtimesPayload,
        city,
        'cshowtimes',
        getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
      );

      if (cshowtimesResp && cshowtimesResp.result === 'success') {
        const flattened = flattenCinemaShows(cshowtimesResp.output);
        const candidateEntries = numericCid
          ? flattened.filter((e) => String(e.cinema?.theatreId) === String(numericCid))
          : (resolvedCinema ? flattened.filter((e) => normalize(e.cinema?.name).includes(normalize(resolvedCinema.name))) : flattened);

        matchedShowEntry = pickShowForSeatLayout(candidateEntries.length ? candidateEntries : flattened, payload);

        // If matched from city showtimes, set resolvedCinema if not set
        if (matchedShowEntry && !resolvedCinema && matchedShowEntry.cinema) {
          resolvedCinema = matchedShowEntry.cinema;
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // 4. If a specific showId was requested and STILL not found, DO NOT pick a random show! Return null!
  if (requestedShowId) {
    if (!matchedShowEntry || (String(matchedShowEntry.show?.showId) !== requestedShowId && String(matchedShowEntry.show?.sessionId) !== requestedShowId)) {
      return null;
    }
  }

  // If no show was found at all:
  if (!matchedShowEntry) {
    return null;
  }

  // 5. Build enriched payload from the matched show
  const enrichedPayload = buildSeatTemplateOverridesFromShow(matchedShowEntry, {
    ...payload,
    city,
    dated
  });

  if (resolvedCinema) {
    enrichedPayload.cinemaName = resolvedCinema.name || enrichedPayload.cinemaName;
    enrichedPayload.cinemaCode = String(resolvedCinema.theatreId || resolvedCinema.id || enrichedPayload.cinemaCode);
    enrichedPayload.cid = String(resolvedCinema.theatreId || resolvedCinema.id || enrichedPayload.cid);
    enrichedPayload.lat = resolvedCinema.latitude || resolvedCinema.lat || enrichedPayload.lat;
    enrichedPayload.lng = resolvedCinema.longitude || resolvedCinema.lng || enrichedPayload.lng;
  }

  return enrichedPayload;
}

// ============================================================
// TRANSFORM FUNCTIONS — strip heavy upstream data for LLM use
// ============================================================

function normalizeCinemaCoordinates(latRaw, lngRaw) {
  const latNum = latRaw !== undefined && latRaw !== null && latRaw !== '' ? Number(latRaw) : null;
  const lngNum = lngRaw !== undefined && lngRaw !== null && lngRaw !== '' ? Number(lngRaw) : null;
  const isValidLat = latNum !== null && !Number.isNaN(latNum);
  const isValidLng = lngNum !== null && !Number.isNaN(lngNum);

  return {
    lat: isValidLat ? String(latNum) : (latRaw ? String(latRaw) : null),
    lng: isValidLng ? String(lngNum) : (lngRaw ? String(lngRaw) : null),
    latitude: isValidLat ? latNum : (latRaw ? String(latRaw) : null),
    longitude: isValidLng ? lngNum : (lngRaw ? String(lngRaw) : null),
    coordinates: isValidLat && isValidLng ? {
      lat: latNum,
      lng: lngNum,
      latitude: latNum,
      longitude: lngNum
    } : null
  };
}

function summarizeMovieShowtimes(responseBody) {
  const output = responseBody?.output || responseBody;
  const sessions = Array.isArray(output?.showTimeSessions)
    ? output.showTimeSessions
    : (output?.movie && Array.isArray(output?.movieCinemaSessions) ? [output] : []);

  if (!sessions.length) return responseBody;

  const movies = sessions.map((session) => {
    const movie = session.movie || {};
    const cinemas = (session.movieCinemaSessions || []).map((cinemaSession) => {
      const cinema = cinemaSession.cinema || {};
      const coords = normalizeCinemaCoordinates(cinema.latitude, cinema.longitude);
      const shows = (cinemaSession.experienceSessions || []).flatMap((experienceSession) =>
        (experienceSession.shows || [])
          .filter((show) => show.status === 1)
          .map((show) => ({
            sessionId: show.sessionId,
            movieId: show.movieId,
            time: show.showTime,
            date: show.showDate || show.showDateStr,
            endTime: show.endTime,
            format: show.movieFormat || show.filmFormat || experienceSession.experience || 'Standard',
            experience: experienceSession.experience || show.screenType || 'Standard',
            language: show.language,
            screenId: show.screenId,
            screen: show.screenName,
            status: show.statusTxt,
            encrypted: show.encrypted
          }))
      );

      return {
        id: cinema.theatreId,
        name: cinema.name,
        address: cinema.address1,
        city: cinema.cityName,
        lat: coords.lat,
        lng: coords.lng,
        latitude: coords.latitude,
        longitude: coords.longitude,
        coordinates: coords.coordinates,
        distance: cinema.distanceText,
        foodAvailable: cinema.foodAvailable,
        isPosAvailable: cinema.isPosAvailable,
        showCount: shows.length,
        shows
      };
    }).filter((cinema) => cinema.shows.length > 0);

    return {
      id: movie.id,
      name: movie.n || movie.filmNameWeb || movie.filmName,
      language: movie.otherlanguages,
      languages: movie.mfs || [],
      genre: movie.othergenres,
      genres: movie.grs || [],
      certificate: movie.ce || movie.certificateLk,
      duration: movie.mlength,
      posterUrl: movie.miv || null,
      bannerUrl: movie.mih || null,
      trailer: movie.mtrailerurl || null,
      showCount: cinemas.reduce((sum, cinema) => sum + cinema.showCount, 0),
      cinemas
    };
  }).filter((movie) => movie.cinemas.length > 0);

  return {
    days: output.days || [],
    languages: output.languages || [],
    formats: output.formats || [],
    experiences: output.experiences || [],
    movies,
    recommendedMovies: (output.recommendMovies || []).map((movie) => ({
      id: movie.id,
      name: movie.n || movie.filmNameWeb || movie.filmName,
      language: movie.otherlanguages,
      genre: movie.othergenres,
      certificate: movie.ce || movie.certificateLk,
      duration: movie.mlength,
      posterUrl: movie.miv || null,
      bannerUrl: movie.mih || null
    }))
  };
}

function summarizeLiveMovieList(responseBody, payload, req) {
  const output = responseBody?.output || responseBody;
  const sessions = Array.isArray(output?.showTimeSessions)
    ? output.showTimeSessions
    : (output?.movie && Array.isArray(output?.movieCinemaSessions) ? [output] : []);

  const languageFilter = getRequestValue(req, 'language', '').toLowerCase();
  const genreFilter = getRequestValue(req, 'genre', '').toLowerCase();
  const formatFilter = getRequestValue(req, 'format', '').toLowerCase();
  const statusFilter = getRequestValue(req, 'status', '').toUpperCase();

  let movies = sessions.map((session) => {
    const movie = session.movie || {};
    const cinemas = (session.movieCinemaSessions || []).map((cs) => {
      const shows = (cs.experienceSessions || []).flatMap((es) => (es.shows || []).filter((s) => s.status === 1));
      return { cinemaId: cs.cinema?.theatreId, cinemaName: cs.cinema?.name, showCount: shows.length };
    }).filter((c) => c.showCount > 0);

    const allFormats = (session.movieCinemaSessions || []).flatMap((cs) =>
      (cs.experienceSessions || []).map((es) => es.experience || 'Standard')
    ).filter((v, i, a) => a.indexOf(v) === i && v);

    const genres = movie.grs || (movie.othergenres ? movie.othergenres.split(',').map((s) => s.trim()) : []);
    const languages = movie.mfs || (movie.otherlanguages ? movie.otherlanguages.split(',').map((s) => s.trim()) : []);
    const formats = allFormats.length > 0 ? allFormats : (output.formats || ['Standard']);

    return {
      filmId: String(movie.id || movie.filmId || ''),
      name: movie.n || movie.filmNameWeb || movie.filmName || '',
      certification: movie.ce || movie.certificateLk || '',
      duration: movie.mlength || '',
      genres,
      languages,
      formats,
      releaseDate: movie.releaseDate || null,
      status: 'NOW_SHOWING',
      posterUrl: movie.miv || null,
      bannerUrl: movie.mih || null,
      trailerUrl: movie.mtrailerurl || null,
      totalShows: cinemas.reduce((sum, c) => sum + c.showCount, 0),
      cinemasShowingCount: cinemas.length
    };
  }).filter((m) => Boolean(m.name));

  if (languageFilter) {
    movies = movies.filter((m) => m.languages.some((l) => l.toLowerCase().includes(languageFilter)));
  }
  if (genreFilter) {
    movies = movies.filter((m) => m.genres.some((g) => g.toLowerCase().includes(genreFilter)));
  }
  if (formatFilter) {
    movies = movies.filter((m) => m.formats.some((f) => f.toLowerCase().includes(formatFilter)));
  }

  const upcomingMovies = (output.recommendMovies || []).map((movie) => ({
    filmId: String(movie.id || ''),
    name: movie.n || movie.filmNameWeb || movie.filmName || '',
    languages: movie.otherlanguages ? movie.otherlanguages.split(',').map((s) => s.trim()) : [],
    genres: movie.othergenres ? movie.othergenres.split(',').map((s) => s.trim()) : [],
    certification: movie.ce || movie.certificateLk || '',
    duration: movie.mlength || '',
    posterUrl: movie.miv || null,
    bannerUrl: movie.mih || null,
    status: 'UPCOMING'
  }));

  let finalMovies = movies;
  if (statusFilter === 'UPCOMING') {
    finalMovies = upcomingMovies;
  } else if (statusFilter === 'ALL') {
    finalMovies = [...movies, ...upcomingMovies];
  }

  return {
    city: payload?.city || '',
    date: payload?.dated || 'NA',
    count: finalMovies.length,
    movies: finalMovies,
    upcomingCount: upcomingMovies.length,
    upcomingMovies: statusFilter === 'NOW_SHOWING' ? undefined : upcomingMovies
  };
}

function summarizeCinemas(responseBody) {
  const output = responseBody?.output || responseBody;
  const cinemas = output?.c;
  if (!Array.isArray(cinemas)) return responseBody;

  return {
    map: output.map ?? null,
    defaultMap: output.defaultMap ?? null,
    message: output.fmsg || output.displayMsg || null,
    defaultDistance: output.defaultDistance,
    maxDistance: output.maxDistance,
    count: cinemas.length,
    cinemas: cinemas.map((c) => {
      const coords = normalizeCinemaCoordinates(c.latitude, c.longitude);
      return {
        id: c.theatreId,
        theatreId: c.theatreId,
        name: c.name,
        address: c.address1,
        city: c.cityName,
        pincode: c.pincode || null,
        lat: coords.lat,
        lng: coords.lng,
        latitude: coords.latitude,
        longitude: coords.longitude,
        coordinates: coords.coordinates,
        distance: c.distanceText,
        showCount: c.showCount || 0,
        images: {
          portrait: c.miv || null,
          landscape: c.mih || null
        },
        amenities: {
          foodAvailable: c.foodAvailable,
          isPosAvailable: c.isPosAvailable,
          handicap: c.handicap,
          handicapRamp: c.handicapRamp,
          fbDeliveryOnSeat: c.fbDeliveryOnSeat,
          adFree: c.adFree
        },
        alert: c.alertTxt || null,
        screens: Object.values(c.screens || {}).map((screen) => ({
          id: screen.screenId,
          name: screen.screenName,
          type: screen.screenType,
          handicap: screen.handicap,
          minSeats: screen.minSeats
        })),
        experiences: Object.values(c.screens || {})
          .map((s) => s.screenType)
          .filter((v, i, arr) => arr.indexOf(v) === i && v),
        movies: (c.movieRes || []).map((movie) => ({
          id: movie.id,
          name: movie.n || movie.filmNameWeb || movie.filmName,
          language: movie.otherlanguages,
          languages: movie.mfs || [],
          genre: movie.othergenres,
          genres: movie.grs || [],
          certificate: movie.ce || movie.certificateLk,
          duration: movie.mlength,
          posterUrl: movie.miv || null,
          bannerUrl: movie.mih || null,
          trailer: movie.mtrailerurl || null,
          showCount: movie.showCount || 0,
          filmIds: movie.filmIds || [],
          formats: (movie.films || []).map((film) => film.format).filter(Boolean),
          releaseDate: movie.releaseDate || null
        }))
      };
    })
  };
}

function summarizeCinemaWiseShowtimes(responseBody) {
  const output = responseBody?.output || responseBody;
  const sessions = Array.isArray(output?.showTimeSessions)
    ? output.showTimeSessions
    : (output?.cinemaRe && Array.isArray(output?.cinemaMovieSessions) ? [output] : []);

  if (!sessions.length) return responseBody;

  const cinemas = sessions.map((session) => {
    const cinema = session.cinemaRe || session.cinema || {};
    const coords = normalizeCinemaCoordinates(cinema.latitude, cinema.longitude);
    const movieSessions = session.cinemaMovieSessions || [];
    const movies = movieSessions.map((ms) => {
      const movie = ms.movieRe || {};
      const shows = (ms.experienceSessions || []).flatMap((es) =>
        (es.shows || [])
          .filter((s) => s.status === 1)
          .map((s) => ({
            sessionId: s.sessionId,
            movieId: s.movieId,
            time: s.showTime,
            date: s.showDate || s.showDateStr,
            endTime: s.endTime,
            format: s.movieFormat || s.filmFormat || es.experience || 'Standard',
            experience: es.experience || s.screenType || 'Standard',
            language: s.language,
            screenId: s.screenId,
            screen: s.screenName,
            status: s.statusTxt,
            encrypted: s.encrypted
          }))
      );
      return {
        id: movie.id,
        name: movie.n || movie.filmNameWeb || movie.filmName,
        language: movie.otherlanguages,
        languages: movie.mfs || [],
        genre: movie.othergenres,
        genres: movie.grs || [],
        certificate: movie.ce || movie.certificateLk,
        duration: movie.mlength,
        poster: movie.miv,
        banner: movie.mih,
        showCount: shows.length,
        shows
      };
    }).filter((m) => m.shows.length > 0);

    return {
      id: cinema.theatreId,
      name: cinema.name,
      address: cinema.address1,
      city: cinema.cityName,
      lat: coords.lat,
      lng: coords.lng,
      latitude: coords.latitude,
      longitude: coords.longitude,
      coordinates: coords.coordinates,
      distance: cinema.distanceText,
      foodAvailable: cinema.foodAvailable,
      isPosAvailable: cinema.isPosAvailable,
      showCount: movies.reduce((sum, m) => sum + m.showCount, 0),
      movies
    };
  }).filter((c) => c.movies.length > 0);

  return {
    days: output.days || [],
    cinemas
  };
}

function summarizeCinemaSessions(responseBody) {
  const sessions = responseBody?.output?.cinemaMovieSessions;
  if (!Array.isArray(sessions)) return responseBody;

  const cinema = responseBody?.output?.cinemaRe || {};
  const coords = normalizeCinemaCoordinates(cinema.latitude, cinema.longitude);
  const movies = sessions.map((session) => {
    const movie = session.movieRe || {};
    const shows = (session.experienceSessions || []).flatMap((experienceSession) =>
      (experienceSession.shows || [])
        .filter((show) => show.status === 1)
        .map((show) => ({
          sessionId: show.sessionId,
          movieId: show.movieId,
          time: show.showTime,
          date: show.showDate || show.showDateStr,
          endTime: show.endTime,
          format: show.movieFormat || show.filmFormat || experienceSession.experience || 'Standard',
          experience: experienceSession.experience || show.screenType || 'Standard',
          language: show.language,
          screenId: show.screenId,
          screen: show.screenName,
          status: show.statusTxt,
          encrypted: show.encrypted
        }))
    );

    return {
      id: movie.id,
      name: movie.n || movie.filmNameWeb || movie.filmName,
      language: movie.otherlanguages,
      languages: movie.mfs || [],
      genre: movie.othergenres,
      genres: movie.grs || [],
      certificate: movie.ce || movie.certificateLk,
      duration: movie.mlength,
      poster: movie.miv,
      banner: movie.mih,
      trailer: movie.mtrailerurl,
      showCount: shows.length,
      shows
    };
  }).filter((movie) => movie.shows.length > 0);

  return {
    cinema: {
      id: cinema.theatreId,
      name: cinema.name,
      address: cinema.address1,
      city: cinema.cityName,
      lat: coords.lat,
      lng: coords.lng,
      latitude: coords.latitude,
      longitude: coords.longitude,
      coordinates: coords.coordinates,
      distance: cinema.distanceText,
      foodAvailable: cinema.foodAvailable,
      isPosAvailable: cinema.isPosAvailable,
      screens: Object.values(cinema.screens || {}).map((screen) => ({
        id: screen.screenId,
        name: screen.screenName,
        type: screen.screenType,
        handicap: screen.handicap,
        minSeats: screen.minSeats
      }))
    },
    showCount: responseBody?.output?.showCount ?? movies.reduce((sum, movie) => sum + movie.showCount, 0),
    days: responseBody?.output?.days || [],
    movies
  };
}

function summarizeSessions(responseBody, payload = {}) {
  const sessions = responseBody?.output?.cinemaMovieSessions;
  if (!Array.isArray(sessions)) return responseBody;

  const cinemaRe = responseBody?.output?.cinemaRe || sessions[0]?.cinemaRe || responseBody?.output?.cinema || {};
  const cid = String(cinemaRe.theatreId || cinemaRe.id || payload.cid || '');
  const coords = normalizeCinemaCoordinates(
    cinemaRe.latitude || cinemaRe.lat || payload.latitude || payload.lat,
    cinemaRe.longitude || cinemaRe.lng || payload.longitude || payload.lng
  );

  return {
    cinema: {
      id: cid,
      name: cinemaRe.name || cinemaRe.theatreName || payload.cinemaName || '',
      address: cinemaRe.address1 || cinemaRe.address || payload.address || '',
      city: cinemaRe.cityName || cinemaRe.city || payload.city || '',
      lat: coords.lat,
      lng: coords.lng,
      latitude: coords.latitude,
      longitude: coords.longitude,
      coordinates: coords.coordinates
    },
    shows: sessions.flatMap((cs) => {
      const movies = Array.isArray(cs.movieRe) ? cs.movieRe : [cs.movieRe].filter(Boolean);
      const movieById = new Map();
      movies.forEach((m) => {
        if (m.id) movieById.set(String(m.id), m);
        (m.filmIds || []).forEach((fid) => movieById.set(String(fid), m));
      });

      return (cs.experienceSessions || []).flatMap((es) =>
        (es.shows || [])
          .filter((s) => s.status === 1)
          .map((s) => {
            const movie = movieById.get(String(s.movieId)) || movies[0] || {};
            return {
              sessionId: s.sessionId,
              movieId: s.movieId,
              movieName: movie.n || movie.filmNameWeb,
              language: s.language,
              format: es.experience || 'Standard',
              time: s.showTime,
              screen: s.screenName,
              date: s.showDate
            };
          })
      );
    })
  };
}

function summarizeOffers(responseBody) {
  const offers = responseBody?.output?.offers;
  if (!Array.isArray(offers)) return responseBody;

  return {
    offers: offers.map((o) => ({
      id: o.id,
      title: o.vouDesc,
      bank: o.bank || null,
      type: o.type || null,
      category: o.category || null,
      validFrom: o.validFrom || null,
      validTo: o.validTo || null,
      code: o.fixedCode || null,
      redemptionOutlet: o.redemptionOutlet || null,
      summary: Array.isArray(o.tnc) && o.tnc.length > 0 ? o.tnc[0] : null
    }))
  };
}

function summarizeSeatLayout(responseBody, payload = {}) {
  const output = responseBody?.output || responseBody;
  const rawRows = output?.rows || [];
  const rawPriceList = output?.priceList || {};
  const filmData = output?.filmData || {};
  const summary = output?.availabilitySummary || {};

  const cleanPriceList = {};
  const categoriesMap = {};

  if (Array.isArray(rawPriceList)) {
    rawPriceList.forEach((item) => {
      const code = item.priceCode || item.code || item.c || item.description || 'Standard';
      const name = item.description || item.name || code;
      const price = typeof item.price === 'number' ? item.price : (Number(item.price) || 0);
      cleanPriceList[code] = { code, name, price };
      categoriesMap[code] = { name, price, availableSeats: [], totalSeats: 0 };
    });
  } else if (typeof rawPriceList === 'object' && rawPriceList !== null) {
    Object.entries(rawPriceList).forEach(([key, item]) => {
      if (typeof item === 'object' && item !== null) {
        const name = item.description || item.name || key;
        const price = typeof item.price === 'number' ? item.price : (Number(item.price) || 0);
        cleanPriceList[key] = { code: key, name, price };
        categoriesMap[key] = { name, price, availableSeats: [], totalSeats: 0 };
      } else {
        const price = typeof item === 'number' ? item : (Number(item) || 0);
        cleanPriceList[key] = { code: key, name: key, price };
        categoriesMap[key] = { name: key, price, availableSeats: [], totalSeats: 0 };
      }
    });
  }

  const cleanRows = rawRows.map((row) => {
    if (row?.t === 'area') {
      const priceCode = row.priceCode || row.c || '';
      return {
        t: 'area',
        n: row.n || '',
        priceCode,
        price: cleanPriceList[priceCode]?.price || 0,
        s: []
      };
    }

    const seats = Array.isArray(row?.s)
      ? row.s.map((st) => {
          if (!st?.sn || st.s === 0) {
            return { displaynumber: '', available: false };
          }
          const catCode = st.c || st.pc || 'CL-CLASSIC';
          const isAvail = Boolean(st.available);

          if (!categoriesMap[catCode]) {
            const label = catCode.includes('-') ? catCode.split('-')[1] : catCode;
            categoriesMap[catCode] = { name: label, price: cleanPriceList[catCode]?.price || 300, availableSeats: [], totalSeats: 0 };
          }
          categoriesMap[catCode].totalSeats += 1;
          if (isAvail) {
            categoriesMap[catCode].availableSeats.push(st.sn);
          }

          return {
            sn: st.sn,
            c: catCode,
            displaynumber: String(st.displaynumber || ''),
            available: isAvail
          };
        })
      : [];

    return {
      t: 'seats',
      n: row.n || '',
      s: seats
    };
  });

  const categories = Object.entries(categoriesMap).map(([code, cat]) => ({
    code,
    name: cat.name,
    price: cat.price,
    availableCount: cat.availableSeats.length,
    totalCount: cat.totalSeats,
    availableSeats: cat.availableSeats
  }));

  return {
    cinemaName: output.cinemaName || payload.cinemaName || 'PVR Cinema',
    cinemaCode: output.cinemaCode || payload.cinemaCode || payload.cid || '',
    filmName: filmData.filmName || output.filmName || payload.filmName || '',
    filmId: String(filmData.filmId || output.filmId || payload.filmId || ''),
    experience: filmData.format || output.experience || payload.experience || 'Standard',
    language: filmData.language || 'English',
    certificate: filmData.certificate || 'UA',
    showId: String(output.showId || payload.showId || ''),
    showTime: output.showTime || payload.showTime || '',
    showDateTime: output.showDateTime || `${payload.dated || ''} ${output.showTime || ''}`.trim(),
    dated: payload.dated || new Date().toISOString().split('T')[0],
    city: output.city?.name || payload.city || '',
    availabilitySummary: summary,
    priceList: cleanPriceList,
    categories,
    rows: cleanRows
  };
}

// ============================================================
// GET/POST /api/pvr/cities?city=Delhi&lat=28.6139&lng=77.2090
// Fetch city list/nearest city from PVR.
// ============================================================
registerGetPost('/cities', (req, res) => {
  const config = pvrApiUrls.city;
  const payload = buildPayload(config.payload, req, buildCoordinateOverrides(req, config.payload, { includeCity: false }));
  const city = getRequestValue(req, 'city', 'CityName');

  return callPvrApi({ req, res, config, payload, city, endpoint: 'city' });
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

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeCinemas, endpoint: 'cinemas' });
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

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeCinemaWiseShowtimes, endpoint: 'cshowtimes' });
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

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeMovieShowtimes, endpoint: 'mshowtimes' });
});

// ============================================================
// GET/POST /api/pvr/movies?city=Delhi&status=NOW_SHOWING|UPCOMING|ALL
// Fetch clean list of live movies from PVR.
// ============================================================
registerGetPost('/movies', (req, res) => {
  const config = pvrApiUrls.showtimes.mshowtimes;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeLiveMovieList, endpoint: 'mshowtimes' });
});

// ============================================================
// GET/POST /api/pvr/nowshowing?city=Delhi
// Alias for now-showing live movies from PVR.
// ============================================================
registerGetPost('/nowshowing', (req, res) => {
  const config = pvrApiUrls.showtimes.mshowtimes;
  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeLiveMovieList, endpoint: 'mshowtimes' });
});

// ============================================================
// GET/POST /api/pvr/cinemas/:cinemaId/sessions?city=Delhi&dated=2026-06-26
// Fetch sessions for one PVR cinema.
// ============================================================
registerGetPost('/cinemas/:cinemaId/sessions', async (req, res) => {
  const config = pvrApiUrls.csessions;
  const city = getCityFromRequest(req) || 'Delhi';
  const rawCid = req.params.cinemaId || getCidRequestValue(req, '');
  let resolvedCid = rawCid;
  let resolvedCinema = null;

  try {
    const cinemasPayload = buildPayload(pvrApiUrls.cinemas.payload, req, buildCoordinateOverrides(req, pvrApiUrls.cinemas.payload));
    const cinemasResponse = await fetchPvrJson(
      pvrApiUrls.cinemas,
      cinemasPayload,
      city,
      'cinemas',
      getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
    );
    resolvedCinema = findCinemaInCinemaList(cinemasResponse?.output?.c || [], rawCid);
    if (resolvedCinema && resolvedCinema.theatreId) {
      resolvedCid = String(resolvedCinema.theatreId);
    }
  } catch (e) {}

  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    cid: resolvedCid,
    cinemaName: resolvedCinema?.name || '',
    address: resolvedCinema?.address1 || '',
    latitude: resolvedCinema?.latitude,
    longitude: resolvedCinema?.longitude,
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeSessions, endpoint: 'csessions' });
});

// ============================================================
// GET/POST /api/pvr/sessions?city=Delhi&cid=DL001&dated=2026-06-26
// Fetch sessions for a cinema when cid is supplied as a query/body field.
// ============================================================
registerGetPost('/sessions', async (req, res) => {
  const config = pvrApiUrls.csessions;
  const city = getCityFromRequest(req) || 'Delhi';
  const rawCid = getCidRequestValue(req, '');
  let resolvedCid = rawCid;
  let resolvedCinema = null;

  try {
    const cinemasPayload = buildPayload(pvrApiUrls.cinemas.payload, req, buildCoordinateOverrides(req, pvrApiUrls.cinemas.payload));
    const cinemasResponse = await fetchPvrJson(
      pvrApiUrls.cinemas,
      cinemasPayload,
      city,
      'cinemas',
      getRequestValue(req, 'chain', REQUIRED_HEADERS.chain)
    );
    resolvedCinema = findCinemaInCinemaList(cinemasResponse?.output?.c || [], rawCid);
    if (resolvedCinema && resolvedCinema.theatreId) {
      resolvedCid = String(resolvedCinema.theatreId);
    }
  } catch (e) {}

  if (!resolvedCid) {
    return res.status(400).json({
      status: 'error',
      message: 'cid is required'
    });
  }

  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, config.payload),
    cid: resolvedCid,
    cinemaName: resolvedCinema?.name || '',
    address: resolvedCinema?.address1 || '',
    latitude: resolvedCinema?.latitude,
    longitude: resolvedCinema?.longitude,
    dated: normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', config.payload.dated)))
  });

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeSessions, endpoint: 'csessions' });
});

// ============================================================
// GET/POST /api/pvr/offers?city=Mumbai-All&id=0&payment=false
// Fetch PVR offer list for a city.
// ============================================================
registerGetPost('/offers', (req, res) => {
  const config = pvrApiUrls.offers;
  const city = getCityFromRequest(req) || 'Mumbai-All';
  const payload = buildPayload(config.payload, req, { city });

  return callPvrApi({ req, res, config, payload, transformResponse: summarizeOffers, endpoint: 'offers' });
});

// ============================================================
// GET/POST /api/pvr/seatlayout?city=Noida&cid=396&dated=2026-08-24&showId=34070
// Fetch seat layout strictly matching the requested show and cinema.
// ============================================================
registerGetPost('/seatlayout', async (req, res) => {
  const config = pvrApiUrls.seatlayout;
  const city = getCityFromRequest(req) || 'Delhi';
  const rawCid = getCidRequestValue(req, '');
  const dated = normalizeDate(getRequestValue(req, 'dated', getRequestValue(req, 'date', new Date().toISOString().split('T')[0])));
  const requestedShowId = getShowIdRequestValue(req, '');
  const requestedFilmId = getRequestValue(req, 'filmId', '');
  const requestedFilmName = getFilmNameRequestValue(req, '');
  const requestedShowTime = getShowTimeRequestValue(req, '');
  const requestedExperience = getRequestValue(req, 'experience', getRequestValue(req, 'format', ''));

  const payload = buildPayload(config.payload, req, {
    ...buildCoordinateOverrides(req, { city }),
    city,
    cid: rawCid,
    cinemaCode: rawCid,
    cinemaName: getRequestValue(req, 'cinemaName', rawCid),
    dated,
    filmId: requestedFilmId,
    filmName: requestedFilmName,
    showId: requestedShowId,
    sessionId: requestedShowId,
    showTime: requestedShowTime,
    experience: requestedExperience,
    seed: getRequestValue(req, 'seed', '')
  });

  console.log(`[SeatLayout] Incoming Request -> city="${city}", cid="${rawCid}", dated="${dated}", showId="${requestedShowId}", filmName="${requestedFilmName}", showTime="${requestedShowTime}"`);

  // If request contains neither showId nor film/showTime, return 400 Bad Request
  if (!requestedShowId && !requestedFilmId && !requestedFilmName && !requestedShowTime) {
    console.warn(`[SeatLayout] MISSING IDENTIFIER -> neither showId nor film/time was provided`);
    return res.status(400).json({
      status: 'bad_request',
      message: 'A valid showId, sessionId, or movie name/time is required to retrieve seat layout',
      requested: {
        city,
        cid: rawCid,
        dated,
        showId: requestedShowId
      }
    });
  }

  try {
    const enrichedPayload = await enrichSeatLayoutPayload(req, payload);

    // If a requested show could not be found:
    if (!enrichedPayload) {
      console.warn(`[SeatLayout] NOT FOUND -> requested showId="${requestedShowId}", cid="${rawCid}", city="${city}", dated="${dated}"`);
      return res.status(404).json({
        status: 'not_found',
        message: 'Seat layout is not available for the requested show',
        requested: {
          city,
          cid: rawCid,
          dated,
          showId: requestedShowId
        }
      });
    }

    const rawData = randomizeSeatLayoutAvailability(createSeatLayoutTemplate(enrichedPayload), enrichedPayload);
    const data = summarizeSeatLayout(rawData, enrichedPayload);
    const source = 'pvr-metadata-seats';

    // Mandatory Final Pre-Return Dual Validation
    const requested = requestedShowId ? String(requestedShowId).trim() : '';
    const payloadShowId = String(enrichedPayload?.showId ?? enrichedPayload?.sessionId ?? '').trim();
    const dataShowId = String(data?.showId ?? data?.sessionId ?? '').trim();

    if (requested) {
      if (payloadShowId !== requested || dataShowId !== requested) {
        console.error("[SeatLayout] FINAL RESPONSE MISMATCH", {
          requestedShowId: requested,
          payloadShowId,
          dataShowId,
          cid: rawCid,
          payloadMovie: enrichedPayload?.filmName,
          dataMovie: data?.filmName
        });

        return res.status(409).json({
          status: "mismatch",
          message: "Seat layout response does not match the requested show",
          requested: {
            city,
            cid: rawCid,
            dated,
            showId: requestedShowId
          },
          resolved: {
            payloadShowId,
            dataShowId,
            filmName: data?.filmName,
            showTime: data?.showTime
          }
        });
      }
    }

    console.log(`[SeatLayout] SUCCESS -> resolved showId="${data.showId}", cinema="${data.cinemaName}" (ID: ${data.cinemaCode}), movie="${data.filmName}", date="${data.dated}", time="${data.showTime}", source="${source}"`);

    return res.json({
      status: 'success',
      source,
      upstreamUrl: null,
      payload: enrichedPayload,
      data
    });
  } catch (error) {
    console.error(`[SeatLayout] EXCEPTION -> ${error.message}`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve seat layout for the requested show',
      error: error.message,
      requested: {
        city,
        cid: rawCid,
        dated,
        showId: requestedShowId
      }
    });
  }
});

module.exports = router;
