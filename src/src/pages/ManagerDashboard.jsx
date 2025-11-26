import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    TrendingUp,
    UserPlus,
    Settings,
    LogOut,
    Search,
    Filter,
    Download,
    ChevronRight,
    MoreHorizontal,
    MapPin,
    Phone,
    Mail,
    Award,
    DollarSign,
    Briefcase,
    CheckCircle2,
    XCircle,
    Clock,
    Target,
    Network,
    List,
    Activity
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { CoachView } from './CoachDashboard';
import { CustomerStatsView } from './CustomerDashboard';

// --- Mock Data ---
const MOCK_STATS = {
    networkRevenue: 125000,
    totalVolume: 450000,
    activeCoaches: 89,
    totalCoaches: 142,
    recruitmentRate: 12,
    retentionRate: 94
};

const REVENUE_DATA = [
    { name: 'Jan', value: 65000 },
    { name: 'Feb', value: 72000 },
    { name: 'Mar', value: 85000 },
    { name: 'Apr', value: 92000 },
    { name: 'May', value: 105000 },
    { name: 'Jun', value: 125000 },
];

const TOP_COACHES = [
    { id: 1, name: "Sarah Johnson", level: "President's Team", volume: 45000, recruits: 5, growth: 12, image: null },
    { id: 2, name: "Mike Chen", level: "Millionaire Team", volume: 32000, recruits: 3, growth: 8, image: null },
    { id: 3, name: "Jessica Williams", level: "GET Team", volume: 28000, recruits: 4, growth: 15, image: null },
    { id: 4, name: "David Miller", level: "World Team", volume: 25000, recruits: 2, growth: 5, image: null },
    { id: 5, name: "Emily Davis", level: "Active World Team", volume: 22000, recruits: 1, growth: 3, image: null },
];

const PIPELINE_STAGES = {
    new: { label: 'New Leads', color: 'bg-blue-500' },
    interview: { label: 'Interview', color: 'bg-orange-500' },
    training: { label: 'Training', color: 'bg-purple-500' },
    onboarded: { label: 'Onboarded', color: 'bg-emerald-500' }
};

const RECRUITS = [
    { id: 101, name: "Alex Thompson", stage: 'new', source: 'Instagram', date: '2023-11-20' },
    { id: 102, name: "Maria Garcia", stage: 'interview', source: 'Referral', date: '2023-11-18' },
    { id: 103, name: "James Wilson", stage: 'training', source: 'LinkedIn', date: '2023-11-15' },
    { id: 104, name: "Linda Brown", stage: 'onboarded', source: 'Event', date: '2023-11-10' },
    { id: 105, name: "Robert Taylor", stage: 'new', source: 'Website', date: '2023-11-21' },
];

const LEVEL_OPTIONS = ['Junior', 'Senior', 'Regional', 'National'];

// --- Components ---

