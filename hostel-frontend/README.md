# Hostel Management System Frontend

A modern, responsive frontend for the Hostel Management System built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎨 Modern and responsive UI with Tailwind CSS
- 📊 Interactive charts and statistics
- 🔐 Secure authentication
- 📱 Mobile-friendly design
- 📈 Real-time data updates
- 🎯 Type-safe with TypeScript

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- Backend server running on http://localhost:5051

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd hostel-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory and add the following:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5051
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
hostel-frontend/
├── components/         # Reusable components
├── context/           # React context providers
├── pages/             # Next.js pages
├── public/            # Static assets
├── styles/            # Global styles
└── types/             # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Features

### Dashboard
- Overview of hostel statistics
- Income vs Expenses chart
- Fee collection status
- Recent activities

### Students Management
- Add/Edit/Delete students
- Upload student photos
- View student details
- Track fee status

### Room Management
- View room occupancy
- Room allocation
- Room status tracking

### Expense Management
- Record expenses
- View expense history
- Generate expense reports
- Track monthly expenses

### Fee Collection
- Record fee payments
- Track payment status
- Generate payment receipts
- View payment history

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
