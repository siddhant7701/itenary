// Curated gazetteer of popular Indian destinations. Used for geocoding trips, map pins,
// place search, AI suggestions and sandbox provider pricing (distance estimates).
// Coordinates are approximate and good enough for route visualisation.

export const DESTINATIONS = [
  {
    name: 'Goa', state: 'Goa', lat: 15.4909, lng: 73.8278, theme: 'beach',
    aliases: ['panaji', 'panjim', 'north goa', 'south goa'],
    places: [
      { name: 'Baga Beach', lat: 15.5553, lng: 73.7517, kind: 'beach', vibe: 70 },
      { name: 'Fort Aguada', lat: 15.4920, lng: 73.7732, kind: 'heritage', vibe: 40 },
      { name: 'Basilica of Bom Jesus', lat: 15.5009, lng: 73.9116, kind: 'heritage', vibe: 20 },
      { name: 'Anjuna Flea Market', lat: 15.5733, lng: 73.7407, kind: 'market', vibe: 55 },
      { name: 'Palolem Beach', lat: 15.0100, lng: 74.0232, kind: 'beach', vibe: 25 },
      { name: 'Dudhsagar Falls', lat: 15.3144, lng: 74.3143, kind: 'nature', vibe: 85 },
      { name: 'Fontainhas Latin Quarter', lat: 15.4975, lng: 73.8315, kind: 'walk', vibe: 30 },
      { name: 'Goa International Airport (Dabolim)', lat: 15.3808, lng: 73.8314, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Manali', state: 'Himachal Pradesh', lat: 32.2432, lng: 77.1892, theme: 'snow',
    aliases: ['kullu manali', 'kullu'],
    places: [
      { name: 'Hadimba Devi Temple', lat: 32.2486, lng: 77.1807, kind: 'spiritual', vibe: 25 },
      { name: 'Solang Valley', lat: 32.3166, lng: 77.1571, kind: 'adventure', vibe: 90 },
      { name: 'Old Manali Cafes', lat: 32.2574, lng: 77.1744, kind: 'food', vibe: 35 },
      { name: 'Jogini Falls Trek', lat: 32.2641, lng: 77.2001, kind: 'trek', vibe: 75 },
      { name: 'Atal Tunnel & Sissu', lat: 32.4190, lng: 77.1450, kind: 'nature', vibe: 65 },
      { name: 'Mall Road Manali', lat: 32.2396, lng: 77.1887, kind: 'market', vibe: 30 },
    ],
  },
  {
    name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, theme: 'heritage',
    aliases: ['pink city'],
    places: [
      { name: 'Amber Fort', lat: 26.9855, lng: 75.8513, kind: 'heritage', vibe: 45 },
      { name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267, kind: 'heritage', vibe: 20 },
      { name: 'City Palace Jaipur', lat: 26.9258, lng: 75.8237, kind: 'heritage', vibe: 20 },
      { name: 'Nahargarh Fort Sunset', lat: 26.9373, lng: 75.8155, kind: 'viewpoint', vibe: 50 },
      { name: 'Jal Mahal', lat: 26.9535, lng: 75.8462, kind: 'viewpoint', vibe: 15 },
      { name: 'Johari Bazaar', lat: 26.9200, lng: 75.8260, kind: 'market', vibe: 40 },
      { name: 'Jaipur International Airport', lat: 26.8242, lng: 75.8122, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Rishikesh', state: 'Uttarakhand', lat: 30.0869, lng: 78.2676, theme: 'spiritual',
    aliases: ['haridwar rishikesh'],
    places: [
      { name: 'Laxman Jhula', lat: 30.1266, lng: 78.3290, kind: 'heritage', vibe: 30 },
      { name: 'Triveni Ghat Aarti', lat: 30.1030, lng: 78.2978, kind: 'spiritual', vibe: 15 },
      { name: 'Shivpuri River Rafting', lat: 30.1454, lng: 78.3869, kind: 'adventure', vibe: 95 },
      { name: 'Neer Garh Waterfall', lat: 30.1332, lng: 78.3452, kind: 'nature', vibe: 60 },
      { name: 'Parmarth Niketan', lat: 30.1197, lng: 78.3140, kind: 'spiritual', vibe: 10 },
      { name: 'Beatles Ashram', lat: 30.1180, lng: 78.3170, kind: 'heritage', vibe: 30 },
      { name: 'Dehradun Jolly Grant Airport', lat: 30.1897, lng: 78.1803, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Nainital', state: 'Uttarakhand', lat: 29.3919, lng: 79.4542, theme: 'mountains',
    aliases: ['naini tal'],
    places: [
      { name: 'Naini Lake Boating', lat: 29.3920, lng: 79.4550, kind: 'lake', vibe: 25 },
      { name: 'Snow View Point', lat: 29.3942, lng: 79.4591, kind: 'viewpoint', vibe: 40 },
      { name: 'Tiffin Top', lat: 29.3782, lng: 79.4430, kind: 'trek', vibe: 60 },
      { name: 'Mall Road Nainital', lat: 29.3880, lng: 79.4600, kind: 'market', vibe: 30 },
      { name: 'Naina Devi Temple', lat: 29.3940, lng: 79.4530, kind: 'spiritual', vibe: 15 },
      { name: 'Kathgodam Railway Station', lat: 29.2667, lng: 79.5440, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Bhimtal', state: 'Uttarakhand', lat: 29.3470, lng: 79.5595, theme: 'mountains',
    aliases: [],
    places: [
      { name: 'Bhimtal Lake Kayaking', lat: 29.3460, lng: 79.5580, kind: 'adventure', vibe: 70 },
      { name: 'Bhimtal Island Aquarium', lat: 29.3475, lng: 79.5570, kind: 'family', vibe: 20 },
      { name: 'Sattal', lat: 29.3600, lng: 79.5250, kind: 'lake', vibe: 30 },
      { name: 'Naukuchiatal Paragliding', lat: 29.3290, lng: 79.5890, kind: 'adventure', vibe: 95 },
      { name: 'Butterfly Research Centre', lat: 29.3540, lng: 79.5430, kind: 'nature', vibe: 20 },
    ],
  },
  {
    name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125, theme: 'heritage',
    aliases: ['city of lakes'],
    places: [
      { name: 'City Palace Udaipur', lat: 24.5764, lng: 73.6835, kind: 'heritage', vibe: 20 },
      { name: 'Lake Pichola Sunset Boat', lat: 24.5720, lng: 73.6790, kind: 'lake', vibe: 20 },
      { name: 'Sajjangarh Monsoon Palace', lat: 24.5926, lng: 73.6392, kind: 'viewpoint', vibe: 40 },
      { name: 'Bagore ki Haveli Dance Show', lat: 24.5800, lng: 73.6830, kind: 'culture', vibe: 25 },
      { name: 'Ambrai Ghat', lat: 24.5770, lng: 73.6800, kind: 'food', vibe: 20 },
    ],
  },
  {
    name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739, theme: 'spiritual',
    aliases: ['banaras', 'kashi', 'benares'],
    places: [
      { name: 'Dashashwamedh Ghat Aarti', lat: 25.3070, lng: 83.0104, kind: 'spiritual', vibe: 25 },
      { name: 'Kashi Vishwanath Temple', lat: 25.3109, lng: 83.0107, kind: 'spiritual', vibe: 15 },
      { name: 'Sunrise Boat Ride', lat: 25.2893, lng: 83.0068, kind: 'lake', vibe: 20 },
      { name: 'Sarnath', lat: 25.3810, lng: 83.0240, kind: 'heritage', vibe: 15 },
      { name: 'Kachori Gali Food Walk', lat: 25.3100, lng: 83.0120, kind: 'food', vibe: 45 },
    ],
  },
  {
    name: 'Leh', state: 'Ladakh', lat: 34.1526, lng: 77.5771, theme: 'desert',
    aliases: ['ladakh', 'leh ladakh'],
    places: [
      { name: 'Shanti Stupa', lat: 34.1732, lng: 77.5773, kind: 'spiritual', vibe: 20 },
      { name: 'Leh Palace', lat: 34.1655, lng: 77.5847, kind: 'heritage', vibe: 30 },
      { name: 'Pangong Lake', lat: 33.7595, lng: 78.6674, kind: 'lake', vibe: 70 },
      { name: 'Khardung La', lat: 34.2787, lng: 77.6047, kind: 'adventure', vibe: 90 },
      { name: 'Nubra Valley Dunes', lat: 34.5500, lng: 77.5600, kind: 'nature', vibe: 75 },
    ],
  },
  {
    name: 'Pondicherry', state: 'Puducherry', lat: 11.9416, lng: 79.8083, theme: 'beach',
    aliases: ['puducherry', 'pondy'],
    places: [
      { name: 'Promenade Beach', lat: 11.9310, lng: 79.8356, kind: 'beach', vibe: 20 },
      { name: 'Auroville', lat: 12.0052, lng: 79.8069, kind: 'spiritual', vibe: 25 },
      { name: 'White Town Cafe Hop', lat: 11.9340, lng: 79.8340, kind: 'food', vibe: 30 },
      { name: 'Paradise Beach', lat: 11.8900, lng: 79.8240, kind: 'beach', vibe: 40 },
      { name: 'Scuba at Temple Reef', lat: 11.9500, lng: 79.8600, kind: 'adventure', vibe: 90 },
    ],
  },
  {
    name: 'Munnar', state: 'Kerala', lat: 10.0889, lng: 77.0595, theme: 'forest',
    aliases: [],
    places: [
      { name: 'Eravikulam National Park', lat: 10.1950, lng: 77.0860, kind: 'nature', vibe: 45 },
      { name: 'Mattupetty Dam', lat: 10.1060, lng: 77.1240, kind: 'lake', vibe: 25 },
      { name: 'Tea Museum', lat: 10.0960, lng: 77.0600, kind: 'culture', vibe: 15 },
      { name: 'Top Station', lat: 10.1250, lng: 77.2440, kind: 'viewpoint', vibe: 50 },
      { name: 'Lakkam Waterfalls', lat: 10.2300, lng: 77.0800, kind: 'nature', vibe: 55 },
    ],
  },
  {
    name: 'Alleppey', state: 'Kerala', lat: 9.4981, lng: 76.3388, theme: 'backwaters',
    aliases: ['alappuzha', 'kumarakom'],
    places: [
      { name: 'Houseboat Backwater Cruise', lat: 9.5000, lng: 76.3700, kind: 'lake', vibe: 15 },
      { name: 'Alappuzha Beach', lat: 9.4900, lng: 76.3170, kind: 'beach', vibe: 25 },
      { name: 'Kuttanad Village Canoe', lat: 9.4200, lng: 76.4200, kind: 'nature', vibe: 40 },
      { name: 'Marari Beach', lat: 9.6000, lng: 76.3000, kind: 'beach', vibe: 20 },
    ],
  },
  {
    name: 'Darjeeling', state: 'West Bengal', lat: 27.0410, lng: 88.2663, theme: 'mountains',
    aliases: [],
    places: [
      { name: 'Tiger Hill Sunrise', lat: 26.9980, lng: 88.2860, kind: 'viewpoint', vibe: 45 },
      { name: 'Batasia Loop', lat: 27.0120, lng: 88.2480, kind: 'viewpoint', vibe: 20 },
      { name: 'Toy Train Joyride', lat: 27.0360, lng: 88.2630, kind: 'heritage', vibe: 25 },
      { name: 'Happy Valley Tea Estate', lat: 27.0540, lng: 88.2610, kind: 'culture', vibe: 20 },
      { name: 'Peace Pagoda', lat: 27.0340, lng: 88.2550, kind: 'spiritual', vibe: 15 },
    ],
  },
  {
    name: 'Hampi', state: 'Karnataka', lat: 15.3350, lng: 76.4600, theme: 'heritage',
    aliases: [],
    places: [
      { name: 'Virupaksha Temple', lat: 15.3350, lng: 76.4590, kind: 'spiritual', vibe: 20 },
      { name: 'Vittala Temple Stone Chariot', lat: 15.3420, lng: 76.4740, kind: 'heritage', vibe: 30 },
      { name: 'Matanga Hill Sunrise', lat: 15.3370, lng: 76.4660, kind: 'trek', vibe: 60 },
      { name: 'Coracle Ride on Tungabhadra', lat: 15.3440, lng: 76.4700, kind: 'adventure', vibe: 55 },
      { name: 'Hippie Island Cafes', lat: 15.3450, lng: 76.4560, kind: 'food', vibe: 40 },
    ],
  },
  {
    name: 'Coorg', state: 'Karnataka', lat: 12.4244, lng: 75.7382, theme: 'forest',
    aliases: ['kodagu', 'madikeri'],
    places: [
      { name: 'Abbey Falls', lat: 12.4560, lng: 75.7200, kind: 'nature', vibe: 40 },
      { name: "Raja's Seat", lat: 12.4190, lng: 75.7360, kind: 'viewpoint', vibe: 15 },
      { name: 'Dubare Elephant Camp', lat: 12.3660, lng: 75.9040, kind: 'nature', vibe: 45 },
      { name: 'Namdroling Golden Temple', lat: 12.4290, lng: 75.9690, kind: 'spiritual', vibe: 15 },
      { name: 'Coffee Plantation Walk', lat: 12.4000, lng: 75.7600, kind: 'walk', vibe: 30 },
    ],
  },
  {
    name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081, theme: 'heritage',
    aliases: [],
    places: [
      { name: 'Taj Mahal Sunrise', lat: 27.1751, lng: 78.0421, kind: 'heritage', vibe: 20 },
      { name: 'Agra Fort', lat: 27.1795, lng: 78.0211, kind: 'heritage', vibe: 25 },
      { name: 'Mehtab Bagh', lat: 27.1800, lng: 78.0430, kind: 'viewpoint', vibe: 15 },
      { name: 'Fatehpur Sikri', lat: 27.0945, lng: 77.6679, kind: 'heritage', vibe: 30 },
    ],
  },
  {
    name: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, theme: 'city',
    aliases: ['new delhi', 'ncr'],
    places: [
      { name: 'India Gate', lat: 28.6129, lng: 77.2295, kind: 'heritage', vibe: 20 },
      { name: 'Red Fort', lat: 28.6562, lng: 77.2410, kind: 'heritage', vibe: 25 },
      { name: 'Qutub Minar', lat: 28.5245, lng: 77.1855, kind: 'heritage', vibe: 20 },
      { name: "Humayun's Tomb", lat: 28.5933, lng: 77.2507, kind: 'heritage', vibe: 15 },
      { name: 'Chandni Chowk Food Walk', lat: 28.6506, lng: 77.2303, kind: 'food', vibe: 55 },
      { name: 'Indira Gandhi International Airport', lat: 28.5562, lng: 77.1000, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, theme: 'city',
    aliases: ['bombay'],
    places: [
      { name: 'Gateway of India', lat: 18.9220, lng: 72.8347, kind: 'heritage', vibe: 20 },
      { name: 'Marine Drive', lat: 18.9440, lng: 72.8230, kind: 'walk', vibe: 20 },
      { name: 'Elephanta Caves', lat: 18.9633, lng: 72.9315, kind: 'heritage', vibe: 35 },
      { name: 'Colaba Causeway', lat: 18.9150, lng: 72.8250, kind: 'market', vibe: 35 },
      { name: 'Bandra Bandstand', lat: 19.0540, lng: 72.8200, kind: 'walk', vibe: 25 },
      { name: 'Chhatrapati Shivaji Maharaj Airport', lat: 19.0896, lng: 72.8656, kind: 'transport', vibe: 0 },
    ],
  },
  {
    name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734, theme: 'snow',
    aliases: [],
    places: [
      { name: 'The Ridge', lat: 31.1044, lng: 77.1734, kind: 'walk', vibe: 20 },
      { name: 'Mall Road Shimla', lat: 31.1040, lng: 77.1720, kind: 'market', vibe: 25 },
      { name: 'Jakhoo Temple', lat: 31.1010, lng: 77.1840, kind: 'spiritual', vibe: 35 },
      { name: 'Kufri', lat: 31.0980, lng: 77.2670, kind: 'adventure', vibe: 65 },
    ],
  },
  {
    name: 'Gokarna', state: 'Karnataka', lat: 14.5479, lng: 74.3188, theme: 'beach',
    aliases: [],
    places: [
      { name: 'Om Beach', lat: 14.5190, lng: 74.3240, kind: 'beach', vibe: 40 },
      { name: 'Kudle Beach', lat: 14.5300, lng: 74.3160, kind: 'beach', vibe: 30 },
      { name: 'Beach Trek to Paradise Beach', lat: 14.5000, lng: 74.3300, kind: 'trek', vibe: 75 },
      { name: 'Mahabaleshwar Temple', lat: 14.5430, lng: 74.3160, kind: 'spiritual', vibe: 15 },
    ],
  },
  {
    name: 'Jaisalmer', state: 'Rajasthan', lat: 26.9157, lng: 70.9083, theme: 'desert',
    aliases: ['golden city'],
    places: [
      { name: 'Jaisalmer Fort', lat: 26.9124, lng: 70.9126, kind: 'heritage', vibe: 30 },
      { name: 'Sam Sand Dunes Camp', lat: 26.8730, lng: 70.5540, kind: 'adventure', vibe: 75 },
      { name: 'Patwon ki Haveli', lat: 26.9150, lng: 70.9150, kind: 'heritage', vibe: 20 },
      { name: 'Gadisar Lake', lat: 26.9070, lng: 70.9200, kind: 'lake', vibe: 15 },
    ],
  },
  {
    name: 'McLeod Ganj', state: 'Himachal Pradesh', lat: 32.2426, lng: 76.3213, theme: 'mountains',
    aliases: ['mcleodganj', 'dharamshala', 'dharamsala'],
    places: [
      { name: 'Dalai Lama Temple', lat: 32.2330, lng: 76.3240, kind: 'spiritual', vibe: 15 },
      { name: 'Bhagsu Waterfall', lat: 32.2450, lng: 76.3330, kind: 'nature', vibe: 45 },
      { name: 'Triund Trek', lat: 32.2600, lng: 76.3530, kind: 'trek', vibe: 85 },
      { name: 'Tibetan Market', lat: 32.2410, lng: 76.3220, kind: 'market', vibe: 25 },
    ],
  },
  {
    name: 'Kasol', state: 'Himachal Pradesh', lat: 32.0100, lng: 77.3150, theme: 'forest',
    aliases: ['parvati valley'],
    places: [
      { name: 'Kheerganga Trek', lat: 31.9990, lng: 77.5100, kind: 'trek', vibe: 90 },
      { name: 'Tosh Village', lat: 32.0270, lng: 77.4520, kind: 'nature', vibe: 55 },
      { name: 'Manikaran Sahib', lat: 32.0270, lng: 77.3480, kind: 'spiritual', vibe: 20 },
      { name: 'Chalal Riverside Walk', lat: 32.0080, lng: 77.3250, kind: 'walk', vibe: 30 },
    ],
  },
  {
    name: 'Shillong', state: 'Meghalaya', lat: 25.5788, lng: 91.8933, theme: 'forest',
    aliases: ['meghalaya', 'cherrapunji', 'sohra'],
    places: [
      { name: 'Umiam Lake', lat: 25.6620, lng: 91.8900, kind: 'lake', vibe: 30 },
      { name: 'Elephant Falls', lat: 25.5400, lng: 91.8200, kind: 'nature', vibe: 35 },
      { name: 'Double Decker Root Bridge', lat: 25.2530, lng: 91.6750, kind: 'trek', vibe: 85 },
      { name: 'Dawki Crystal River', lat: 25.1850, lng: 92.0200, kind: 'lake', vibe: 50 },
      { name: 'Police Bazaar', lat: 25.5760, lng: 91.8820, kind: 'market', vibe: 30 },
    ],
  },
  {
    name: 'Andaman', state: 'Andaman & Nicobar', lat: 11.6234, lng: 92.7265, theme: 'beach',
    aliases: ['port blair', 'havelock', 'swaraj dweep', 'andaman islands'],
    places: [
      { name: 'Cellular Jail Light Show', lat: 11.6740, lng: 92.7480, kind: 'heritage', vibe: 20 },
      { name: 'Radhanagar Beach', lat: 11.9840, lng: 92.9510, kind: 'beach', vibe: 30 },
      { name: 'Scuba at Havelock', lat: 12.0300, lng: 92.9860, kind: 'adventure', vibe: 95 },
      { name: 'Ross Island', lat: 11.6760, lng: 92.7630, kind: 'heritage', vibe: 25 },
    ],
  },
  {
    name: 'Spiti', state: 'Himachal Pradesh', lat: 32.2276, lng: 78.0710, theme: 'desert',
    aliases: ['kaza', 'spiti valley'],
    places: [
      { name: 'Key Monastery', lat: 32.2970, lng: 78.0120, kind: 'spiritual', vibe: 25 },
      { name: 'Chandratal Lake', lat: 32.4750, lng: 77.6170, kind: 'lake', vibe: 80 },
      { name: 'Kibber Village', lat: 32.3300, lng: 78.0080, kind: 'nature', vibe: 55 },
      { name: 'Langza Fossil Village', lat: 32.2690, lng: 78.0750, kind: 'culture', vibe: 45 },
    ],
  },
  {
    name: 'Ooty', state: 'Tamil Nadu', lat: 11.4102, lng: 76.6950, theme: 'forest',
    aliases: ['udhagamandalam', 'nilgiris'],
    places: [
      { name: 'Government Botanical Garden', lat: 11.4180, lng: 76.7110, kind: 'nature', vibe: 15 },
      { name: 'Ooty Lake', lat: 11.4060, lng: 76.6940, kind: 'lake', vibe: 20 },
      { name: 'Doddabetta Peak', lat: 11.4020, lng: 76.7360, kind: 'viewpoint', vibe: 40 },
      { name: 'Nilgiri Mountain Railway', lat: 11.4040, lng: 76.6980, kind: 'heritage', vibe: 25 },
    ],
  },
  {
    name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, theme: 'city',
    aliases: ['bangalore', 'blr'],
    places: [
      { name: 'Cubbon Park', lat: 12.9763, lng: 77.5929, kind: 'nature', vibe: 15 },
      { name: 'Lalbagh Botanical Garden', lat: 12.9507, lng: 77.5848, kind: 'nature', vibe: 15 },
      { name: 'Church Street', lat: 12.9750, lng: 77.6050, kind: 'food', vibe: 40 },
      { name: 'Kempegowda International Airport', lat: 13.1986, lng: 77.7066, kind: 'transport', vibe: 0 },
    ],
  },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function findDestination(query) {
  const nq = norm(query);
  if (!nq) return null;
  for (const d of DESTINATIONS) {
    if (norm(d.name) === nq || d.aliases.some((a) => norm(a) === nq)) return d;
  }
  for (const d of DESTINATIONS) {
    const names = [d.name, ...d.aliases].map(norm);
    if (names.some((n) => nq.includes(n) || n.includes(nq))) return d;
  }
  return null;
}

/** Search destinations and attractions by name. */
export function searchPlaces(query, { near, limit = 10 } = {}) {
  const nq = norm(query);
  const results = [];
  for (const d of DESTINATIONS) {
    const destMatch = !nq || [d.name, ...d.aliases].some((n) => norm(n).includes(nq));
    if (destMatch) results.push({ name: d.name, subtitle: d.state, lat: d.lat, lng: d.lng, kind: 'destination', destination: d.name, score: 3 });
    for (const p of d.places) {
      const hit = !nq || norm(p.name).includes(nq) || (destMatch && nq.length > 2);
      if (hit) results.push({ name: p.name, subtitle: `${d.name}, ${d.state}`, lat: p.lat, lng: p.lng, kind: p.kind, destination: d.name, score: norm(p.name).startsWith(nq) ? 2 : 1 });
    }
  }
  const nearDest = near ? findDestination(near) : null;
  if (nearDest) for (const r of results) if (r.destination === nearDest.name) r.score += 5;
  return results.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score, ...r }) => r);
}

/** Resolve a free-text place (e.g. "Bhimtal", "Naini Lake Boating") to coordinates. */
export function geocode(text, near) {
  const nt = norm(text);
  if (!nt) return null;
  const dest = findDestination(text);
  if (dest && (norm(dest.name) === nt || dest.aliases.some((a) => norm(a) === nt))) {
    return { name: dest.name, lat: dest.lat, lng: dest.lng };
  }
  const nearDest = near ? findDestination(near) : null;
  const pool = nearDest ? [nearDest, ...DESTINATIONS.filter((d) => d !== nearDest)] : DESTINATIONS;
  for (const d of pool) {
    for (const p of d.places) {
      const np = norm(p.name);
      if (np === nt || np.includes(nt) || (nt.length > 4 && nt.includes(np))) return { name: p.name, lat: p.lat, lng: p.lng };
    }
  }
  if (dest) return { name: dest.name, lat: dest.lat, lng: dest.lng };
  return null;
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function themeFor(destination) {
  return findDestination(destination)?.theme || 'mountains';
}
