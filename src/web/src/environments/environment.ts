/**
 * Development environment configuration
 * @version 1.0.0
 * @description Configuration settings for local development environment
 */
export const environment = {
  // Environment type flag
  production: false,

  // API endpoints
  apiUrl: 'http://localhost:3000/api/v1',
  wsUrl: 'ws://localhost:3000/ws',

  // Authentication configuration
  auth: {
    domain: 'saas-platform-dev.auth0.com',
    clientId: '${AUTH0_CLIENT_ID}',
    audience: 'http://localhost:3000/api',
    redirectUri: 'http://localhost:4200/callback',
    scope: 'openid profile email'
  },

  // AI service configuration
  ai: {
    modelEndpoint: 'http://localhost:3000/ai',
    maxTokens: 1000,
    temperature: 0.7,
    streamingEnabled: true,
    contextWindow: 4096
  },

  // Third-party integrations
  integrations: {
    // Google Workspace integration settings
    googleWorkspace: {
      clientId: '${GOOGLE_CLIENT_ID}',
      apiKey: '${GOOGLE_API_KEY}',
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.reports.usage.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly'
      ],
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest',
        'https://www.googleapis.com/discovery/v1/apis/admin/reports_v1/rest'
      ]
    },

    // Stripe payment integration settings
    stripe: {
      publicKey: '${STRIPE_PUBLIC_KEY}',
      apiVersion: '2023-10-16',
      webhookSecret: '${STRIPE_WEBHOOK_SECRET}',
      paymentMethods: ['card', 'sepa_debit'],
      billingPortalEnabled: true
    },

    // QuickBooks integration settings
    quickbooks: {
      clientId: '${QUICKBOOKS_CLIENT_ID}',
      scope: 'com.intuit.quickbooks.accounting',
      environment: 'sandbox',
      redirectUri: 'http://localhost:4200/quickbooks/callback',
      minorVersion: '65'
    }
  },

  // Feature flags
  features: {
    aiAssistant: true,
    usageAnalytics: true,
    costOptimization: true,
    realTimeAlerts: true
  }
};