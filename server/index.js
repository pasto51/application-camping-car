'use strict';

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const { server, db } = createApp();

server.listen(port, () => {
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
