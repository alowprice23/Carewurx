/**
 * Distance Calculator Utility
 * Provides functions for calculating distances between geographic coordinates
 */

class DistanceCalculator {
  /**
   * Calculate the distance between two points using the Haversine formula
   * @param {number} lat1 - Latitude of the first point
   * @param {number} lon1 - Longitude of the first point
   * @param {number} lat2 - Latitude of the second point
   * @param {number} lon2 - Longitude of the second point
   * @returns {number} The distance in miles
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    if ((lat1 === lat2) && (lon1 === lon2)) {
      return 0;
    }
    
    const radLat1 = Math.PI * lat1 / 180;
    const radLat2 = Math.PI * lat2 / 180;
    const theta = lon1 - lon2;
    const radTheta = Math.PI * theta / 180;
    
    let dist = Math.sin(radLat1) * Math.sin(radLat2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);
    
    if (dist > 1) {
      dist = 1;
    }
    
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515; // Distance in miles
    
    return dist;
  }
}

module.exports = DistanceCalculator;
