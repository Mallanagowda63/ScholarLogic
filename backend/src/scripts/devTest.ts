// `npm run dev:test`: backend on a throwaway in-memory database pre-loaded with dummy test data.
// Nothing touches the MONGODB_URI database; data disappears when the process stops.
process.env.USE_MEMORY_DB = 'true';
process.env.SEED_TEST_DATA = 'true';

// Imported after the env is set so config/env picks it up
import('../server');
