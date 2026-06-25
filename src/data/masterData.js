// ============================================================
// PVR INOX MOCK DATA — All Major Cities
// Movies pulled from actual nowShowing + upcoming JSONs
// ============================================================

const CITIES = {
  delhi: {
    id: 47,
    name: "Delhi",
    region: "NORTH",
    cinemas: [
      { id: "DL001", name: "PVR Ambience Mall, Vasant Kunj", area: "South Delhi" },
      { id: "DL002", name: "PVR Select Citywalk, Saket", area: "South Delhi" },
      { id: "DL003", name: "PVR Pacific Mall, Tagore Garden", area: "West Delhi" },
      { id: "DL004", name: "INOX Nehru Place", area: "South Delhi" },
      { id: "DL005", name: "PVR DLF Avenue, Saket", area: "South Delhi" },
      { id: "DL006", name: "INOX R2K, Rajouri Garden", area: "West Delhi" }
    ]
  },
  mumbai: {
    id: 1,
    name: "Mumbai",
    region: "WEST",
    cinemas: [
      { id: "MU001", name: "PVR Juhu", area: "Juhu" },
      { id: "MU002", name: "PVR Infinity Mall, Andheri", area: "Andheri" },
      { id: "MU003", name: "INOX Nariman Point", area: "South Mumbai" },
      { id: "MU004", name: "PVR Phoenix Palladium, Lower Parel", area: "Lower Parel" },
      { id: "MU005", name: "INOX R-City Mall, Ghatkopar", area: "Ghatkopar" },
      { id: "MU006", name: "PVR Oberoi Mall, Goregaon", area: "Goregaon" }
    ]
  },
  bangalore: {
    id: 28,
    name: "Bangalore",
    region: "SOUTH",
    cinemas: [
      { id: "BL001", name: "PVR Orion Mall, Rajajinagar", area: "West Bangalore" },
      { id: "BL002", name: "INOX Garuda Mall, MG Road", area: "Central" },
      { id: "BL003", name: "PVR Forum Mall, Koramangala", area: "South Bangalore" },
      { id: "BL004", name: "PVR Phoenix Marketcity, Whitefield", area: "East Bangalore" },
      { id: "BL005", name: "INOX Mantri Square, Malleshwaram", area: "North Bangalore" }
    ]
  },
  chennai: {
    id: 10,
    name: "Chennai",
    region: "SOUTH",
    cinemas: [
      { id: "CH001", name: "PVR VR Chennai, Anna Nagar", area: "Anna Nagar" },
      { id: "CH002", name: "INOX Express Avenue, Royapettah", area: "Central" },
      { id: "CH003", name: "PVR Phoenix Marketcity, Velachery", area: "South Chennai" },
      { id: "CH004", name: "INOX Virugambakkam", area: "West Chennai" }
    ]
  },
  hyderabad: {
    id: 9,
    name: "Hyderabad",
    region: "SOUTH",
    cinemas: [
      { id: "HY001", name: "PVR Inorbit Mall, Madhapur", area: "Hitech City" },
      { id: "HY002", name: "INOX GVK One, Banjara Hills", area: "Banjara Hills" },
      { id: "HY003", name: "PVR Forum Sujana Mall, Kukatpally", area: "Kukatpally" },
      { id: "HY004", name: "INOX Hyderabad Central, Punjagutta", area: "Punjagutta" }
    ]
  },
  pune: {
    id: 18,
    name: "Pune",
    region: "WEST",
    cinemas: [
      { id: "PU001", name: "PVR Phoenix Marketcity, Nagar Road", area: "East Pune" },
      { id: "PU002", name: "INOX Inox Bund Garden", area: "Central Pune" },
      { id: "PU003", name: "PVR Pavilion Mall, Pune Camp", area: "Camp" },
      { id: "PU004", name: "INOX Amanora Mall, Hadapsar", area: "East Pune" }
    ]
  }
};

// Cinemas that have IMAX screens
const IMAX_CINEMAS = ["DL002", "DL005", "MU001", "MU004", "BL001", "BL004", "CH003", "HY001", "PU001"];

// Cinemas that have 4DX screens
const FOURDX_CINEMAS = ["DL001", "DL002", "MU002", "MU004", "BL003", "CH001", "HY001", "PU001"];

// Cinemas that have GOLD class
const GOLD_CINEMAS = ["DL002", "DL005", "MU001", "MU004", "BL001", "HY001", "PU001"];

// Cinemas that have P[XL]
const PXL_CINEMAS = ["DL001", "DL002", "MU001", "MU003", "BL002", "CH002", "HY002", "PU002"];

// Cinemas that have Director's Cut
const DIRECTORS_CUT_CINEMAS = ["DL002", "MU004", "BL001"];

// Cinemas that have Playhouse
const PLAYHOUSE_CINEMAS = ["DL001", "MU002", "BL003", "CH001", "HY003"];

