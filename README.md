# PulseIQ - Wellness Management Platform

A comprehensive wellness and health management platform designed for customers, wellness coaches, and managers to track health metrics, manage client relationships, and build a network of wellness centers.

## 🌟 Overview

PulseIQ is a full-stack web application that connects customers with wellness coaches and enables managers to oversee their network of wellness centers. The platform provides tools for tracking body composition, managing client relationships, analyzing performance metrics, and building a successful wellness business.

## ✨ Key Features

### 👤 Customer Dashboard
- **Health Tracking**: Monitor body composition metrics including weight, body fat percentage, muscle mass, visceral fat, BMI, RMR, and body age
- **Progress Visualization**: View progress trends through interactive charts and graphs
- **Progress History**: Track all body composition updates over time
- **Nutrition Guide**: Access personalized diet plans with recommended and avoid food lists
- **Plan Management**: View active wellness plans and membership details
- **Real-time Updates**: Update body composition metrics and track progress

### 🏋️ Wellness Coach Dashboard
- **Client Management**: Comprehensive CRM system for managing leads and active clients
- **Client Analytics**: Track client progress, attendance, and renewal status
- **Revenue Tracking**: Monitor revenue, growth metrics, and client retention
- **Nutrition Library**: Manage and recommend food items to clients
- **Marketing Tools**: Generate success stories and marketing content
- **Check-in System**: Record client attendance and progress updates
- **Renewal Management**: Track and manage client membership renewals

### 👔 Manager Dashboard
- **Network Overview**: Monitor network revenue, total volume, and active coaches
- **Network Hierarchy**: Visualize and manage the organizational structure with tree and list views
- **Coach Directory**: Search and filter through all coaches in the network
- **Recruitment Pipeline**: Track potential recruits through different stages (New, Interview, Training, Onboarded)
- **Performance Analytics**: View revenue growth charts and identify focus areas
- **Profile Management**: Edit and update manager profile information
- **Center Management**: Access coach dashboard features for personal center management

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Multer** for file uploads
- **Sharp** for image processing

### Frontend
- **React 18** with Vite
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for data visualization
- **Radix UI** for accessible components
- **Lucide React** for icons
- **Axios** for API calls

## 📁 Project Structure

```
pulseiq/
├── config/           # Database configuration
├── controllers/      # Route controllers
├── middleware/       # Authentication and authorization middleware
├── models/          # MongoDB models (User, Customer, Coach, Manager, FoodItem)
├── routes/          # API routes
├── uploads/         # Uploaded files storage
└── src/             # Frontend React application
    └── src/
        ├── components/  # Reusable UI components
        ├── config/      # API configuration
        ├── context/     # React context providers
        ├── pages/       # Page components
        └── lib/         # Utility functions
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Manojnagam/PulseIQ-Antigravity.git
   cd PulseIQ-Antigravity
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd src
   npm install
   cd ..
   ```

4. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

5. **Run the application**
   
   For development (runs both backend and frontend):
   ```bash
   npm run dev
   ```
   
   Or run separately:
   ```bash
   # Backend only
   npm run server
   
   # Frontend only
   npm run client
   ```

6. **Access the application**
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:5000

## 👥 User Roles

### Customer
- Sign up with a wellness coach's mobile number
- Track personal health metrics
- View progress and nutrition guidance
- Access personalized wellness plans

### Wellness Coach
- Manage a portfolio of clients
- Track client progress and attendance
- Generate revenue reports
- Access nutrition library
- Create marketing content

### Manager
- Oversee network of wellness coaches
- Monitor network performance
- Manage recruitment pipeline
- View hierarchical network structure
- Access advanced analytics

## 🔐 Authentication

The application uses JWT-based authentication with role-based access control:
- **Password-based login**: Traditional email/password authentication
- **OTP-based login**: Mobile OTP verification for quick access
- **Role-based routes**: Protected routes based on user role (customer, coach, manager)

## 📊 Features in Detail

### Body Composition Tracking
- Weight, Body Fat %, Muscle Mass %, Visceral Fat
- BMI, RMR (Resting Metabolic Rate), Body Age
- TSF (Triceps Skinfold) Percentage
- Progress logs with historical data

### Analytics & Reporting
- Revenue growth charts
- Client retention metrics
- Network performance dashboards
- Recruitment pipeline visualization
- Focus areas identification

### Network Management
- Hierarchical organization view
- Coach directory with search and filters
- Downline management
- Upline tracking
- Line level assignment

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the ISC License.

## 👤 Author

**Manojnagam**
- GitHub: [@Manojnagam](https://github.com/Manojnagam)

## 🙏 Acknowledgments

Built with modern web technologies and best practices for scalability and user experience.

---

**Note**: This is a development project. Make sure to configure proper security settings and environment variables before deploying to production.

