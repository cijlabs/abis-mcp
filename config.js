require('dotenv').config();

module.exports = {
  ABIS_API_URL: process.env.ABIS_API_URL || 'https://abis-drift-monitor-production-b484.up.railway.app',
  ABIS_ADMIN_KEY: process.env.ABIS_ADMIN_KEY,
};
