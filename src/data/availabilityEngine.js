// ============================================================
// AVAILABILITY ENGINE
// Generates realistic, pseudo-random but consistent availability
// Based on: movieId + cinemaId + date + showTime (deterministic seed)
// ============================================================

const { SEAT_CONFIG, SHOW_SLOTS, PRICING, IMAX_CINEMAS, FOURDX_CINEMAS, GOLD_CINEMAS, PXL_CINEMAS, DIRECTORS_CUT_CINEMAS, PLAYHOUSE_CINEMAS } = require('./masterData');

// Deterministic "random" based on a seed string
// Same inputs always return same result (consistent mock data)
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 100);
}

// Get occupancy % for a specific show
function getOccupancy(movieId, cinemaId, date, showTime, format) {
  const seed = `${movieId}-${cinemaId}-${date}-${showTime}-${format}`;
  const base = seededRandom(seed);

  // Prime time shows (6 PM - 10 PM) are busier
  const hour = parseInt(showTime.split(':')[0]);
  const isPM = showTime.includes('PM');
  const hour24 = isPM && hour !== 12 ? hour + 12 : hour;
  const isPrimeTime = hour24 >= 18 && hour24 <= 22;
  const isWeekend = isWeekendDate(date);

  let occupancy = base;
  if (isPrimeTime) occupancy = Math.min(100, occupancy + 30);
  if (isWeekend) occupancy = Math.min(100, occupancy + 20);

  // Premium formats (GOLD, DIRECTORS_CUT) tend to be less full
  if (format === 'GOLD' || format === 'DIRECTORS_CUT') {
    occupancy = Math.max(10, occupancy - 20);
  }

  // IMAX and 4DX tend to fill up fast for blockbusters
  if (format === 'IMAX' || format === '4DX') {
    occupancy = Math.min(100, occupancy + 15);
  }

  return occupancy;
}

function isWeekendDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 || day === 5 || day === 6; // Fri, Sat, Sun
  } catch {
    return false;
  }
}

function getAvailabilityStatus(occupancy) {
  if (occupancy >= 100) return { status: "SOLD_OUT",      label: "Sold Out",     emoji: "❌", bookable: false };
  if (occupancy >= 85)  return { status: "FAST_FILLING",  label: "Fast Filling", emoji: "🔥", bookable: true  };
  if (occupancy >= 60)  return { status: "FILLING_FAST",  label: "Filling Fast", emoji: "⚡", bookable: true  };
  if (occupancy >= 30)  return { status: "AVAILABLE",     label: "Available",    emoji: "✅", bookable: true  };
  return                       { status: "AVAILABLE",     label: "Available",    emoji: "✅", bookable: true  };
}

function getSeatsLeft(occupancy, format) {
  const config = SEAT_CONFIG[format] || SEAT_CONFIG['Standard'];
  const booked = Math.floor((occupancy / 100) * config.totalSeats);
  return Math.max(0, config.totalSeats - booked);
}

// Generate seat map for an auditorium
function generateSeatMap(occupancy, format) {
  const config = SEAT_CONFIG[format] || SEAT_CONFIG['Standard'];
  const rows = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRST'.split('').slice(0, config.rows);

  rowLabels.forEach((rowLabel, rowIdx) => {
    const seats = [];
    for (let seatNum = 1; seatNum <= config.seatsPerRow; seatNum++) {
      // Seed per seat for consistency
      const seatSeed = `${rowLabel}${seatNum}-${occupancy}-${format}`;
      const seatRand = seededRandom(seatSeed);
      // Front rows and middle sections fill faster
      const isMidSection = seatNum >= Math.floor(config.seatsPerRow * 0.3) &&
                           seatNum <= Math.floor(config.seatsPerRow * 0.7);
      const isMidRow = rowIdx >= Math.floor(config.rows * 0.3) &&
                       rowIdx <= Math.floor(config.rows * 0.7);
      let bookedChance = occupancy;
      if (isMidSection && isMidRow) bookedChance = Math.min(100, occupancy + 20);

      seats.push({
        seatId: `${rowLabel}${seatNum}`,
        row: rowLabel,
        number: seatNum,
        status: seatRand < bookedChance ? "BOOKED" : "AVAILABLE",
        type: getSeatType(rowIdx, config.rows, format)
      });
    }
    rows.push({ row: rowLabel, seats });
  });

  return rows;
}

