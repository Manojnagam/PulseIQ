import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Users,
    Globe,
    TrendingUp,
    LogOut,
    User,
    Bell,
    ChevronRight,
    Download,
    Filter,
    Award
} from 'lucide-react';

const ManagerDashboard = () => {
    const { user, logout } = useAuth();

    // Dummy data for "Owner" features
    const networkStats = {
        totalCoaches: 142,
        activeCoaches: 89,
        totalVolume: 450000,
        networkRevenue: 125000,
        newRecruits: 12
    };

    const topCoaches = [
        { name: "Sarah Johnson", level: "Level 3", volume: "45k", growth: "+12%" },
        { name: "Mike Chen", level: "Level 2", volume: "32k", growth: "+8%" },
        { name: "Jessica Williams", level: "Level 3", volume: "28k", growth: "+15%" },
        { name: "David Miller", level: "Level 2", volume: "25k", growth: "+5%" },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                <Globe className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                PulseIQ <span className="text-xs font-normal text-orange-400 ml-1">Manager</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5">
                                <Bell className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-white">{user?.name || 'Manager'}</p>
                                    <p className="text-xs text-slate-400">Regional Director</p>
                                </div>
                                <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                                    <User className="h-5 w-5 text-slate-400" />
                                </div>
                                <Button
                                    onClick={logout}
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                >
                                    <LogOut className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-3xl font-bold text-white">Network Overview</h1>
                        <p className="text-slate-400">Global performance metrics and organizational health.</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-3"
                    >
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                            <Filter className="h-4 w-4" /> Filter
                        </Button>
                        <Button className="bg-orange-600 hover:bg-orange-500 text-white gap-2">
                            <Download className="h-4 w-4" /> Export Report
                        </Button>
                    </motion.div>
                </div>

                {/* High-Level Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="bg-slate-900/50 border-white/10 hover:border-orange-500/30 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                                        <Globe className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                                        Global
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400">Network Revenue</p>
                                <h3 className="text-2xl font-bold text-white">${networkStats.networkRevenue.toLocaleString()}</h3>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="bg-slate-900/50 border-white/10 hover:border-blue-500/30 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400">Total Volume Points</p>
                                <h3 className="text-2xl font-bold text-white">{networkStats.totalVolume.toLocaleString()} VP</h3>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card className="bg-slate-900/50 border-white/10 hover:border-purple-500/30 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                                        +{networkStats.newRecruits} this month
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400">Total Coaches</p>
                                <h3 className="text-2xl font-bold text-white">{networkStats.totalCoaches}</h3>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <Card className="bg-slate-900/50 border-white/10 hover:border-green-500/30 transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400">Active Rate</p>
                                <h3 className="text-2xl font-bold text-white">
                                    {Math.round((networkStats.activeCoaches / networkStats.totalCoaches) * 100)}%
                                </h3>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Main Content Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Chart Section Placeholder */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Card className="bg-slate-900/50 border-white/10 h-full">
                                <CardHeader>
                                    <CardTitle className="text-white">Revenue Growth</CardTitle>
                                    <CardDescription className="text-slate-400">Year-over-year performance comparison</CardDescription>
                                </CardHeader>
                                <CardContent className="h-80 flex items-center justify-center text-slate-500 bg-white/5 rounded-xl m-6 border border-white/5 border-dashed">
                                    <p>Advanced Analytics Chart Component</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Top Performers Leaderboard */}
                    <div>
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <Card className="bg-gradient-to-br from-slate-900 to-slate-900/50 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <Award className="h-5 w-5 text-yellow-500" />
                                        Top Performers
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {topCoaches.map((coach, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-black' :
                                                        index === 1 ? 'bg-slate-300 text-black' :
                                                            index === 2 ? 'bg-orange-700 text-white' : 'bg-slate-800 text-slate-400'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">{coach.name}</h4>
                                                    <p className="text-xs text-slate-400">{coach.level}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-white">{coach.volume}</p>
                                                <p className="text-xs text-green-400">{coach.growth}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="ghost" className="w-full text-slate-400 hover:text-white mt-2 text-xs">
                                        View Full Leaderboard <ChevronRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ManagerDashboard;
