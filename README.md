# Blockchain-Based Online Voting System

<div align="center">
  <img src="client/public/logo512.png" alt="Online Voting System Logo" width="150" />
  <h3>Secure • Transparent • Anonymous</h3>
</div>

A secure electronic voting system leveraging blockchain technology and advanced cryptography to ensure vote integrity, anonymity, and transparency for modern elections.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%3E%3D12.0-blue)](https://www.postgresql.org/)

---

## 🔍 Project Overview

This comprehensive system provides a complete solution for conducting secure online elections with the following key features:

- **Secure Authentication** - Robust verification using CNIC (National ID)
- **Blockchain-Based Storage** - Immutable vote records ensuring transparency and auditability
- **Advanced Voter Privacy** - Cryptographic anonymity through ring signatures and mixnets
- **Real-Time Results** - Live election monitoring with verifiable counting methods
- **Administrative Controls** - Comprehensive dashboard for managing all aspects of elections
- **Responsive Design** - Optimized experience across desktop and mobile devices

## 🛠️ Technology Stack

### Backend Architecture
- **Node.js & Express** - Fast, unopinionated web framework
- **PostgreSQL** - Enterprise-grade relational database
- **Custom Blockchain** - Proprietary implementation with Proof-of-Authority consensus
- **Cryptographic Security** - Advanced digital signatures and encryption systems

### Frontend Experience
- **React** - Modern UI library with Bootstrap styling
- **React Router** - Seamless navigation between components
- **Context API** - Efficient state management
- **Axios** - Promise-based HTTP client for API communication

## ⚙️ Prerequisites

Before installation, ensure your system meets the following requirements:

### Required Software
- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher)
- **PostgreSQL** (v12.0 or higher)

### Recommended Development Tools
- Git version control
- A code editor (VS Code recommended)
- PostgreSQL administration tool (e.g., pgAdmin)

## 📦 Installation

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/MuhammadZainIqbal/Online_Voting_System.git
   cd Online_Voting_System
   ```

2. **Server Setup**
   ```bash
   cd server
   npm install
   
   # Configure environment variables (optional)
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

4. **Access the application** by opening your browser and navigating to `http://localhost:3000`

## 🔑 Demo Accounts

### Admin Access
- **CNIC:** 1234567890123
- **Email:** zainiqbal7007@gmail.com
- **Password:** Adminadmin@1

## 📋 Usage Guide

### Admin Capabilities
- Create and manage election cycles
- Register and validate voters
- Add and manage candidates in elections
- Monitor voting progress in real-time
- Generate and view comprehensive election results

### Voter Features
- Register and authenticate with CNIC and email verification
- Browse upcoming, active, and completed elections
- Cast secure, anonymous votes in active elections
- Verify personal vote was recorded correctly
- View certified election results

## 🔐 Security Features

- **Blockchain Immutability** - Prevents tampering with cast votes
- **Ring Signatures** - Ensures voter anonymity while maintaining verifiability
- **Mixnet Technology** - Breaks the connection between voters and their votes
- **Homomorphic Properties** - Allows counting votes without decrypting individual ballots
- **Digital Signatures** - Verifies the authenticity of cast votes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact Information

For questions, support or business inquiries, please contact:
- **Email:** zainiqbal7007@gmail.com
- **GitHub:** [MuhammadZainIqbal](https://github.com/MuhammadZainIqbal)

---

<div align="center">
  <p>© 2025 Online Voting System. All rights reserved.</p>
</div>