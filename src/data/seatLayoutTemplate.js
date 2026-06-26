// ============================================================
// Local PVR-style Seat Layout Template
// ============================================================

const PRICE_LIST = {
  'CL-CLASSIC': {
    price: '320.00',
    priceCode: 'CL-CLASSIC',
    description: 'CLASSIC',
    convFee: 44,
    cgst: 3.96,
    sgst: 3.96,
    totalGstPerTkt: '48.82',
    netPerTkt: '271.18'
  },
  'PR-PRIME': {
    price: '340.00',
    priceCode: 'PR-PRIME',
    description: 'PRIME',
    convFee: 44,
    cgst: 3.96,
    sgst: 3.96,
    totalGstPerTkt: '51.86',
    netPerTkt: '288.14'
  },
  'PI-PICTURE PERFECT': {
    price: '450.00',
    priceCode: 'PI-PICTURE PERFECT',
    description: 'PICTURE PERFECT',
    convFee: 59,
    cgst: 5.31,
    sgst: 5.31,
    totalGstPerTkt: '68.64',
    netPerTkt: '381.36'
  },
  'PP-PRIME PLUS': {
    price: '420.00',
    priceCode: 'PP-PRIME PLUS',
    description: 'PRIME PLUS',
    convFee: 55,
    cgst: 4.95,
    sgst: 4.95,
    totalGstPerTkt: '64.08',
    netPerTkt: '355.92'
  },
  'RE-RECLINER': {
    price: '630.00',
    priceCode: 'RE-RECLINER',
    description: 'RECLINER',
    convFee: 69,
    cgst: 6.21,
    sgst: 6.21,
    totalGstPerTkt: '96.10',
    netPerTkt: '533.90'
  }
};

const SEAT_AISLES = new Set([6, 7, 16, 26]);

function areaRow(name, priceCode) {
  const price = PRICE_LIST[priceCode];

  return {
    segments: null,
    n: `${name} (${price.price})`,
    nn: `${name} (${price.netPerTkt} + GST)`,
    s: [],
    t: 'area'
  };
}

function blankSeat() {
  return {
    displaynumber: '',
    b: null,
    c: null,
    pc: null,
    s: 0,
    sn: null,
    en: false,
    hc: false,
    bu: false,
    st: 0,
    cos: false
  };
}

function seat(rowName, displayNumber, priceCode) {
  const [prefix, label] = priceCode.split('-');

  return {
    displaynumber: String(displayNumber),
    b: `${prefix}.${label}|${rowName}:${displayNumber}`,
    c: priceCode,
    pc: priceCode,
    s: 1,
    sn: `${rowName}${displayNumber}`,
    en: false,
    hc: false,
    bu: false,
    st: 0,
    cos: false
  };
}

function seatRow(rowName, priceCode, seatCount = 22) {
  const seats = [];
  let displayNumber = 1;

  for (let position = 1; position <= seatCount + SEAT_AISLES.size; position += 1) {
    if (SEAT_AISLES.has(position)) {
      seats.push(blankSeat());
    } else {
      seats.push(seat(rowName, displayNumber, priceCode));
      displayNumber += 1;
    }
  }

  return {
    segments: null,
    n: rowName,
    nn: null,
    s: seats,
    t: 'seats'
  };
}

function buildRows() {
  return [
    areaRow('CLASSIC', 'CL-CLASSIC'),
    seatRow('A', 'CL-CLASSIC'),
    seatRow('B', 'CL-CLASSIC'),
    seatRow('C', 'CL-CLASSIC'),
    areaRow('PRIME', 'PR-PRIME'),
    seatRow('D', 'PR-PRIME'),
    seatRow('E', 'PI-PICTURE PERFECT'),
    seatRow('F', 'PI-PICTURE PERFECT'),
    areaRow('PRIME PLUS', 'PP-PRIME PLUS'),
    seatRow('G', 'PP-PRIME PLUS'),
    seatRow('H', 'PP-PRIME PLUS'),
    seatRow('J', 'PP-PRIME PLUS'),
    seatRow('K', 'PP-PRIME PLUS'),
    areaRow('RECLINER', 'RE-RECLINER'),
    seatRow('L', 'RE-RECLINER', 16)
  ];
}

function createSeatLayoutTemplate(overrides = {}) {
  const dated = overrides.dated || new Date().toISOString().split('T')[0];
  const city = overrides.city || 'Delhi';
  const cinemaName = overrides.cinemaName || 'PVR Demo Cinema';
  const cinemaCode = String(overrides.cinemaCode || overrides.cid || '000');
  const filmName = overrides.filmName || 'SUPERGIRL';
  const filmId = String(overrides.filmId || '35277');
  const showId = Number(overrides.showId || 35002);
  const showTime = overrides.showTime || `${dated} 19:30:00`;
  const runningTime = overrides.runningTime || 110;

  return {
    status: 200,
    code: 10001,
    result: 'success',
    msg: '',
    output: {
      priceList: PRICE_LIST,
      rows: buildRows(),
      cinemaCode,
      cinemaName,
      showDateTime: overrides.showDateTime || `${dated}, 7:30 PM`,
      pos: overrides.pos || 'SHOWBIZ',
      gstNumber: overrides.gstNumber || '24AAACP4526D1ZW',
      transId: null,
      chargeMsg: '',
      charge3D: false,
      showId,
      filmId,
      showTime,
      endTime: overrides.endTime || `${dated} 21:53:00`,
      hcmessage: '',
      experience: overrides.experience || 'IMAX',
      seatLayoutImage: '',
      filmData: {
        filmId,
        filmType: 'F',
        uniqueKey: `PVR-SHOWBIZ-${filmId}`,
        pos: 'SHOWBIZ',
        chainKey: 'PVR',
        filmName,
        format: overrides.experience || 'IMAX',
        certificate: overrides.certificate || 'UA 16+',
        runningTime,
        genre: overrides.genre || 'Action',
        language: overrides.language || 'English',
        filmCommonCode: filmId,
        filmCommonName: filmName,
        filmNameWeb: filmName,
        nowshowing: false
      },
      days: [],
      shows: [],
      vakaao: false,
      city: {
        id: Number(overrides.cityId || 47),
        name: city,
        region: overrides.region || 'NORTH',
        hasSubCities: false,
        vakaoo: false,
        state: overrides.state || 'DELHI',
        formats: '',
        cinemaCount: Number(overrides.cinemaCount || 27),
        subcities: [],
        lat: String(overrides.lat || '28.6139'),
        lng: String(overrides.lng || '77.2090'),
        image: '',
        imageR: ''
      },
      ca_a: true,
      ca_bm: '',
      ca_tm: '',
      cn: null,
      mn: null,
      hc: false,
      iw: null,
      tnc: 'The seat layout page is for representational purposes only and the actual seat layout might vary.',
      sd: false
    }
  };
}

module.exports = {
  createSeatLayoutTemplate
};
