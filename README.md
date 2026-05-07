#  Smart Ordering System for Restaurants


A real-time, QR-based ordering system for restaurants, built with Next.js and Supabase. This application provides a seamless experience for both customers and staff, from browsing the menu to processing payments.

## Features

### Customer Interface (`/table/[id]`)
- **QR Code Entry**: Customers scan a QR code to access the menu for their specific table.
- **Interactive Menu**: Browse a categorized menu, view item descriptions, and see prices.
- **Shopping Cart**: Add/remove items and view the running total.
- **Real-time Order Tracking**: Customers see live status updates as their order is processed (`Pending` → `Accepted` → `Preparing` → `Ready`).
- **Integrated Payments**:
    - **UPI**: Generate a dynamic QR code and a one-click deep link to pay via any UPI app.
    - **Cash**: Option to notify staff for cash payment.
- **Feedback System**: Leave a star rating and feedback after a successful order.
- **Session Recovery**: Your cart and order status are saved in your browser, so you can close the page and come back without losing your progress.

### Staff Dashboard (`/dashboard`)
- **Secure Authentication**: Staff can log in securely using Google OAuth.
- **Role-Based Access**: The system supports roles like `admin`, `manager`, `waiter`, and `kitchen` with differing permissions enforced by Supabase RLS.
- **Live Order Management**: A real-time dashboard displays all active orders. Staff receive instant notifications (with sound) for new orders.
- **Order Lifecycle Control**: Staff can securely transition orders through various states:
    - `Accept` or `Reject` new orders.
    - Mark as `Preparing`.
    - Mark as `Ready`.
    - `Generate Bill` for the customer.
    - `Confirm Payment` for both UPI and Cash transactions.
- **Payment History**: A dedicated tab to view all completed and paid orders, sortable by date, table, or amount.
- **Reporting & Exports**: Generate and download weekly sales reports as a CSV file, including a category-wise breakdown of revenue and item quantities.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Backend / Database**: [Supabase](https://supabase.com/)
    - **Auth**: Handled via Supabase Auth with Google OAuth provider.
    - **Database**: Postgres for data storage.
    - **Realtime**: Supabase Realtime for instant UI updates.
    - **RPC Functions**: Postgres functions for secure, server-side state transitions.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI/Animation**: [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) for icons.
- **Language**: TypeScript
- **Testing**: [Jest](https://jestjs.io/) & [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Architecture Overview

This system is designed with a clear separation of concerns and robust security.

1.  **State Machine**: The order lifecycle is managed by a strict, server-enforced state machine. State transitions are defined in `lib/types.ts` and executed via secure Supabase RPC functions (e.g., `accept_order_staff`, `confirm_payment_staff`). This prevents invalid operations, such as a customer marking their own order as 'paid'.

2.  **Security**:
    - **Row Level Security (RLS)** is enabled on the `orders` and `staff_roles` tables in Supabase, ensuring users can only access the data they are permitted to see.
    - Staff actions are routed through a dedicated API endpoint (`/api/staff/orders/[id]/transition`) which verifies user authentication and role before calling the appropriate database RPC function. This provides a secure barrier between the client and the database.

3.  **Real-time Synchronization**:
    - Supabase Realtime Channels are used to push live updates to both the customer and staff UIs.
    - For added resilience, the customer client also employs a periodic polling mechanism as a fallback, ensuring status updates are received even if the realtime connection is temporarily interrupted.

## Local Setup and Installation

Follow these steps to get the project running on your local machine.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yeswant369/ordering-system-for-restaurants.git
    cd ordering-system-for-restaurants
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set up Supabase**
    - Create a new project on [Supabase](https://supabase.com/).
    - Navigate to the **SQL Editor** in your Supabase project dashboard.
    - Copy the contents of the migration files (`supabase_migration_v2.sql`, `supabase_migration_v3.sql`, etc.) and run them in the editor. Execute them in order to set up the necessary tables, roles, RLS policies, and RPC functions.

4.  **Configure Environment Variables**
    - In your Supabase project, go to **Project Settings** > **API**.
    - Create a `.env.local` file in the root of your project by copying the example:
      ```bash
      cp .env.example .env.local
      ```
    - Add your Supabase URL and `anon` key to the `.env.local` file:
      ```env
      NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
      NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
      ```
    - For staff actions to work, you also need the `service_role` key. Find this in your Supabase API settings ("Project API keys") and add it to `.env.local`:
      ```env
      SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
      ```

5.  **Configure Google OAuth**
    - In your Supabase dashboard, go to **Authentication** > **Providers** and enable the **Google** provider.
    - Follow the instructions to get your Google Client ID and Secret and add them to the Supabase configuration.
    - Ensure your Site URL is set correctly in Supabase Auth settings (e.g., `http://localhost:3000`).

6.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    - Open [http://localhost:3000](http://localhost:3000) to see the home page.
    - Access the customer menu at `http://localhost:3000/table/1`.
    - Access the staff dashboard at `http://localhost:3000/dashboard`.

## Running Tests

To run the full suite of unit and integration tests, use the following command:

```bash
npm test
