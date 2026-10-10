'use strict';

const { createApp } = require('./app');
const { startJobs } = require('./jobs');
const { startCampaigns } = require('./campaigns');

// Hosts such as alwaysdata give the address to listen on through environment variables.
const port = Number(process.env.PORT || process.env.ALWAYSDATA_HTTPD_PORT) || 3000;
const host = process.env.IP || process.env.ALWAYSDATA_HTTPD_IP || undefined;
const app = createApp();
const { server, db } = app;
// Daily: backup of the database, maintenance reminders, alert on requests without answer.
startJobs(app);
// Every minute: the notifications programmed for that time.
startCampaigns(app);

server.listen(port, host, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
  console.log(`  Application client : http://localhost:${port}/app/`);
  console.log(`  Back-office        : http://localhost:${port}/admin/`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
