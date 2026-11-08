# NKEM GLOBAL SUPERCENTER

A luxury multi-category e-commerce and retail platform featuring real-time Supabase cloud synchronization, interactive customer live chat, admin dashboard with product and order management, dynamic receipts, and high-performance search and filtering.

## Features
- **Public Storefront (`index.html`)**: Product catalog, multi-category browsing, real-time search, cart management, instant checkout, and customer order tracking.
- **Admin Management Console (`admin.html`)**: Secure administrative suite for banners, product inventory, order tracking, real-time customer live chat monitoring, registered user management, and security settings.
- **Customer Live Chat (`chat.html`)**: Two-way real-time customer support chat powered by Supabase Realtime channels.
- **Cloud Database & Storage Integration**: Supabase authentication, cloud sync, automated failover to localStorage, and resilient order management.
- **Receipt Generator**: Automated printable and downloadable customer order receipts.

## Tech Stack
- HTML5 / Modern CSS (Vanilla Luxury Obsidian & Gold Theme)
- Modern Vanilla JavaScript (Modular ES6 architecture)
- Supabase (PostgreSQL Database, Realtime Subscriptions & Storage)

## Setup & Running Locally
Simply open `index.html` in your browser, or run the local development server:
```bash
start_server.bat
```
or
```bash
python -m http.server 8080
```
Then navigate to:
- Storefront: `http://localhost:8080/index.html`
- Admin Console: `http://localhost:8080/admin.html`
- Live Chat: `http://localhost:8080/chat.html`
