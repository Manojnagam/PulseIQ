const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://127.0.0.1:5000/api';

async function verifyManagerFeatures() {
  try {
    // 0. Check if server is running
    console.log('Checking if server is running...');
    try {
      await axios.get(`${API_URL}/health`, { timeout: 3000 });
      console.log('✓ Server is running\n');
    } catch (healthError) {
      // Handle AggregateError (axios wraps connection errors)
      const errorCode = healthError.code || (healthError.errors && healthError.errors[0]?.code);
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || healthError.message?.includes('connect')) {
        console.error('\n❌ Server is not running!');
        console.error('   Please start the server first with: npm run server');
        process.exit(1);
      }
      throw healthError;
    }

    // 1. Get Manager Token
    if (!fs.existsSync('ids.json')) {
      console.error('ids.json not found. Run get_ids.js first.');
      return;
    }
    const ids = JSON.parse(fs.readFileSync('ids.json', 'utf8'));
    // We need a manager token. The ids.json might have a coach token.
    // Let's assume we can login as the test manager.
    
    // Login as Manager
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      mobile: '7981614593',
      password: 'Manoj_212',
      role: 'manager'
    });
    const token = loginRes.data.token;
    console.log('Manager logged in successfully.');

    // 2. Verify Team Stats (Leaderboard)
    console.log('\n--- Verifying Team Stats (Leaderboard) ---');
    const teamStatsRes = await axios.get(`${API_URL}/manager/team-stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Team Stats Count:', teamStatsRes.data.length);
    if (teamStatsRes.data.length > 0) {
      const firstCoach = teamStatsRes.data[0];
      console.log('Sample Coach Stats:', {
        name: firstCoach.name,
        volume: firstCoach.volume,
        recruits: firstCoach.recruits,
        growth: firstCoach.growth
      });
    } else {
      console.log('No coaches found in team stats.');
    }

    // 3. Verify Financials (Profile)
    console.log('\n--- Verifying Financials ---');
    const profileRes = await axios.get(`${API_URL}/manager/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const financials = profileRes.data.financials;
    console.log('Financials:', financials);

    if (financials && financials.totalEarnings !== undefined) {
      console.log('Financials data present.');
    } else {
      console.error('Financials data missing.');
    }

  } catch (error) {
    // Handle AggregateError (axios wraps connection errors in AggregateError)
    const errorCode = error.code || (error.errors && error.errors[0]?.code);
    const errorMessage = error.message || (error.errors && error.errors[0]?.message) || '';
    
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      console.error('\n❌ Connection Error: Could not connect to the server.');
      console.error('   Make sure the server is running on http://127.0.0.1:5000');
      console.error('   Start the server with: npm run server');
    } else if (error.response) {
      console.error(`\n❌ API Error: ${error.response.status} - ${error.response.statusText}`);
      console.error('   Response:', error.response.data);
    } else {
      console.error('\n❌ Verification failed:', errorMessage);
      if (error.errors && error.errors.length > 0) {
        console.error('   Nested errors:', error.errors.map(e => e.message || e.code).join(', '));
      }
    }
    
    const errorLog = {
        message: errorMessage,
        code: errorCode,
        errors: error.errors ? error.errors.map(e => ({ message: e.message, code: e.code })) : undefined,
        response: error.response ? {
            status: error.response.status,
            data: error.response.data
        } : 'No response',
        stack: error.stack
    };
    fs.writeFileSync('error.log', JSON.stringify(errorLog, null, 2));
    process.exit(1);
  }
}

verifyManagerFeatures();
