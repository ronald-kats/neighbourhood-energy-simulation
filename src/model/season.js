/**
 * Season enum with utility to derive from month number.
 * Months: 1=Jan, 12=Dec.
 * Winter: Dec(12), Jan(1), Feb(2)
 * Spring: Mar(3), Apr(4), May(5)
 * Summer: Jun(6), Jul(7), Aug(8)
 * Autumn: Sep(9), Oct(10), Nov(11)
 */
export const Season = Object.freeze({
  WINTER: 'WINTER',
  SPRING: 'SPRING',
  SUMMER: 'SUMMER',
  AUTUMN: 'AUTUMN',

  /** Derive season from a month number (1-12). */
  fromMonth(month) {
    if (month === 12 || month === 1 || month === 2) return Season.WINTER;
    if (month >= 3 && month <= 5) return Season.SPRING;
    if (month >= 6 && month <= 8) return Season.SUMMER;
    return Season.AUTUMN;
  },
});
