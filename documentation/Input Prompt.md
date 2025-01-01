## WHY - Vision & Purpose

### Purpose & Users

- What does our application do?

  - Our application simplifies SaaS management for small to medium-sized businesses (SMBs) by providing tools to:

    - Identify and track all software subscriptions in one place

    - Optimize software usage and costs

    - Gain actionable insights for decision-making

- Who will use it?

  - It is designed for IT managers, operations teams, and finance professionals in startups and SMBs seeking better visibility and control over their SaaS expenses and usage.

- Why will they use it instead of alternatives?

  - Users will prefer our product because it offers an the best view into the shadow (and not shadow) IT portfolio, along with actionable insights.

## WHAT - Core Requirements

### Functional Requirements

System must:

- Maintain a centralized, interactive dashboard for tracking all SaaS subscriptions and categorizing by department, cost and usage.

- Provide backend support to ensure accurate data synchronization and integration. Automatically retrieve subscription details via integrations with payment providers, accounting systems, and email parsing.

- Incorporate AI-driven capabilities that  cross-reference metadata with verified provider databases to ensure data accuracy;

- Allow users to assign ownership of subscriptions to specific teams or individuals.

- Monitor all available usage and spend data to identify underutilized or redundant subscriptions.

- Provide notifications for upcoming renewals or subscription expirations, whether known from license data or estimated from spend data.

- Generate cost analytics and usage reports to inform budgeting and optimization efforts.

- Integrate directly with specific SaaS applications to pull in deeper usage insights (and make it easy to add additional similar integrations in the future).

- Ensure data security and compliance with industry regulations.

- Leverage AI to  analyze contract terms and usage trends to offer actionable insights related to cost savings and application optimization based on historical and real-time data.

- Provide a conversational AI that can answer any question or provide any insight the user may have.

## HOW - Planning & Implementation

### Technical Implementation

**Required Stack Components**

- Frontend: Web application using Angular with a responsive design for desktop and mobile access.

- Backend: Cloud-based server using Node.js handling data processing, integrations, and analytics

- Integrations: Complete and ready-to-use integrations for SaaS Discovery and SaaS Usage Insights (start with Google Workspace as first integration, but make it easy to add more integrations later)

- Infrastructure: Cloud infrastructure with robust security measures and scalable resources (AWS).

**Integration Details**

- **SaaS Discovery**

  - Necessary integrations:

    - Payment platforms (e.g., Stripe, PayPal)

    - Accounting systems (e.g., QuickBooks, Xero)

    - Email services (e.g., Google Workspace, Microsoft 365)

  - Purpose: Retrieve relevant data and  identify SaaS subscriptions by analyzing transactions and email receipts, either based on rules or using the AI-powered discovery capabilities described in the AI Functionality section below.

  - Configuration: Users will initiate integrations through a guided setup wizard within the application. This wizard will allow users to securely connect their accounts for each platform, granting the necessary permissions for data access. Clear instructions and real-time validation will ensure successful integration.

- **SaaS Usage Insights**

  - First integration: Google Workspace

    - Retrieve data on user  activity, app usage frequency, and associated costs.

    - Provide detailed analytics on active vs. inactive users.

  - Extendability: Build architecture to easily add integrations for other SaaS applications (e.g., Slack, Zoom).

**AI Functionality**

- **AI-Powered Discovery and Mapping**

  - Help  uncover the entire SaaS stack, including shadow IT, by leveraging AI to analyze payment data, accounting systems, and email logs as retrieved from the Shadow IT Discovery integration outlined above.

  - Provide actionable insights and customizable workflows for managing discovered applications.

  - Use AI to automatically identify SaaS applications and fill in relevant details, reducing manual effort in creating the SaaS System of Record.

- **AI Contract Ingestion**

  - Automatically parse SaaS contracts and their line items, eliminating manual data entry. These parsed details, such as subscription name, renewal date, cost per user, and included features, are seamlessly integrated into actionable insights within dashboards and reports. Users can view aggregated data for cost tracking and identify optimization opportunities directly from the system. These contracts can be 1) uploaded as a PDF, 2) found in email during shadow IT discovery, or 3) retrieved from an enabled SaaS Usage Insights integration.

  - Example: Extract details such as subscription name, renewal date, cost per user, and included features. This data will be integrated into the system for streamlined cost tracking and renewal management.

  - Seamlessly integrate contract details into the system for cost tracking and management.

