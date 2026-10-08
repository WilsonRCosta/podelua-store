const config = require('./src/config');
const app = require('./src/app');

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`\n🌙 Pó de Lua listening on http://localhost:${config.port}`);
    if (!config.airtable.baseId || !config.airtable.token) {
      console.log('   ⚠️  Airtable not configured.');
    }
    if (!config.gmail.user || !config.gmail.appPassword) {
      console.log('   ⚠️  Gmail not configured — order emails will fail.');
    }
  });
}

module.exports = app;