function getSeatType(rowIdx, totalRows, format) {
  if (format === 'GOLD' || format === 'DIRECTORS_CUT') return 'RECLINER';
  const position = rowIdx / totalRows;
  if (position < 0.25) return 'CLASSIC';
  if (position < 0.6) return 'PRIME';
  return 'RECLINER';
}

// Get formats available at a specific cinema for a movie
function getAvailableFormats(movieFormats, cinemaId) {
  const available = [];
  if (movieFormats.includes('Standard')) available.push('Standard');
  if (movieFormats.includes('IMAX') && IMAX_CINEMAS.includes(cinemaId)) available.push('IMAX');
  if (movieFormats.includes('4DX') && FOURDX_CINEMAS.includes(cinemaId)) available.push('4DX');
  if (movieFormats.includes('3D')) available.push('3D');
  if (movieFormats.includes('GOLD') && GOLD_CINEMAS.includes(cinemaId)) available.push('GOLD');
  if (movieFormats.includes('PXL') && PXL_CINEMAS.includes(cinemaId)) available.push('PXL');
  if (movieFormats.includes('DIRECTORS_CUT') && DIRECTORS_CUT_CINEMAS.includes(cinemaId)) available.push('DIRECTORS_CUT');
  if (movieFormats.includes('SCREEN_X')) available.push('SCREEN_X');
  if (movieFormats.includes('ICE')) available.push('ICE');
  if (movieFormats.includes('ATMOS')) available.push('ATMOS');
  if (movieFormats.includes('MX4D')) available.push('MX4D');
  if (movieFormats.includes('PLAYHOUSE') && PLAYHOUSE_CINEMAS.includes(cinemaId)) available.push('PLAYHOUSE');
  return available;
}

// Build complete show schedule for a cinema + movie + date
function buildShowSchedule(movie, cinema, date, cityName) {
  const availableFormats = getAvailableFormats(movie.formats, cinema.id);
  const cityKey = cityName.toLowerCase();
  const shows = [];

  availableFormats.forEach(format => {
    const slots = SHOW_SLOTS[format] || SHOW_SLOTS['Standard'];
    const basePrice = (PRICING[format] || PRICING['Standard'])[cityKey] || 300;

    slots.forEach(showTime => {
      const occupancy = getOccupancy(movie.filmId, cinema.id, date, showTime, format);
      const availInfo = getAvailabilityStatus(occupancy);
      const seatsLeft = getSeatsLeft(occupancy, format);
      const config = SEAT_CONFIG[format] || SEAT_CONFIG['Standard'];

      shows.push({
        showId: `${movie.filmId}-${cinema.id}-${date.replace(/\s/g, '')}-${format}-${showTime.replace(/\s/g, '')}`,
        movieId: movie.filmId,
        movieName: movie.name,
        cinemaId: cinema.id,
        cinemaName: cinema.name,
        area: cinema.area,
        date,
        showTime,
        format,
        language: movie.languages[0],
        availableLanguages: movie.languages,
        pricing: {
          classic:   Math.round(basePrice * 0.85),
          prime:     basePrice,
          recliner:  Math.round(basePrice * 1.35),
          currency: "INR"
        },
        availability: {
          ...availInfo,
          occupancyPercent: occupancy,
          seatsLeft,
          totalSeats: config.totalSeats
        },
        auditorium: {
          totalSeats: config.totalSeats,
          rows: config.rows,
          seatsPerRow: config.seatsPerRow
        },
        bookingUrl: `https://www.pvrcinemas.com/buytickets/${movie.filmId}/${cinema.id}/${date}/${format}/${encodeURIComponent(showTime)}`
      });
    });
  });

  return shows;
}

module.exports = {
  buildShowSchedule,
  generateSeatMap,
  getOccupancy,
  getAvailabilityStatus,
  getSeatsLeft,
  getAvailableFormats
};
