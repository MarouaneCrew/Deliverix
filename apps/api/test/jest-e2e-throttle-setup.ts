import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

// This file needs to test the REAL limits, so override the inflated
// test-wide values back down to production-realistic numbers.
process.env.LOGIN_THROTTLE_LIMIT = '5';
process.env.FORGOT_PASSWORD_THROTTLE_LIMIT = '5';
process.env.THROTTLE_GLOBAL_LIMIT = '20';