// ============================================================
// MOVIES (from actual nowShowing + upcoming data)
// ============================================================
const MOVIES = {
  "36850": {
    filmId: "36850",
    filmCommonCode: "36850",
    name: "COCKTAIL 2",
    certification: "A",
    duration: "2h 15m",
    genres: ["Romance", "Drama"],
    languages: ["Hindi"],
    formats: ["Standard", "GOLD", "PXL", "DIRECTORS_CUT"],
    releaseDate: "Jun 19, 2026",
    status: "NOW_SHOWING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/36850_UxuBHknq.jpg"
  },
  "35277": {
    filmId: "35277",
    filmCommonCode: "35277",
    name: "SUPERGIRL",
    certification: "UA 16+",
    duration: "2h 00m",
    genres: ["Action", "Adventure"],
    languages: ["English", "Hindi", "Tamil", "Telugu"],
    formats: ["Standard", "IMAX", "4DX", "3D", "SCREEN_X", "ICE", "ATMOS", "MX4D"],
    releaseDate: "Jun 26, 2026",
    status: "NOW_SHOWING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/35277_cevoOdPd.jpg"
  },
  "35098": {
    filmId: "35098",
    filmCommonCode: "35098",
    name: "THE ODYSSEY",
    certification: "A",
    duration: "2h 55m",
    genres: ["Action", "Drama"],
    languages: ["English", "Hindi", "Tamil", "Telugu"],
    formats: ["Standard", "IMAX", "4DX", "ATMOS"],
    releaseDate: "Jul 17, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/35098_eweNdpsL.jpg"
  },
  "36637": {
    filmId: "36637",
    filmCommonCode: "36637",
    name: "MINIONS AND MONSTERS",
    certification: "UA 7+",
    duration: "1h 50m",
    genres: ["Animation", "Adventure"],
    languages: ["English", "Hindi", "Tamil", "Telugu"],
    formats: ["Standard", "IMAX", "4DX", "3D", "SCREEN_X", "ICE", "ATMOS"],
    releaseDate: "Jul 02, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/36637_4ZbJApbj.jpg"
  },
  "35099": {
    filmId: "35099",
    filmCommonCode: "35099",
    name: "DHAMAAL 4",
    certification: "UA 13+",
    duration: "2h 10m",
    genres: ["Comedy"],
    languages: ["Hindi"],
    formats: ["Standard", "4DX"],
    releaseDate: "Jul 10, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/35099_1LFDmzm8.jpg"
  },
  "35308": {
    filmId: "35308",
    filmCommonCode: "35308",
    name: "RAMAYANA: PART 1",
    certification: "UA 13+",
    duration: "2h 45m",
    genres: ["Adventure", "Fantasy"],
    languages: ["Hindi", "Tamil", "Telugu"],
    formats: ["Standard", "IMAX", "4DX"],
    releaseDate: "Nov 06, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/35308_s20s7Q2Q.jpg"
  },
  "35312": {
    filmId: "35312",
    filmCommonCode: "35312",
    name: "AVENGERS: DOOMSDAY",
    certification: "UA 13+",
    duration: "2h 30m",
    genres: ["Action", "Drama", "Fantasy", "Sci-Fi"],
    languages: ["English", "Hindi", "Tamil", "Telugu", "Malayalam"],
    formats: ["Standard", "IMAX", "4DX", "3D", "SCREEN_X", "ICE"],
    releaseDate: "Dec 18, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/35312_lVmwRmPz.jpg"
  },
  "29988": {
    filmId: "29988",
    filmCommonCode: "29988",
    name: "WELCOME TO THE JUNGLE",
    certification: "UA 16+",
    duration: "2h 45m",
    genres: ["Comedy"],
    languages: ["Hindi"],
    formats: ["Standard", "ATMOS"],
    releaseDate: "Jun 25, 2026",
    status: "NOW_SHOWING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/29988_ksSPCQH3.jpg"
  },
  "36353": {
    filmId: "36353",
    filmCommonCode: "36353",
    name: "KING",
    certification: "UA 13+",
    duration: "2h 30m",
    genres: ["Action", "Drama"],
    languages: ["Hindi"],
    formats: ["Standard", "4DX", "IMAX"],
    releaseDate: "Dec 24, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/36353_h7ek7XEX.jpg"
  },
  "34785": {
    filmId: "34785",
    filmCommonCode: "34785",
    name: "TOXIC: A FAIRY TALE FOR GROWN-UPS",
    certification: "UA 16+",
    duration: "2h 20m",
    genres: ["Action", "Thriller"],
    languages: ["Kannada", "Hindi", "Tamil", "Telugu", "Malayalam"],
    formats: ["Standard", "IMAX", "4DX"],
    releaseDate: "Aug 26, 2026",
    status: "UPCOMING",
    posterUrl: "https://originserver-static1-uat.pvrcinemas.com/pvrcms/movie_v/34785_EIdwvuSb.jpg"
  }
};