- **AI Assistant**

  - Allow users to query SaaS-related questions via a conversational AI interface, such as a Slack bot.

  - Provide instant insights about users, contracts, and licenses to facilitate quicker, data-driven decisions.

  - The AI assistant should have access to and consult relevant data found during shadow IT discover and other available sources when engaging in conversations and making recommendations.

- **Intelligent App Recommendations**

  - Suggest optimizations for existing SaaS applications based on usage patterns, department needs, and compliance factors.

  - Recommend tools aligned with specific business needs and user preferences.

  - Compare current SaaS usage and costs against industry standards.

  - Offer future recommendations based on historical trends and AI predictions to optimize spend.

- **Unified Spend Intelligence**

  - Provide a holistic view of all SaaS-related expenses with AI-generated analytics.

  - Identify missing vendor and contract details early and send reminders to ensure timely renewals.

**System Requirements**

- Performance needs: Handle up to 50,000 SaaS subscriptions with real-time updates.

- Security requirements: Encrypt data in transit and at rest; implement role-based access controls.

- Scalability expectations: Support SMBs scaling their operations and increasing SaaS adoption.

- Reliability targets: 99.9% uptime with real-time data backups.

- Integration constraints: Maintain compatibility with the latest API versions of integrated services.

- Open to recommendation as well

### User Experience

**Key User Flows**

1. Subscription Tracking

   - Entry Point: User logs into the dashboard and connects payment accounts, accounting systems, or emails.

   - Accuracy Measures: The system employs AI algorithms and cross-references transaction metadata with verified SaaS provider databases to ensure the imported data is accurate and up-to-date.

   - Key Steps/Interactions: System imports and categorizes SaaS subscriptions; users review and confirm data.

   - Success Criteria: All subscriptions are accurately listed and categorized.

   - Alternative Flows: User manually adds or edits subscription details if necessary.

2. Usage Monitoring

   - Entry Point: User views the usage dashboard.

   - Key Steps/Interactions: System displays usage trends and highlights underutilized tools.

   - Success Criteria: Users identify subscriptions to optimize or cancel.

   - Alternative Flows: User sets custom usage thresholds for notifications.

3. Renewal Notifications

   - Entry Point: System sends automated notifications about upcoming renewals.

   - Key Steps/Interactions: Users review renewal details and decide to renew, cancel, or renegotiate terms.

   - Success Criteria: Timely actions are taken to optimize subscription costs.

   - Alternative Flows: Users set custom notification schedules.

4. AI-Powered Insights

   - Entry Point: User queries AI assistant for SaaS-related information.

   - Key Steps/Interactions: AI retrieves and displays actionable insights, such as usage trends, cost optimization suggestions, or renewal reminders.

   - Success Criteria: Users make informed decisions faster with minimal manual effort.

   - Alternative Flows: Users configure AI assistant responses to align with specific workflows.

**Core Interfaces**

- Dashboard: Provides an overview of subscription inventory, costs, and usage metrics.

- Subscription Manager: Allows users to edit details, assign ownership, and monitor renewal dates.

- Usage Analytics: Displays insights on usage trends, underutilized tools, cost-saving opportunities, and upcoming  renewals.

- Reports Module: Generates and exports SaaS spend and usage reports.

- AI Assistant Interface: Enables conversational queries and real-time insights for users.

### Business Requirements

**Access & Authentication**

- User types: Admins and Managers

- Authentication requirements: Secure login with multi-factor authentication (MFA).

- Access control needs: Role-based permissions to ensure users only access appropriate data and features.

**Business Rules**

- Data validation rules: Ensure all required fields (e.g., subscription name, cost) are completed before submission.

- Process requirements: Subscriptions cannot be archived without proper justification.

- Compliance needs: Adhere to GDPR, CCPA, SOC 2 and other relevant data protection and compliance regulations.

- Service level expectations: Notifications sent within 5 minutes of triggering an event (e.g., renewal alert).

### Implementation Priorities

- High Priority: SaaS discovery and subsequent subscription tracking, renewal notifications, AI-powered insights, and usage analytics.

- Medium Priority: Additional reporting features, intelligent app recommendations, and ease of adding new SaaS application integrations.

- Lower Priority: Advanced analytics, customizable dashboards, and multi-currency support.