# Blockchain-Based Online Voting System

A secure electronic voting system that leverages blockchain technology to ensure vote integrity, anonymity, and transparency.

## Project Overview

This system provides a complete solution for conducting secure online elections with the following features:

- Secure authentication using CNIC (National ID) verification
- Blockchain-based vote storage for immutability and transparency
- Voter anonymity through cryptographic techniques (ring signatures and mixnets)
- Real-time election results with verifiable counting
- Admin dashboard for managing elections, candidates, and voters
- Responsive design for both desktop and mobile users

## Technologies Used

### Backend
- Node.js & Express
- PostgreSQL database
- Custom blockchain implementation with Proof-of-Authority consensus
- Cryptographic libraries for digital signatures and encryption

### Frontend
- React with Bootstrap
- React Router for navigation
- Context API for state management
- Axios for API communication

## Installation

### Prerequisites
- Node.js (v14.0.0+)
- npm (v6.0.0+)
- PostgreSQL (v12.0+)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/online-voting-system.git
   cd online-voting-system
   ```

2. **Server Setup**
   ```bash
   cd server
   npm install
   
   # Configure environment variables  -optional-
   cp .env.example .env
   # Edit .env file with your database credentials
   
   # Initialize the database
   node setup-database.js
   
   # Start the server
   npm run dev
   ```

3. **Client Setup**
   ```bash
   cd ../client
   npm install
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Demo Accounts

### Admin Access
- CNIC: 1234567890123
- Email: zainiqbal7007@gmail.com
- Password: Adminadmin@1

## Usage Guide

### Admin Functions
- Create and manage elections
- Register voters
- Add candidates to elections
- Monitor voting progress
- View election results

### Voter Functions
- Register and login with CNIC and email verification
- View upcoming, active, and completed elections
- Cast secure votes in active elections
- Verify vote was recorded correctly
- View election results

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or inquiries, please contact:  zainiqbal7007@gmail.com