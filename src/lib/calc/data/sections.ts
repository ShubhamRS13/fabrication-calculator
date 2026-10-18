// Starter section tables. Values are common published figures
// (ASME B36.10/B36.19 pipe, IS 808 rolled sections) and should be checked
// against supplier data; the user can edit and add sizes in Settings.

/** Pipe outside diameter (mm) by nominal bore (mm). */
export const PIPE_OD: Record<number, number> = {
  15: 21.3, 20: 26.7, 25: 33.4, 32: 42.2, 40: 48.3, 50: 60.3, 65: 73.0,
  80: 88.9, 100: 114.3, 125: 141.3, 150: 168.3, 200: 219.1, 250: 273.0, 300: 323.8,
};

/** Wall thickness (mm) by schedule, then nominal bore. */
export const PIPE_WALL: Record<string, Record<number, number>> = {
  "5S": { 15: 1.65, 20: 1.65, 25: 1.65, 32: 1.65, 40: 1.65, 50: 1.65, 65: 2.11, 80: 2.11, 100: 2.11, 125: 2.77, 150: 2.77, 200: 2.77, 250: 3.4, 300: 3.96 },
  "10S": { 15: 2.11, 20: 2.11, 25: 2.77, 32: 2.77, 40: 2.77, 50: 2.77, 65: 3.05, 80: 3.05, 100: 3.05, 125: 3.4, 150: 3.4, 200: 3.76, 250: 4.19, 300: 4.57 },
  "40": { 15: 2.77, 20: 2.87, 25: 3.38, 32: 3.56, 40: 3.68, 50: 3.91, 65: 5.16, 80: 5.49, 100: 6.02, 125: 6.55, 150: 7.11, 200: 8.18, 250: 9.27, 300: 10.31 },
  "80": { 15: 3.73, 20: 3.91, 25: 4.55, 32: 4.85, 40: 5.08, 50: 5.54, 65: 7.01, 80: 7.62, 100: 8.56, 125: 9.53, 150: 10.97, 200: 12.7, 250: 15.09, 300: 17.48 },
};

/** IS 1239 (Part 1) steel tubes: OD (mm) by NB. */
export const IS1239_OD: Record<number, number> = {
  15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3, 50: 60.3, 65: 76.1,
  80: 88.9, 100: 114.3, 125: 139.7, 150: 165.1,
};

/** IS 1239 wall thickness (mm): Light (A), Medium (B), Heavy (C). */
export const IS1239_WALL: Record<string, Record<number, number>> = {
  L: { 15: 2.0, 20: 2.35, 25: 2.65, 32: 2.65, 40: 2.9, 50: 2.9, 65: 3.25, 80: 3.25, 100: 3.65 },
  M: { 15: 2.6, 20: 2.6, 25: 3.2, 32: 3.2, 40: 3.2, 50: 3.6, 65: 3.6, 80: 4.0, 100: 4.5, 125: 4.85, 150: 4.85 },
  H: { 15: 3.2, 20: 3.2, 25: 4.0, 32: 4.0, 40: 4.0, 50: 4.5, 65: 4.5, 80: 4.85, 100: 5.4, 125: 5.4, 150: 5.4 },
};

/** Standard wire gauge → thickness (mm). */
export const SWG: Record<number, number> = {
  6: 4.877, 7: 4.47, 8: 4.064, 9: 3.658, 10: 3.251, 11: 2.946, 12: 2.642,
  13: 2.337, 14: 2.032, 16: 1.626, 18: 1.219, 20: 0.914, 22: 0.711, 24: 0.559,
};

/**
 * Rolled sections (IS 808), kg/m for MS (7.85 g/cc); scaled by density for other
 * materials. Values are the common published figures — check against supplier
 * data. ISHB sizes with two weights are listed as "size (kg/m)".
 */
