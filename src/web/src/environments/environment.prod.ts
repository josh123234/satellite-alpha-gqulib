/**
 * Production environment configuration for SaaS Management Platform
 * Version: 1.0.0
 * Region: US-East-1
 * 
 * This file contains secure production settings for:
 * - API endpoints
 * - WebSocket connections
 * - Authentication configuration
 * - AI service settings
 * - Third-party integrations
 */

export const environment = {
  production: true,
  
  // Core API Configuration
  apiUrl: 'https://api.saas-platform.com/api/v1',
  wsUrl: 'wss://api.saas-platform.com',
  
  // Auth0 Authentication Configuration
  auth: {
    domain: 'saas-platform.auth0.com',
    clientId: '${AUTH0_CLIENT_ID}',
    audience: 'https://api.saas-platform.com/api',
    redirectUri: 'https://app.saas-platform.com/callback',
    scope: 'openid profile email',
    responseType: 'code',
    prompt: 'select_account'
  },
  
  // AI Service Configuration
  ai: {
    modelEndpoint: 'https://api.saas-platform.com/ai',
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    presencePenalty: 0.6,
    frequencyPenalty: 0.5,
    timeout: 30000
  },
  
  // Third-Party Integration Configuration
  integrations: {
    // Google Workspace Integration
    googleWorkspace: {
      clientId: '${GOOGLE_CLIENT_ID}',
      apiKey: '${GOOGLE_API_KEY}',
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.reports.usage.readonly'
      ],
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest',
        'https://www.googleapis.com/discovery/v1/apis/admin/reports_v1/rest'
      ]
    },
    
    // Stripe Payment Integration
    stripe: {
      publicKey: '${STRIPE_PUBLIC_KEY}',
      apiVersion: '2023-10-16',
      locale: 'en',
      betas: [],
      timeout: 30000
    },
    
    // QuickBooks Integration
    quickbooks: {
      clientId: '${QUICKBOOKS_CLIENT_ID}',
      scope: 'com.intuit.quickbooks.accounting',
      environment: 'production',
      redirectUri: 'https://app.saas-platform.com/integrations/quickbooks/callback',
      timeout: 20000
    }
  }
};