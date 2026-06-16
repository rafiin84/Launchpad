/**
 * Creates a Portfolio custom module in Zoho CRM with all relevant fields.
 *
 * SETUP:
 * 1. Go to https://api-console.zoho.com/
 * 2. Click "Add Client" → choose "Self Client"
 * 3. Under "Generate Code", enter these scopes:
 *    ZohoCRM.modules.ALL,ZohoCRM.settings.modules.ALL,ZohoCRM.settings.fields.ALL
 * 4. Set Time Duration to 10 minutes, click Create
 * 5. Copy the generated code
 * 6. Run this in your terminal to get a refresh token:
 *
 *    curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
 *      -d "code=YOUR_CODE" \
 *      -d "client_id=YOUR_CLIENT_ID" \
 *      -d "client_secret=YOUR_CLIENT_SECRET" \
 *      -d "redirect_uri=https://www.zohoapis.com" \
 *      -d "grant_type=authorization_code"
 *
 * 7. Fill in CONFIG below and run: node scripts/create-zoho-portfolio-module.js
 */

const https = require('https');

// ─── Fill these in ──────────────────────────────────────────────────────────
const CONFIG = {
  client_id:     'YOUR_CLIENT_ID',
  client_secret: 'YOUR_CLIENT_SECRET',
  refresh_token: 'YOUR_REFRESH_TOKEN',
  // Data center: 'com' (US) | 'eu' | 'in' | 'au' | 'jp'
  data_center:   'com',
};
// ────────────────────────────────────────────────────────────────────────────

function request(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getAccessToken() {
  const url = `https://accounts.zoho.${CONFIG.data_center}/oauth/v2/token` +
    `?refresh_token=${CONFIG.refresh_token}` +
    `&client_id=${CONFIG.client_id}` +
    `&client_secret=${CONFIG.client_secret}` +
    `&grant_type=refresh_token`;

  const res = await request('POST', url, null, {});
  if (!res.body.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

async function createModule(token) {
  const url = `https://www.zohoapis.${CONFIG.data_center}/crm/v2/settings/modules`;
  const body = {
    modules: [{
      module_name: 'Portfolio',
      api_name:    'Portfolio',
      singular_label: 'Portfolio',
      plural_label:   'Portfolio',
      description: 'Tracks investment portfolio companies and performance metrics',
    }],
  };
  const res = await request('POST', url, body, {
    Authorization: `Zoho-oauthtoken ${token}`,
  });
  return res;
}

async function createFields(token) {
  const url = `https://www.zohoapis.${CONFIG.data_center}/crm/v2/settings/fields?module=Portfolio`;

  const fields = [
    {
      field_label: 'Company Name',
      api_name: 'Company_Name',
      data_type: 'text',
      length: 255,
    },
    {
      field_label: 'Industry',
      api_name: 'Industry',
      data_type: 'picklist',
      pick_list_values: [
        'FinTech', 'HealthTech', 'SaaS', 'EdTech',
        'CleanTech', 'AI / ML', 'E-Commerce', 'Other',
      ].map(v => ({ display_value: v, actual_value: v })),
    },
    {
      field_label: 'Company Stage',
      api_name: 'Company_Stage',
      data_type: 'picklist',
      pick_list_values: [
        'Pre-Seed', 'Seed', 'Series A', 'Series B',
        'Series C', 'Growth', 'Pre-IPO',
      ].map(v => ({ display_value: v, actual_value: v })),
    },
    {
      field_label: 'Investment Amount',
      api_name: 'Investment_Amount',
      data_type: 'currency',
    },
    {
      field_label: 'Current Valuation',
      api_name: 'Current_Valuation',
      data_type: 'currency',
    },
    {
      field_label: 'MOIC',
      api_name: 'MOIC',
      data_type: 'decimal',
    },
    {
      field_label: 'Ownership Percentage',
      api_name: 'Ownership_Percentage',
      data_type: 'decimal',
    },
    {
      field_label: 'Investment Date',
      api_name: 'Investment_Date',
      data_type: 'date',
    },
    {
      field_label: 'Exit Date',
      api_name: 'Exit_Date',
      data_type: 'date',
    },
    {
      field_label: 'Status',
      api_name: 'Status',
      data_type: 'picklist',
      pick_list_values: [
        'Active', 'Exited', 'Written Off', 'Follow-On',
      ].map(v => ({ display_value: v, actual_value: v })),
    },
    {
      field_label: 'Website',
      api_name: 'Website',
      data_type: 'website',
    },
    {
      field_label: 'Location',
      api_name: 'Location',
      data_type: 'text',
      length: 255,
    },
    {
      field_label: 'Notes',
      api_name: 'Notes',
      data_type: 'textarea',
    },
  ];

  const res = await request('POST', url, { fields }, {
    Authorization: `Zoho-oauthtoken ${token}`,
  });
  return res;
}

async function main() {
  console.log('\n🚀 Creating Portfolio module in Zoho CRM...\n');

  if (CONFIG.client_id === 'YOUR_CLIENT_ID') {
    console.error('❌ Please fill in your CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN in CONFIG at the top of this file.');
    process.exit(1);
  }

  try {
    console.log('1️⃣  Getting access token...');
    const token = await getAccessToken();
    console.log('   ✅ Authenticated\n');

    console.log('2️⃣  Creating Portfolio module...');
    const moduleRes = await createModule(token);
    if (moduleRes.status === 201 || moduleRes.body?.modules?.[0]?.status === 'success') {
      console.log('   ✅ Module created\n');
    } else {
      console.log('   ⚠️  Module response:', JSON.stringify(moduleRes.body, null, 2));
      console.log('   (If the module already exists, this is fine — continuing to add fields)\n');
    }

    console.log('3️⃣  Adding custom fields...');
    const fieldsRes = await createFields(token);
    if (fieldsRes.status === 201) {
      console.log('   ✅ All fields created\n');
    } else {
      console.log('   ⚠️  Fields response:', JSON.stringify(fieldsRes.body, null, 2), '\n');
    }

    console.log('🎉 Done! Open Zoho CRM → Modules → Portfolio to see your new module.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
