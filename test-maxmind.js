// Test MaxMind geolocation for specific IPs
const path = require('path');

async function testMaxMind() {
  try {
    // Import MaxMind library
    const maxmind = require('@maxmind/geoip2-node');
    
    const dbPath = '/tmp/nauth_maxmind/GeoLite2-City.mmdb';
    console.log('Loading MaxMind database:', dbPath);
    
    const reader = await maxmind.Reader.open(dbPath);
    
    // Test IPs from logs
    const testIps = [
      '103.1.213.215',  // Sydney
      '116.90.72.249',  // Adelaide
      '77.111.247.160', // Norway
      '8.8.8.8',        // Google DNS (for comparison)
    ];
    
    for (const ip of testIps) {
      console.log(`\n========== Testing IP: ${ip} ==========`);
      try {
        const result = reader.city(ip);
        console.log('Country:', result.country?.isoCode, result.country?.names?.en);
        console.log('City:', result.city?.names?.en);
        console.log('Location:', {
          latitude: result.location?.latitude,
          longitude: result.location?.longitude,
          timeZone: result.location?.timeZone,
        });
        console.log('Postal:', result.postal?.code);
      } catch (error) {
        console.error('Lookup failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nMake sure @maxmind/geoip2-node is installed:');
    console.error('  yarn add @maxmind/geoip2-node');
  }
}

testMaxMind();