// ============================================================
// SHOW TIME SLOTS BY FORMAT
// ============================================================
const SHOW_SLOTS = {
  Standard: ["09:00 AM", "11:30 AM", "2:00 PM", "4:30 PM", "7:00 PM", "9:30 PM", "11:59 PM"],
  IMAX:     ["10:00 AM", "1:30 PM", "5:00 PM", "8:30 PM"],
  "4DX":    ["11:00 AM", "2:30 PM", "6:00 PM", "9:15 PM"],
  "3D":     ["10:30 AM", "1:00 PM", "3:30 PM", "6:30 PM", "9:00 PM"],
  GOLD:     ["11:00 AM", "2:00 PM", "5:00 PM", "8:00 PM"],
  PXL:      ["10:00 AM", "1:00 PM", "4:00 PM", "7:30 PM"],
  DIRECTORS_CUT: ["2:00 PM", "6:30 PM"],
  SCREEN_X: ["11:30 AM", "3:00 PM", "7:00 PM"],
  ICE:      ["12:00 PM", "3:30 PM", "7:30 PM"],
  ATMOS:    ["10:00 AM", "1:30 PM", "5:00 PM", "8:30 PM"],
  MX4D:     ["11:00 AM", "2:30 PM", "6:00 PM", "9:00 PM"],
  PLAYHOUSE: ["10:00 AM", "12:30 PM", "3:00 PM"]
};

// ============================================================
// PRICING BY FORMAT & CITY (INR)
// ============================================================
const PRICING = {
  Standard: { delhi: 280, mumbai: 320, bangalore: 260, chennai: 240, hyderabad: 230, pune: 250 },
  IMAX:     { delhi: 650, mumbai: 700, bangalore: 620, chennai: 580, hyderabad: 560, pune: 600 },
  "4DX":    { delhi: 700, mumbai: 750, bangalore: 680, chennai: 640, hyderabad: 620, pune: 650 },
  "3D":     { delhi: 380, mumbai: 420, bangalore: 360, chennai: 340, hyderabad: 320, pune: 350 },
  GOLD:     { delhi: 900, mumbai: 1000, bangalore: 850, chennai: 800, hyderabad: 780, pune: 820 },
  PXL:      { delhi: 500, mumbai: 550, bangalore: 480, chennai: 450, hyderabad: 440, pune: 460 },
  DIRECTORS_CUT: { delhi: 1500, mumbai: 1800, bangalore: 1400, chennai: 1300, hyderabad: 1200, pune: 1350 },
  SCREEN_X: { delhi: 600, mumbai: 650, bangalore: 580, chennai: 550, hyderabad: 530, pune: 560 },
  ICE:      { delhi: 580, mumbai: 620, bangalore: 560, chennai: 530, hyderabad: 510, pune: 540 },
  ATMOS:    { delhi: 450, mumbai: 500, bangalore: 430, chennai: 400, hyderabad: 390, pune: 410 },
  MX4D:     { delhi: 680, mumbai: 730, bangalore: 660, chennai: 620, hyderabad: 600, pune: 630 },
  PLAYHOUSE:{ delhi: 350, mumbai: 400, bangalore: 330, chennai: 310, hyderabad: 300, pune: 320 }
};

// ============================================================
// SEAT CONFIGURATION BY FORMAT
// ============================================================
const SEAT_CONFIG = {
  Standard:      { rows: 15, seatsPerRow: 20, totalSeats: 300 },
  IMAX:          { rows: 18, seatsPerRow: 22, totalSeats: 396 },
  "4DX":         { rows: 10, seatsPerRow: 16, totalSeats: 160 },
  "3D":          { rows: 14, seatsPerRow: 18, totalSeats: 252 },
  GOLD:          { rows: 6,  seatsPerRow: 12, totalSeats: 72  },
  PXL:           { rows: 16, seatsPerRow: 20, totalSeats: 320 },
  DIRECTORS_CUT: { rows: 4,  seatsPerRow: 8,  totalSeats: 32  },
  SCREEN_X:      { rows: 12, seatsPerRow: 18, totalSeats: 216 },
  ICE:           { rows: 12, seatsPerRow: 18, totalSeats: 216 },
  ATMOS:         { rows: 16, seatsPerRow: 20, totalSeats: 320 },
  MX4D:          { rows: 10, seatsPerRow: 14, totalSeats: 140 },
  PLAYHOUSE:     { rows: 8,  seatsPerRow: 14, totalSeats: 112 }
};

module.exports = {
  CITIES,
  MOVIES,
  SHOW_SLOTS,
  PRICING,
  SEAT_CONFIG,
  IMAX_CINEMAS,
  FOURDX_CINEMAS,
  GOLD_CINEMAS,
  PXL_CINEMAS,
  DIRECTORS_CUT_CINEMAS,
  PLAYHOUSE_CINEMAS
};
