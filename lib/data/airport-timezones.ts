/**
 * Static ICAO → IANA timezone map for US airports.
 * Covers all major hubs and common E170/E175 regional destinations.
 *
 * Key correctness notes:
 * - All Indiana airports use America/New_York (Eastern since April 2006)
 * - Arizona airports use America/Phoenix (UTC-7, no DST)
 * - Boise ID airports use America/Boise (separate IANA zone from America/Denver)
 * - Florida panhandle airports west of Apalachicola River use America/Chicago
 * - Alaska hubs use America/Anchorage; Nome uses America/Nome
 * - Hawaii uses Pacific/Honolulu (no DST)
 */
const AIRPORT_TIMEZONES: Record<string, string> = {
  // ── Eastern Time (America/New_York) ───────────────────────────────────────
  KATL: 'America/New_York',   // Atlanta Hartsfield-Jackson
  KJFK: 'America/New_York',   // New York JFK
  KLGA: 'America/New_York',   // New York LaGuardia
  KEWR: 'America/New_York',   // Newark Liberty
  KBOS: 'America/New_York',   // Boston Logan
  KPHL: 'America/New_York',   // Philadelphia
  KIAD: 'America/New_York',   // Washington Dulles
  KDCA: 'America/New_York',   // Washington Reagan National
  KDTW: 'America/New_York',   // Detroit Metro
  KMCO: 'America/New_York',   // Orlando International
  KFLL: 'America/New_York',   // Fort Lauderdale-Hollywood
  KTPA: 'America/New_York',   // Tampa International
  KMIA: 'America/New_York',   // Miami International
  KRDU: 'America/New_York',   // Raleigh-Durham
  KPIT: 'America/New_York',   // Pittsburgh International
  KCMH: 'America/New_York',   // Columbus John Glenn
  KIND: 'America/New_York',   // Indianapolis International (Indiana = Eastern)
  KCLE: 'America/New_York',   // Cleveland Hopkins
  KBUF: 'America/New_York',   // Buffalo Niagara
  KCVG: 'America/New_York',   // Cincinnati/Northern Kentucky (Hebron KY = Eastern)
  KCLT: 'America/New_York',   // Charlotte Douglas
  KALB: 'America/New_York',   // Albany International
  KSYR: 'America/New_York',   // Syracuse Hancock
  KROC: 'America/New_York',   // Rochester Greater
  KMDT: 'America/New_York',   // Harrisburg International (Middletown PA)
  KORF: 'America/New_York',   // Norfolk International
  KRIC: 'America/New_York',   // Richmond International
  KBDL: 'America/New_York',   // Hartford Bradley
  KPWM: 'America/New_York',   // Portland Jetport (Maine)
  KBTV: 'America/New_York',   // Burlington International (Vermont)
  KACK: 'America/New_York',   // Nantucket Memorial
  KMHT: 'America/New_York',   // Manchester-Boston Regional (NH)
  KPVD: 'America/New_York',   // Providence T.F. Green
  KABE: 'America/New_York',   // Lehigh Valley International (Allentown PA)
  KORH: 'America/New_York',   // Worcester Regional (MA)
  KBGR: 'America/New_York',   // Bangor International (Maine)
  KMVY: 'America/New_York',   // Martha's Vineyard
  KHYA: 'America/New_York',   // Hyannis / Barnstable Municipal
  KELM: 'America/New_York',   // Elmira/Corning Regional (NY)
  KIAG: 'America/New_York',   // Niagara Falls International (NY)
  KITH: 'America/New_York',   // Ithaca Tompkins Regional (NY)
  KBGM: 'America/New_York',   // Greater Binghamton (NY)
  KGRR: 'America/New_York',   // Grand Rapids Gerald R. Ford (MI — Eastern)
  KLAN: 'America/New_York',   // Lansing Capital Region (MI — Eastern)
  KFNT: 'America/New_York',   // Flint Bishop (MI — Eastern)
  KSBN: 'America/New_York',   // South Bend International (IN — Indiana is Eastern)
  KJAX: 'America/New_York',   // Jacksonville International (FL)
  KTYS: 'America/New_York',   // Knoxville McGhee Tyson (TN — Eastern portion)
  KCHA: 'America/New_York',   // Chattanooga Lovell Field (TN — Eastern)
  KAVL: 'America/New_York',   // Asheville Regional (NC)
  KGSO: 'America/New_York',   // Piedmont Triad / Greensboro (NC)
  KSAV: 'America/New_York',   // Savannah/Hilton Head (GA)
  KCAE: 'America/New_York',   // Columbia Metropolitan (SC)
  KCHS: 'America/New_York',   // Charleston International (SC)
  KMYR: 'America/New_York',   // Myrtle Beach International (SC)
  KILM: 'America/New_York',   // Wilmington International (NC)
  KHPN: 'America/New_York',   // Westchester County (White Plains NY)
  KPHF: 'America/New_York',   // Newport News/Williamsburg (VA)
  KEWB: 'America/New_York',   // New Bedford Regional (MA)
  KPBG: 'America/New_York',   // Plattsburgh International (NY)
  KPSM: 'America/New_York',   // Portsmouth/Pease (NH)
  KTLH: 'America/New_York',   // Tallahassee International (FL — Eastern)
  KGNV: 'America/New_York',   // Gainesville Regional (FL)
  KRSW: 'America/New_York',   // Southwest Florida International (Fort Myers)
  KPBI: 'America/New_York',   // Palm Beach International
  KSFB: 'America/New_York',   // Sanford International (FL)
  KAPF: 'America/New_York',   // Naples Municipal (FL)
  KUCA: 'America/New_York',   // Oneida County (Utica NY)

  // ── Central Time (America/Chicago) ────────────────────────────────────────
  KORD: 'America/Chicago',    // Chicago O'Hare
  KMDW: 'America/Chicago',    // Chicago Midway
  KDFW: 'America/Chicago',    // Dallas/Fort Worth
  KDAL: 'America/Chicago',    // Dallas Love Field
  KIAH: 'America/Chicago',    // Houston George Bush Intercontinental
  KHOU: 'America/Chicago',    // Houston William P. Hobby
  KMSP: 'America/Chicago',    // Minneapolis-Saint Paul
  KSTL: 'America/Chicago',    // St. Louis Lambert
  KMKE: 'America/Chicago',    // Milwaukee Mitchell
  KDSM: 'America/Chicago',    // Des Moines International
  KOMA: 'America/Chicago',    // Omaha Eppley Airfield
  KMLI: 'America/Chicago',    // Quad Cities (Moline IL)
  KCID: 'America/Chicago',    // Cedar Rapids Eastern Iowa
  KFAR: 'America/Chicago',    // Fargo Hector (ND)
  KGRB: 'America/Chicago',    // Green Bay Austin Straubel (WI)
  KMSN: 'America/Chicago',    // Madison Dane County (WI)
  KSHV: 'America/Chicago',    // Shreveport Regional (LA)
  KMEM: 'America/Chicago',    // Memphis International (TN — western TN is Central)
  KBNA: 'America/Chicago',    // Nashville International (TN — Central)
  KLIT: 'America/Chicago',    // Little Rock Clinton National (AR)
  KTUL: 'America/Chicago',    // Tulsa International (OK)
  KOKC: 'America/Chicago',    // Oklahoma City Will Rogers (OK)
  KSAT: 'America/Chicago',    // San Antonio International (TX)
  KAUS: 'America/Chicago',    // Austin-Bergstrom (TX)
  KMAF: 'America/Chicago',    // Midland International (TX)
  KABI: 'America/Chicago',    // Abilene Regional (TX)
  KAMA: 'America/Chicago',    // Rick Husband Amarillo (TX)
  KLBB: 'America/Chicago',    // Lubbock Preston Smith (TX)
  KCLL: 'America/Chicago',    // College Station Easterwood (TX)
  KTYR: 'America/Chicago',    // Tyler Pounds Regional (TX)
  KBPT: 'America/Chicago',    // Jack Brooks (Beaumont/Port Arthur TX)
  KLCH: 'America/Chicago',    // Lake Charles Regional (LA)
  KBTR: 'America/Chicago',    // Baton Rouge Metropolitan (LA)
  KMSY: 'America/Chicago',    // New Orleans Louis Armstrong
  KJAN: 'America/Chicago',    // Jackson-Medgar Wiley Evers (MS)
  KGPT: 'America/Chicago',    // Gulfport-Biloxi International (MS)
  KHSV: 'America/Chicago',    // Huntsville International (AL)
  KBHM: 'America/Chicago',    // Birmingham-Shuttlesworth (AL)
  KMOB: 'America/Chicago',    // Mobile Regional (AL)
  KICT: 'America/Chicago',    // Wichita Dwight D. Eisenhower (KS)
  KMCI: 'America/Chicago',    // Kansas City International (MO)
  KSGF: 'America/Chicago',    // Springfield-Branson (MO)
  KBIS: 'America/Chicago',    // Bismarck Municipal (ND)
  KGFK: 'America/Chicago',    // Grand Forks International (ND)
  KFSD: 'America/Chicago',    // Sioux Falls Joe Foss (SD — Central)
  KISN: 'America/Chicago',    // Williston Basin (ND)
  KPNS: 'America/Chicago',    // Pensacola International (FL panhandle — Central)
  KVPS: 'America/Chicago',    // Destin-Fort Walton Beach (FL panhandle — Central)
  KECP: 'America/Chicago',    // NW Florida Beaches (Panama City Beach — Central)
  KPFN: 'America/Chicago',    // Panama City Bay County (FL panhandle — Central)
  KRAP: 'America/Chicago',    // Rapid City Regional (SD — Central; border area but Central)
  KSPS: 'America/Chicago',    // Sheppard AFB / Wichita Falls (TX)
  KTOP: 'America/Chicago',    // Topeka Philip Billard (KS)

  // ── Mountain Time (America/Denver) ────────────────────────────────────────
  KDEN: 'America/Denver',     // Denver International
  KSLC: 'America/Denver',     // Salt Lake City International
  KABQ: 'America/Denver',     // Albuquerque Sunport
  KSAF: 'America/Denver',     // Santa Fe Municipal
  KROW: 'America/Denver',     // Roswell International Air Center
  KCOS: 'America/Denver',     // Colorado Springs Municipal
  KGJT: 'America/Denver',     // Grand Junction Walker Field (CO)
  KBIL: 'America/Denver',     // Billings Logan (MT)
  KGTF: 'America/Denver',     // Great Falls International (MT)
  KBZN: 'America/Denver',     // Bozeman Yellowstone (MT)
  KMSO: 'America/Denver',     // Missoula Montana
  KJAC: 'America/Denver',     // Jackson Hole (WY)
  KHDN: 'America/Denver',     // Yampa Valley / Hayden (CO)
  KCPR: 'America/Denver',     // Casper Natrona County (WY)
  KRKS: 'America/Denver',     // Southwest Wyoming (Rock Springs)
  KLND: 'America/Denver',     // Hunt Field (Lander WY)
  KELP: 'America/Denver',     // El Paso International (TX — Mountain)
  KEGE: 'America/Denver',     // Eagle County (Vail CO)
  KASE: 'America/Denver',     // Aspen/Pitkin County (CO)
  KGUC: 'America/Denver',     // Gunnison-Crested Butte (CO)
  KPUB: 'America/Denver',     // Pueblo Memorial (CO)
  KDRO: 'America/Denver',     // Durango-La Plata County (CO)

  // ── Arizona (America/Phoenix — UTC-7, NO daylight saving time) ────────────
  KPHX: 'America/Phoenix',    // Phoenix Sky Harbor
  KTUS: 'America/Phoenix',    // Tucson International
  KFLG: 'America/Phoenix',    // Flagstaff Pulliam
  KPRC: 'America/Phoenix',    // Prescott Love Field
  KIWA: 'America/Phoenix',    // Phoenix Mesa Gateway
  KSOW: 'America/Phoenix',    // Show Low Regional (AZ)
  KGCN: 'America/Phoenix',    // Grand Canyon National Park (AZ)
  KYUM: 'America/Phoenix',    // Yuma International (AZ)

  // ── Idaho / Boise (America/Boise — Mountain with DST) ─────────────────────
  KBOI: 'America/Boise',      // Boise Airport
  KTWF: 'America/Boise',      // Magic Valley (Twin Falls ID)
  KIDA: 'America/Boise',      // Idaho Falls Regional
  KPIH: 'America/Boise',      // Pocatello Regional
  KSUN: 'America/Boise',      // Friedman Memorial (Sun Valley / Hailey ID)

  // ── Pacific Time (America/Los_Angeles) ────────────────────────────────────
  KLAX: 'America/Los_Angeles', // Los Angeles International
  KSFO: 'America/Los_Angeles', // San Francisco International
  KSEA: 'America/Los_Angeles', // Seattle-Tacoma International
  KPDX: 'America/Los_Angeles', // Portland International (OR)
  KLAS: 'America/Los_Angeles', // Harry Reid International (Las Vegas)
  KOAK: 'America/Los_Angeles', // Oakland Metropolitan
  KSJC: 'America/Los_Angeles', // San Jose Mineta
  KSNA: 'America/Los_Angeles', // John Wayne (Orange County CA)
  KBUR: 'America/Los_Angeles', // Hollywood Burbank
  KLGB: 'America/Los_Angeles', // Long Beach
  KSAN: 'America/Los_Angeles', // San Diego International
  KSMF: 'America/Los_Angeles', // Sacramento International
  KFAT: 'America/Los_Angeles', // Fresno Yosemite
  KBFL: 'America/Los_Angeles', // Meadows Field (Bakersfield CA)
  KSBP: 'America/Los_Angeles', // San Luis Obispo County
  KSMX: 'America/Los_Angeles', // Santa Maria Public
  KACV: 'America/Los_Angeles', // California Redwood Coast (Arcata/Eureka)
  KRDD: 'America/Los_Angeles', // Redding Municipal (CA)
  KMRY: 'America/Los_Angeles', // Monterey Regional
  KMOD: 'America/Los_Angeles', // Modesto City-County (CA)
  KSTS: 'America/Los_Angeles', // Charles M. Schulz (Santa Rosa CA)
  KEUG: 'America/Los_Angeles', // Eugene Airport (OR)
  KMFR: 'America/Los_Angeles', // Rogue Valley (Medford OR)
  KRDM: 'America/Los_Angeles', // Roberts Field (Redmond OR)
  KPSC: 'America/Los_Angeles', // Tri-Cities (Pasco WA)
  KYKM: 'America/Los_Angeles', // Yakima Air Terminal (WA)
  KBLI: 'America/Los_Angeles', // Bellingham International (WA)
  KPAE: 'America/Los_Angeles', // Paine Field (Everett WA)
  KGEG: 'America/Los_Angeles', // Spokane International
  KRNO: 'America/Los_Angeles', // Reno-Tahoe International (NV)
  KELN: 'America/Los_Angeles', // Pangborn Memorial (Wenatchee WA)
  KONP: 'America/Los_Angeles', // Newport Municipal (OR)
  KOTH: 'America/Los_Angeles', // Southwest Oregon Regional (Coos Bay)
  KALW: 'America/Los_Angeles', // Walla Walla Regional (WA)
  KSFF: 'America/Los_Angeles', // Spokane Felts Field (WA)

  // ── Alaska (America/Anchorage / America/Nome) ──────────────────────────────
  PANC: 'America/Anchorage',  // Ted Stevens Anchorage International
  PAFA: 'America/Anchorage',  // Fairbanks International
  PAJN: 'America/Anchorage',  // Juneau International
  PAKN: 'America/Anchorage',  // King Salmon (AK)
  PADQ: 'America/Anchorage',  // Kodiak (AK)
  PABT: 'America/Anchorage',  // Bettles (AK)
  PABE: 'America/Anchorage',  // Bethel (AK)
  PAOM: 'America/Nome',       // Nome (western AK — America/Nome)
  PAOT: 'America/Nome',       // Ralph Wien Memorial (Kotzebue AK)
  PADL: 'America/Anchorage',  // Dillingham (AK)
  PADU: 'America/Nome',       // Unalaska (Dutch Harbor AK — Aleutians West = Nome tz)

  // ── Hawaii (Pacific/Honolulu — UTC-10, no DST) ────────────────────────────
  PHNL: 'Pacific/Honolulu',   // Daniel K. Inouye (Honolulu)
  PHOG: 'Pacific/Honolulu',   // Kahului (Maui)
  PHKO: 'Pacific/Honolulu',   // Ellison Onizuka Kona
  PHLI: 'Pacific/Honolulu',   // Lihue (Kauai)
  PHMK: 'Pacific/Honolulu',   // Molokai
  PHNY: 'Pacific/Honolulu',   // Lanai
}

/**
 * Returns the IANA timezone string for the given ICAO airport code.
 * Handles both 4-letter ICAO (KDFW) and 3-letter IATA (DFW) codes.
 * Returns null if the airport is not in the map.
 */
export function getAirportTimezone(icao: string): string | null {
  if (!icao) return null
  const upper = icao.trim().toUpperCase()
  if (AIRPORT_TIMEZONES[upper]) return AIRPORT_TIMEZONES[upper]
  // Fallback: try K-prefix for 3-letter IATA codes (contiguous US convention)
  if (upper.length === 3) {
    const withK = `K${upper}`
    if (AIRPORT_TIMEZONES[withK]) return AIRPORT_TIMEZONES[withK]
  }
  return null
}