export const STRUCTURAL: Record<string, Record<string, number>> = {
  ISA: {
    // equal
    "25x25x3": 1.1, "25x25x5": 1.8, "30x30x3": 1.4, "35x35x5": 2.6, "40x40x5": 3.0,
    "40x40x6": 3.5, "45x45x5": 3.4, "50x50x5": 3.8, "50x50x6": 4.5, "65x65x6": 5.8,
    "75x75x6": 6.8, "75x75x8": 8.9, "90x90x8": 10.8, "100x100x8": 12.1, "100x100x10": 14.9,
    // unequal
    "30x20x3": 1.1, "40x25x3": 1.5, "40x25x5": 2.4, "45x30x5": 2.8, "50x30x5": 3.0,
    "60x40x5": 3.7, "60x40x6": 4.4, "65x45x6": 4.9, "70x45x6": 5.2, "75x50x6": 5.6,
    "75x50x8": 7.4, "80x50x6": 5.9, "90x60x6": 6.8, "90x60x8": 8.9, "100x65x8": 10.1,
    "100x75x8": 10.6, "125x75x8": 12.2, "125x75x10": 15.0, "150x75x10": 16.9, "150x115x10": 20.1,
  },
  ISMC: {
    "75": 6.8, "100": 9.2, "125": 12.7, "150": 16.4, "175": 19.1, "200": 22.1,
    "225": 25.9, "250": 30.4, "300": 35.8, "350": 42.1, "400": 49.4,
  },
  ISLC: {
    "75": 5.7, "100": 7.9, "125": 10.7, "150": 14.4, "175": 17.6, "200": 20.6,
    "225": 24.0, "250": 28.0, "300": 33.1, "350": 38.8, "400": 45.7,
  },
  ISJC: { "100": 5.8, "125": 7.9, "150": 9.9, "175": 11.2, "200": 13.9 },
  ISMB: {
    "100": 11.5, "125": 13.0, "150": 14.9, "175": 19.3, "200": 25.4, "225": 31.2,
    "250": 37.3, "300": 44.2, "350": 52.4, "400": 61.6, "450": 72.4, "500": 86.9, "600": 122.6,
  },
  ISLB: {
    "75": 6.1, "100": 8.0, "125": 11.9, "150": 14.2, "175": 16.7, "200": 19.8, "225": 23.5,
    "250": 27.9, "275": 33.0, "300": 37.7, "325": 43.1, "350": 49.5, "400": 56.9,
    "450": 65.3, "500": 75.0, "550": 86.3, "600": 99.5,
  },
  ISJB: { "150": 7.1, "175": 8.1, "200": 9.9, "225": 12.8 },
  ISWB: {
    "150": 17.0, "175": 22.1, "200": 28.8, "225": 33.9, "250": 40.9, "300": 48.1,
    "350": 56.9, "400": 66.7, "450": 79.4, "500": 95.2, "550": 112.5, "600": 133.7,
  },
  ISHB: {
    "150 (27.1)": 27.1, "150 (30.6)": 30.6, "150 (34.6)": 34.6, "200 (37.3)": 37.3, "200 (40.0)": 40.0,
    "225 (43.1)": 43.1, "225 (46.8)": 46.8, "250 (51.0)": 51.0, "250 (54.7)": 54.7,
    "300 (58.8)": 58.8, "300 (63.0)": 63.0, "350 (67.4)": 67.4, "350 (72.4)": 72.4,
    "400 (77.4)": 77.4, "400 (82.2)": 82.2, "450 (87.2)": 87.2, "450 (92.5)": 92.5,
  },
};

/** Which picker type each series belongs to, and its long name. */
export const SERIES_INFO: Record<string, { group: "angle" | "channel" | "beam" | "hbeam"; name: string }> = {
  ISA: { group: "angle", name: "ISA – angle (equal & unequal)" },
  ISMC: { group: "channel", name: "ISMC – medium weight channel" },
  ISLC: { group: "channel", name: "ISLC – light weight channel" },
  ISJC: { group: "channel", name: "ISJC – junior channel" },
  ISMB: { group: "beam", name: "ISMB – medium weight beam" },
  ISLB: { group: "beam", name: "ISLB – light weight beam" },
  ISJB: { group: "beam", name: "ISJB – junior beam" },
  ISWB: { group: "beam", name: "ISWB – wide flange beam" },
  ISHB: { group: "hbeam", name: "ISHB – H beam" },
};

export const MS_DENSITY = 7.85;
