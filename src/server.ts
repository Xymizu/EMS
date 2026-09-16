import { createApp } from './app.js';
import { parseHttpPort, parseJwtConfig } from './config/jwt.js';

const jwtConfig = parseJwtConfig();
const port = parseHttpPort();
const app = createApp({ jwtConfig });

app.listen(port, () => {
  console.log(`EMS API listening on port ${port}`);
});