const ManagerStats = ({ stats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Network Revenue</p>
                        <h3 className="text-2xl font-bold text-white mt-2">${stats.networkRevenue.toLocaleString()}</h3>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                    <span className="text-emerald-400 flex items-center font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" /> +15%
                    </span>
                    <span className="text-slate-500 ml-2">vs last month</span>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Total Volume</p>
                        <h3 className="text-2xl font-bold text-white mt-2">{stats.totalVolume.toLocaleString()} VP</h3>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Award className="w-5 h-5 text-blue-500" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                    <span className="text-emerald-400 flex items-center font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" /> +8%
                    </span>
                    <span className="text-slate-500 ml-2">vs last month</span>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-colors">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Active Coaches</p>
                        <h3 className="text-2xl font-bold text-white mt-2">{stats.activeCoaches} <span className="text-sm text-slate-500 font-normal">/ {stats.totalCoaches}</span></h3>
                    </div>
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Users className="w-5 h-5 text-purple-500" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                    <span className="text-purple-400 flex items-center font-medium">
                        {Math.round((stats.activeCoaches / stats.totalCoaches) * 100)}% Active
                    </span>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-400">New Recruits</p>
                        <h3 className="text-2xl font-bold text-white mt-2">+{stats.recruitmentRate}</h3>
                    </div>
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                        <UserPlus className="w-5 h-5 text-orange-500" />
                    </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                    <span className="text-emerald-400 flex items-center font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" /> +2
                    </span>
                    <span className="text-slate-500 ml-2">vs last month</span>
                </div>
            </CardContent>
        </Card>
    </div>
);

const RevenueChart = () => (
    <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
            <CardTitle className="text-white">Revenue Growth</CardTitle>
            <CardDescription className="text-slate-400">Network performance over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_DATA}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#64748b" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                        itemStyle={{ color: '#f97316' }}
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

const FocusAreas = () => {
    // Sort coaches by volume (low to high) to identify those needing support
    const sortedCoaches = [...TOP_COACHES].sort((a, b) => a.volume - b.volume);

    return (
        <Card className="bg-slate-900 border-slate-800 h-full">
            <CardHeader>
                <CardTitle className="text-white flex items-center">
                    <Target className="w-5 h-5 text-red-500 mr-2" /> Focus Areas
                </CardTitle>
                <CardDescription className="text-slate-400">Centers needing support to improve revenue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {sortedCoaches.map((coach, index) => (
                    <div key={coach.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-red-500/30 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-slate-800 text-slate-400 border border-slate-700`}>
                                {index + 1}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">{coach.name}</p>
                                <p className="text-xs text-slate-500">{coach.level}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-white">{coach.volume.toLocaleString()} VP</p>
                            <p className="text-xs text-slate-500">
                                {coach.growth < 5 ? (
                                    <span className="text-red-400 flex items-center justify-end gap-1">
                                        <TrendingUp className="w-3 h-3 rotate-180" /> +{coach.growth}%
                                    </span>
                                ) : (
                                    <span className="text-emerald-400">+{coach.growth}%</span>
                                )}
                            </p>
                        </div>
                    </div>
                ))}
                <Button variant="ghost" className="w-full text-slate-400 hover:text-white hover:bg-slate-800 mt-2">
                    View All Centers <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </CardContent>
        </Card>
    );
};

const RecruitmentPipeline = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Recruitment Pipeline</h2>
                <Button className="bg-orange-600 hover:bg-orange-700">
                    <UserPlus className="w-4 h-4 mr-2" /> Add Recruit
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                {Object.entries(PIPELINE_STAGES).map(([key, stage]) => (
                    <div key={key} className="min-w-[260px] bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                <h3 className="font-semibold text-slate-200">{stage.label}</h3>
                            </div>
                            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
                                {RECRUITS.filter(r => r.stage === key).length}
                            </span>
                        </div>
                        <div className="space-y-3 flex-1">
                            {RECRUITS.filter(r => r.stage === key).map(recruit => (
                                <div key={recruit.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm hover:border-orange-500/50 cursor-pointer group transition-all">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-medium text-white">{recruit.name}</h4>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 opacity-0 group-hover:opacity-100">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Source: {recruit.source}</p>
                                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                        <span>{new Date(recruit.date).toLocaleDateString()}</span>
                                        <div className="flex gap-1">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-orange-400"><Phone className="w-3 h-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-orange-400"><Mail className="w-3 h-3" /></Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CoachDirectory = () => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-white">Coach Directory</CardTitle>
                        <CardDescription className="text-slate-400">Manage and monitor your downline organization</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <Input
                                placeholder="Search coaches..."
                                className="pl-9 bg-slate-800 border-slate-700 text-white w-full md:w-64 focus:ring-orange-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                            <Filter className="w-4 h-4 mr-2" /> Filter
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-sm">
                                <th className="pb-3 font-medium">Coach Name</th>
                                <th className="pb-3 font-medium">Level</th>
                                <th className="pb-3 font-medium">Volume (VP)</th>
                                <th className="pb-3 font-medium">Recruits</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {TOP_COACHES.map((coach) => (
                                <tr key={coach.id} className="group hover:bg-slate-800/50 transition-colors">
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                                {coach.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{coach.name}</p>
                                                <p className="text-xs text-slate-500">ID: #{1000 + coach.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 text-slate-300 text-sm">{coach.level}</td>
                                    <td className="py-4 text-white font-medium">{coach.volume.toLocaleString()}</td>
                                    <td className="py-4 text-slate-300 text-sm">{coach.recruits}</td>
                                    <td className="py-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                                            Active
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                                            View Profile
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

const ManagerProfileSection = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({ name: '', level: LEVEL_OPTIONS[0], lineLevel: '' });
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data } = await api.get('/manager/me');
            setProfile(data);
            setFormData({
                name: data.name || user?.name || '',
                level: data.level || LEVEL_OPTIONS[0],
                lineLevel: data.lineLevel || '',
                uplineName: data.uplineName || '',
                uplineMobile: data.uplineMobile || ''
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!editing) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            const { data } = await api.put('/manager/me', formData);
            setProfile((prev) => ({
                ...prev,
                ...data
            }));
            setSuccess('Profile updated successfully.');
            setEditing(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <p className="text-red-400">{error}</p>
                <Button onClick={fetchProfile} className="bg-orange-600 hover:bg-orange-700">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Profile Summary</CardTitle>
                        <CardDescription className="text-slate-400">Key details you can update anytime</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-xs uppercase text-slate-500">Manager Name</p>
                            <p className="text-lg font-semibold text-white mt-1">{profile?.name || user?.name}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-500">Level</p>
                            <p className="text-lg font-semibold text-white mt-1">{profile?.level || 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-500">Line Level</p>
                            <p className="text-lg font-semibold text-white mt-1">{profile?.lineLevel || 'Not set'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Network Snapshot</CardTitle>
                        <CardDescription className="text-slate-400">Aggregated stats</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div>
                                <p className="text-xs uppercase text-slate-500">Total Coaches</p>
                                <p className="text-2xl font-bold text-white">{profile?.stats?.totalCoaches ?? '--'}</p>
                            </div>
                            <Users className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div>
                                <p className="text-xs uppercase text-slate-500">Total Customers</p>
                                <p className="text-2xl font-bold text-white">{profile?.stats?.totalCustomers ?? '--'}</p>
                            </div>
                            <UserPlus className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <div>
                                <p className="text-xs uppercase text-slate-500">Total Volume</p>
                                <p className="text-2xl font-bold text-white">{profile?.stats?.totalVolume?.toLocaleString() ?? '--'} VP</p>
                            </div>
                            <TrendingUp className="w-6 h-6 text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Account</CardTitle>
                        <CardDescription className="text-slate-400">Your login details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-xs uppercase text-slate-500">Registered Mobile</p>
                            <p className="text-lg font-semibold text-white">{user?.mobile || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-500">Role</p>
                            <p className="text-lg font-semibold text-white capitalize">{user?.role || 'manager'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-slate-500">Status</p>
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                                Verified
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-white">Manage Profile</CardTitle>
                        <CardDescription className="text-slate-400">Update your own details as needed</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {editing && (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-slate-400 hover:text-white"
                                onClick={() => {
                                    setEditing(false);
                                    setSuccess(null);
                                    setError(null);
                                    setFormData({
                                        name: profile?.name || '',
                                        level: profile?.level || LEVEL_OPTIONS[0],
                                        lineLevel: profile?.lineLevel || '',
                                        uplineName: profile?.uplineName || '',
                                        uplineMobile: profile?.uplineMobile || ''
                                    });
                                }}
                            >
                                Cancel
                            </Button>
                        )}
                        <Button onClick={() => setEditing((prev) => !prev)} className="bg-orange-600 hover:bg-orange-700">
                            {editing ? 'Editing' : 'Edit Profile'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                            {success}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Full Name</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                disabled={!editing}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Enter your display name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Manager Level</label>
                            <select
                                name="level"
                                value={formData.level}
                                onChange={handleChange}
                                disabled={!editing}
                                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                {LEVEL_OPTIONS.map((level) => (
                                    <option key={level} value={level} className="bg-slate-800 text-white">
                                        {level}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Line Level</label>
                            <Input
                                name="lineLevel"
                                value={formData.lineLevel}
                                onChange={handleChange}
                                disabled={!editing}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="e.g., Level 1, Level 2"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Upline Name</label>
                            <Input
                                name="uplineName"
                                value={formData.uplineName}
                                onChange={handleChange}
                                disabled={!editing}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Enter upline name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Upline Mobile</label>
                            <Input
                                name="uplineMobile"
                                value={formData.uplineMobile}
                                onChange={handleChange}
                                disabled={!editing}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Enter upline mobile"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">Notes</label>
                            <textarea
                                disabled
                                className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-500"
                                rows="3"
                                value="Additional editable fields (address, center info, etc.) can be added here later without changing the current layout."
                                readOnly
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <Button
                                type="submit"
                                className="bg-orange-600 hover:bg-orange-700"
                                disabled={!editing || saving}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

// --- Network Tree Component ---
const NetworkTree = () => {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'
    const [treeData, setTreeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchNetworkTree();
    }, []);

    const fetchNetworkTree = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data: coaches } = await api.get('/manager/coaches');

            // Build tree structure from flat list
            // For now, create a simple structure with manager at root and coaches as children
            const managerNode = {
                name: user?.name || "You (Manager)",
                level: "Manager",
                volume: 0,
                children: coaches.map(coach => ({
                    name: coach.name,
                    level: coach.wellnessCenterName || "Coach",
                    volume: 0, // Volume calculation would need to be added
                    children: [] // Could be populated with downlines if available
                }))
            };

            setTreeData(managerNode);
        } catch (err) {
            console.error("Failed to fetch network tree:", err);
            setError(err.response?.data?.message || "Failed to load network tree");
            // Fallback to empty structure
            setTreeData({
                name: user?.name || "You (Manager)",
                level: "Manager",
                volume: 0,
                children: []
            });
        } finally {
            setLoading(false);
        }
    };

    const TreeNode = ({ node }) => {
        const [expanded, setExpanded] = useState(true);

        return (
            <div className="flex flex-col items-center">
                <div
                    className={`
                        relative z-10 p-4 rounded-xl border transition-all cursor-pointer min-w-[200px] text-center
                        ${node.name.includes('You')
                            ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-900/20'
                            : 'bg-slate-900 border-slate-700 hover:border-slate-500'}
                    `}
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="w-10 h-10 rounded-full bg-slate-800 mx-auto mb-2 flex items-center justify-center font-bold text-slate-200 border border-slate-700">
                        {node.name.charAt(0)}
                    </div>
                    <h4 className="font-bold text-white text-sm">{node.name}</h4>
                    <p className="text-xs text-slate-400">{node.level}</p>
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between text-xs">
                        <span className="text-slate-500">Vol:</span>
                        <span className="font-mono text-emerald-400">{node.volume.toLocaleString()}</span>
                    </div>
                    {node.children?.length > 0 && (
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-full p-0.5 border border-slate-700">
                            <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </div>
                    )}
                </div>

                {expanded && node.children?.length > 0 && (
                    <div className="flex pt-8 relative">
                        {/* Connecting Lines */}
                        <div className="absolute top-0 left-1/2 w-px h-8 bg-slate-700 -translate-x-1/2"></div>
                        <div className="absolute top-8 left-0 right-0 h-px bg-slate-700 mx-[25%]"></div> {/* Horizontal connector */}

                        <div className="flex gap-8">
                            {node.children.map((child, idx) => (
                                <div key={idx} className="relative pt-4">
                                    {/* Vertical line to child */}
                                    <div className="absolute top-0 left-1/2 w-px h-4 bg-slate-700 -translate-x-1/2"></div>
                                    <TreeNode node={child} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const flattenTree = (node, depth = 0, result = []) => {
        result.push({ ...node, depth });
        if (node.children) {
            node.children.forEach(child => flattenTree(child, depth + 1, result));
        }
        return result;
    };

    const ListView = ({ data }) => {
        const flatData = flattenTree(data);

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Coach Name</th>
                            <th className="p-4 font-medium">Level</th>
                            <th className="p-4 font-medium text-right">Volume (VP)</th>
                            <th className="p-4 font-medium text-center">Downline</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {flatData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="p-4">
                                    <div className="flex items-center" style={{ paddingLeft: `${row.depth * 20}px` }}>
                                        {row.depth > 0 && <div className="w-2 h-2 border-l border-b border-slate-600 mr-2 rounded-bl-sm"></div>}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${row.name.includes('You') ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                            {row.name.charAt(0)}
                                        </div>
                                        <span className={`font-medium ${row.name.includes('You') ? 'text-orange-400' : 'text-white'}`}>
                                            {row.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400 text-sm">{row.level}</td>
                                <td className="p-4 text-right font-mono text-emerald-400">{row.volume.toLocaleString()}</td>
                                <td className="p-4 text-center text-slate-500 text-sm">{row.children?.length || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Network Hierarchy</h3>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <button
                        onClick={() => setViewMode('tree')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center transition-all ${viewMode === 'tree' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <Network className="w-3 h-3 mr-1.5" /> Tree
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <List className="w-3 h-3 mr-1.5" /> List
                    </button>
                </div>
            </div>

            <div className="p-4 overflow-x-auto min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                            <p className="text-slate-400">Loading network tree...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <p className="text-red-400 mb-2">{error}</p>
                            <Button onClick={fetchNetworkTree} className="bg-orange-600 hover:bg-orange-700">
                                Retry
                            </Button>
                        </div>
                    </div>
                ) : !treeData || (treeData.children && treeData.children.length === 0) ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Network Data</h3>
                            <p className="text-slate-400">You don't have any coaches in your network yet.</p>
                        </div>
                    </div>
                ) : viewMode === 'tree' ? (
                    <div className="flex justify-center min-w-[800px] pt-8">
                        <TreeNode node={treeData} />
                    </div>
                ) : (
                    <ListView data={treeData} />
                )}
            </div>
        </div>
    );
};

// --- Main Page Component ---

const ManagerDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [customerProfile, setCustomerProfile] = useState(null);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [managerStats, setManagerStats] = useState(MOCK_STATS);

    const fetchManagerStats = async () => {
        try {
            const { data } = await api.get('/manager/me');
            if (data.stats) {
                setManagerStats(data.stats);
            }
        } catch (err) {
            console.error("Failed to fetch manager stats", err);
        }
    };

    const fetchCustomerProfile = async () => {
        try {
            setCustomerLoading(true);
            const { data } = await api.get('/customers/me');
            setCustomerProfile(data);
        } catch (err) {
            console.log("No customer profile found, one will be created on update.");
        } finally {
            setCustomerLoading(false);
        }
    };

    useEffect(() => {
        fetchManagerStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'health') {
            fetchCustomerProfile();
        }
    }, [activeTab]);

    // Safety check - if no user, show loading
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <ManagerStats stats={managerStats} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <RevenueChart />
                            </div>
                            <div>
                                <FocusAreas />
                            </div>
                        </div>
                    </div>
                );
            case 'profile':
                return <ManagerProfileSection />;
            case 'network':
                return <NetworkTree />;
            case 'my-center':
                return (
                    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden min-h-[800px]">
                        <CoachView isEmbedded={true} />
                    </div>
                );
            case 'directory':
                return <CoachDirectory />;
            case 'recruitment':
                return <RecruitmentPipeline />;
            case 'financials':
                return (
                    <div className="flex items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-xl">
                        <div className="text-center">
                            <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white">Financials & Commissions</h3>
                            <p className="text-slate-400">Coming Soon</p>
                        </div>
                    </div>
                );
            case 'health':
                return (
                    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden min-h-[800px]">
                        {customerLoading ? (
                            <div className="flex items-center justify-center h-96">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-4"></div>
                                    <p className="text-slate-400">Loading health data...</p>
                                </div>
                            </div>
                        ) : (
                            <CustomerStatsView
                                customer={customerProfile}
                                user={user}
                                logout={logout}
                                showNavbar={false}
                                onProfileUpdate={fetchCustomerProfile}
                            />
                        )}
                    </div>
                );
            default:
                return (
                    <div className="space-y-6">
                        <ManagerStats stats={managerStats} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <RevenueChart />
                            </div>
                            <div>
                                <FocusAreas />
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-orange-500/30 flex">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 z-50 hidden lg:flex flex-col">
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold">
                            PI
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">PulseIQ</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-10">Manager Portal</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                        { id: 'profile', icon: Settings, label: 'My Profile' },
                        { id: 'network', icon: Users, label: 'Network Tree' },
                        { id: 'my-center', icon: Briefcase, label: 'My Center' },
                        { id: 'directory', icon: Users, label: 'Coach Directory' },
                        { id: 'recruitment', icon: UserPlus, label: 'Recruitment' },
                        { id: 'financials', icon: DollarSign, label: 'Financials' },
                        { id: 'health', icon: Activity, label: 'My Health' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center w-full p-3 rounded-lg transition-all ${activeTab === item.id
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0) || 'M'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.name || 'Manager'}</p>
                            <p className="text-xs text-slate-500 truncate">Regional Director</p>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800" onClick={logout}>
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 p-8 overflow-y-auto h-screen">
                <div className="max-w-7xl mx-auto">
                    {/* Mobile Header */}
                    <header className="lg:hidden flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
                        <Button variant="ghost" size="icon" className="text-white">
                            <MoreHorizontal className="w-6 h-6" />
                        </Button>
                    </header>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default ManagerDashboard;
