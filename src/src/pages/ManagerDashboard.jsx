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
    IndianRupee,
    Briefcase,
    CheckCircle2,
    XCircle,
    Clock,
    Target,
    Network,
    List,
    Activity,
    BookOpen,
    Video,
    Link as LinkIcon,
    FileText,
    Trash2,
    Plus,
    Trophy,
    Calendar,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
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
                        <h3 className="text-2xl font-bold text-white mt-2">₹{stats.networkRevenue.toLocaleString()}</h3>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <IndianRupee className="w-5 h-5 text-emerald-500" />
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

const RevenueChart = ({ data }) => (
    <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
            <CardTitle className="text-white">Revenue Growth</CardTitle>
            <CardDescription className="text-slate-400">Network performance over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#64748b" axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                        itemStyle={{ color: '#f97316' }}
                        formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

const FocusAreas = ({ coaches }) => {
    // Sort coaches by volume (low to high) to identify those needing support
    // If coaches is undefined or null, default to empty array
    const safeCoaches = coaches || [];
    const sortedCoaches = [...safeCoaches].sort((a, b) => a.volume - b.volume);

    return (
        <Card className="bg-slate-900 border-slate-800 h-full">
            <CardHeader>
                <CardTitle className="text-white flex items-center">
                    <Target className="w-5 h-5 text-red-500 mr-2" /> Focus Areas
                </CardTitle>
                <CardDescription className="text-slate-400">Centers needing support to improve revenue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {sortedCoaches.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No active coaches to display.</p>
                ) : (
                    sortedCoaches.map((coach, index) => (
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
                    ))
                )}
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
            const { data: managerProfile } = await api.get('/manager/me');

            // Construct tree from profile data
            // We have verifiedDownlines (Coaches) and downlineManagers (Managers)
            const children = [];

            if (managerProfile.downlineManagers) {
                managerProfile.downlineManagers.forEach(mgr => {
                    children.push({
                        name: mgr.name,
                        level: mgr.level || "Manager",
                        volume: 0, // Placeholder
                        type: 'manager',
                        children: []
                    });
                });
            }

            if (managerProfile.verifiedDownlines) {
                managerProfile.verifiedDownlines.forEach(coach => {
                    children.push({
                        name: coach.name,
                        level: coach.wellnessCenterName || "Coach",
                        volume: 0, // Placeholder
                        type: 'coach',
                        children: []
                    });
                });
            }

            const managerNode = {
                name: user?.name || "You (Manager)",
                level: managerProfile.level || "Manager",
                volume: managerProfile.stats?.totalVolume || 0,
                type: 'root',
                children: children
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
                        ${node.type === 'root'
                            ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-900/20'
                            : node.type === 'manager'
                                ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-900/20'
                                : 'bg-slate-900 border-slate-700 hover:border-slate-500'}
                    `}
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center font-bold border
                        ${node.type === 'manager' ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 text-slate-200'}
                    `}>
                        {node.name.charAt(0)}
                    </div>
                    <h4 className="font-bold text-white text-sm">{node.name}</h4>
                    <p className="text-xs text-slate-400">{node.level}</p>
                    {node.volume > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between text-xs">
                            <span className="text-slate-500">Vol:</span>
                            <span className="font-mono text-emerald-400">{node.volume.toLocaleString()}</span>
                        </div>
                    )}
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
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Type</th>
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
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${row.type === 'root' ? 'bg-orange-500/20 text-orange-400' :
                                            row.type === 'manager' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                            {row.name.charAt(0)}
                                        </div>
                                        <span className={`font-medium ${row.type === 'root' ? 'text-orange-400' :
                                            row.type === 'manager' ? 'text-purple-400' : 'text-white'
                                            }`}>
                                            {row.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400 text-sm capitalize">{row.type}</td>
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

// --- Leaderboard Component ---
const LeaderboardView = () => {
    const [teamStats, setTeamStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'volume', direction: 'desc' });

    useEffect(() => {
        fetchTeamStats();
    }, []);

    const fetchTeamStats = async () => {
        try {
            const { data } = await api.get('/manager/team-stats');
            setTeamStats(data);
        } catch (error) {
            console.error("Failed to fetch team stats", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStats = useMemo(() => {
        let sortableItems = [...teamStats];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [teamStats, sortConfig]);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 text-slate-600" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp className="w-4 h-4 ml-1 text-orange-500" /> :
            <ArrowDown className="w-4 h-4 ml-1 text-orange-500" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Team Leaderboard</h2>
                    <p className="text-slate-400">Top performers in your network</p>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400 text-sm">
                                    <th className="p-4 font-medium">Rank</th>
                                    <th className="p-4 font-medium">Coach Name</th>
                                    <th className="p-4 font-medium">Level</th>
                                    <th
                                        className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort('volume')}
                                    >
                                        <div className="flex items-center">
                                            Volume (VP) {getSortIcon('volume')}
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort('recruits')}
                                    >
                                        <div className="flex items-center">
                                            Recruits {getSortIcon('recruits')}
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort('growth')}
                                    >
                                        <div className="flex items-center">
                                            Growth {getSortIcon('growth')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500">Loading leaderboard...</td>
                                    </tr>
                                ) : sortedStats.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500">No data available</td>
                                    </tr>
                                ) : (
                                    sortedStats.map((coach, index) => (
                                        <tr key={coach.id} className="group hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm 
                                                    ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                        index === 1 ? 'bg-slate-300/20 text-slate-300' :
                                                            index === 2 ? 'bg-orange-700/20 text-orange-700' :
                                                                'bg-slate-800 text-slate-500'}`}>
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-white">{coach.name}</div>
                                            </td>
                                            <td className="p-4 text-slate-400 text-sm">{coach.level}</td>
                                            <td className="p-4 text-white font-mono">{coach.volume.toLocaleString()}</td>
                                            <td className="p-4 text-slate-300">{coach.recruits}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center ${coach.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {coach.growth >= 0 ? '+' : ''}{coach.growth}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// --- Financials Component ---
const FinancialsView = () => {
    const [financials, setFinancials] = useState(null);
    const [revenueHistory, setRevenueHistory] = useState([]);
    const [teamStats, setTeamStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFinancialData();
    }, []);

    const fetchFinancialData = async () => {
        try {
            // Fetch profile for summary stats and history
            const { data: profileData } = await api.get('/manager/me');
            setFinancials(profileData.financials);
            setRevenueHistory(profileData.revenueHistory);

            // Fetch team stats for detailed breakdown
            const { data: statsData } = await api.get('/manager/team-stats');
            setTeamStats(statsData);
        } catch (error) {
            console.error("Failed to fetch financial data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading financials...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Financial Overview</h2>
                    <p className="text-slate-400">Track your earnings and network performance</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Download className="w-4 h-4 mr-2" /> Export Report
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Total Earnings</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{financials?.totalEarnings?.toLocaleString() || 0}</h3>
                            </div>
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <IndianRupee className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-slate-500">
                            Lifetime earnings from all sources
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Pending Payout</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{financials?.pendingPayout?.toLocaleString() || 0}</h3>
                            </div>
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Clock className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-slate-500">
                            Estimated payout for next cycle
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Last Payout</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{financials?.lastPayout?.toLocaleString() || 0}</h3>
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-slate-500">
                            Processed on {new Date().toLocaleDateString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue Chart */}
            <RevenueChart data={revenueHistory} />

            {/* Revenue Breakdown by Coach */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">Revenue by Center</CardTitle>
                    <CardDescription className="text-slate-400">Contribution from your downline teams</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400 text-sm">
                                    <th className="p-4 font-medium">Coach / Center</th>
                                    <th className="p-4 font-medium text-right">Volume (VP)</th>
                                    <th className="p-4 font-medium text-right">Est. Revenue</th>
                                    <th className="p-4 font-medium text-right">Contribution</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {teamStats.map((coach) => (
                                    <tr key={coach.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{coach.name}</div>
                                            <div className="text-xs text-slate-500">{coach.level}</div>
                                        </td>
                                        <td className="p-4 text-right text-slate-300 font-mono">
                                            {coach.monthlyVolume.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right text-emerald-400 font-mono">
                                            ₹{coach.revenue.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500"
                                                        style={{ width: `${(coach.revenue / (financials?.totalEarnings || 1)) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {((coach.revenue / (financials?.totalEarnings || 1)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// --- Resources Component ---
const Resources = () => {
    const [resources, setResources] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newResource, setNewResource] = useState({ title: '', type: 'video', url: '', description: '' });

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const { data } = await api.get('/resources/manager');
            setResources(data);
        } catch (error) {
            console.error("Failed to fetch resources", error);
        }
    };

    const handleAddResource = async (e) => {
        e.preventDefault();
        try {
            await api.post('/resources', newResource);
            setShowAddModal(false);
            setNewResource({ title: '', type: 'video', url: '', description: '' });
            fetchResources();
        } catch (error) {
            alert("Failed to add resource");
        }
    };

    const handleDeleteResource = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await api.delete(`/resources/${id}`);
            fetchResources();
        } catch (error) {
            alert("Failed to delete resource");
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'video': return Video;
            case 'pdf': return FileText;
            default: return LinkIcon;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Resource Hub</h2>
                    <p className="text-slate-400">Manage training materials and content for your team</p>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Resource
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map(resource => {
                    const Icon = getIcon(resource.type);
                    return (
                        <Card key={resource._id} className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400" onClick={() => handleDeleteResource(resource._id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg line-clamp-1">{resource.title}</h3>
                                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{resource.description}</p>
                                </div>
                                <div className="pt-4 border-t border-slate-800">
                                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center">
                                        View Resource <ChevronRight className="w-4 h-4 ml-1" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Add Resource Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Add New Resource</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                                <XCircle className="w-5 h-5" />
                            </Button>
                        </div>
                        <form onSubmit={handleAddResource} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Title</label>
                                <Input
                                    value={newResource.title}
                                    onChange={e => setNewResource({ ...newResource, title: e.target.value })}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Type</label>
                                <select
                                    value={newResource.type}
                                    onChange={e => setNewResource({ ...newResource, type: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm"
                                >
                                    <option value="video">Video (YouTube/Vimeo)</option>
                                    <option value="link">External Link</option>
                                    <option value="pdf">PDF Document</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">URL</label>
                                <Input
                                    value={newResource.url}
                                    onChange={e => setNewResource({ ...newResource, url: e.target.value })}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Description</label>
                                <textarea
                                    value={newResource.description}
                                    onChange={e => setNewResource({ ...newResource, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm h-24"
                                />
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                Publish Resource
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Contests Component ---
const Contests = () => {
    const [contests, setContests] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newContest, setNewContest] = useState({
        title: '',
        type: 'fat-loss',
        description: '',
        startDate: '',
        endDate: ''
    });
    const [selectedContest, setSelectedContest] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        fetchContests();
    }, []);

    const fetchContests = async () => {
        try {
            const { data } = await api.get('/contests/manager');
            setContests(data);
        } catch (error) {
            console.error("Failed to fetch contests", error);
        }
    };

    const handleCreateContest = async (e) => {
        e.preventDefault();
        try {
            await api.post('/contests', newContest);
            setShowCreateModal(false);
            setNewContest({ title: '', type: 'fat-loss', description: '', startDate: '', endDate: '' });
            fetchContests();
        } catch (error) {
            alert("Failed to create contest");
        }
    };

    const fetchLeaderboard = async (contestId) => {
        try {
            const { data } = await api.get(`/contests/${contestId}/leaderboard`);
            setLeaderboard(data);
            setSelectedContest(contests.find(c => c._id === contestId));
        } catch (error) {
            console.error("Failed to fetch leaderboard", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Wellness Contests</h2>
                    <p className="text-slate-400">Create and manage challenges for your network</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Create Contest
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Contest List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Active Contests</h3>
                    {contests.map(contest => (
                        <Card
                            key={contest._id}
                            className={`bg-slate-900 border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-all ${selectedContest?._id === contest._id ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}
                            onClick={() => fetchLeaderboard(contest._id)}
                        >
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-white">{contest.title}</h4>
                                    <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full capitalize">
                                        {contest.type.replace('-', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 mb-3 line-clamp-2">{contest.description}</p>
                                <div className="flex items-center text-xs text-slate-500">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(contest.startDate).toLocaleDateString()} - {new Date(contest.endDate).toLocaleDateString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {contests.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                            No contests found. Create one to get started!
                        </p>
                    )}
                </div>

                {/* Leaderboard Area */}
                <div className="lg:col-span-2">
                    {selectedContest ? (
                        <Card className="bg-slate-900 border-slate-800 h-full">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center">
                                    <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                                    Leaderboard: {selectedContest.title}
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Ranking based on {selectedContest.type.replace('-', ' ')} progress
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                                                <th className="pb-3 font-medium pl-4">Rank</th>
                                                <th className="pb-3 font-medium">Participant</th>
                                                <th className="pb-3 font-medium">Coach</th>
                                                <th className="pb-3 font-medium text-right pr-4">Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {leaderboard.map((participant, index) => (
                                                <tr key={index} className="group hover:bg-slate-800/30">
                                                    <td className="py-3 pl-4">
                                                        <div className={`
                                                            w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs
                                                            ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                                index === 1 ? 'bg-slate-400/20 text-slate-400' :
                                                                    index === 2 ? 'bg-orange-700/20 text-orange-700' :
                                                                        'text-slate-500'}
                                                        `}>
                                                            {index + 1}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 text-white font-medium">{participant.customerName}</td>
                                                    <td className="py-3 text-slate-400 text-sm">{participant.coachName}</td>
                                                    <td className="py-3 text-right pr-4">
                                                        <span className="text-emerald-400 font-mono font-bold">
                                                            {participant.change > 0 ? '+' : ''}{participant.change.toFixed(1)}
                                                            {selectedContest.type === 'weight-loss' ? 'kg' : '%'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {leaderboard.length === 0 && (
                                                <tr>
                                                    <td colspan="4" className="text-center py-8 text-slate-500 text-sm">
                                                        No participants yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 text-center">
                            <Trophy className="w-12 h-12 text-slate-700 mb-4" />
                            <h3 className="text-lg font-medium text-slate-300">Select a Contest</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mt-2">
                                Click on a contest from the list to view its live leaderboard and details.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Contest Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Create New Contest</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                                <XCircle className="w-5 h-5" />
                            </Button>
                        </div>
                        <form onSubmit={handleCreateContest} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Contest Title</label>
                                <Input
                                    value={newContest.title}
                                    onChange={e => setNewContest({ ...newContest, title: e.target.value })}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    placeholder="e.g., Summer Shred 2024"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Type</label>
                                <select
                                    value={newContest.type}
                                    onChange={e => setNewContest({ ...newContest, type: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm"
                                >
                                    <option value="fat-loss">Fat Loss (%)</option>
                                    <option value="muscle-gain">Muscle Gain (%)</option>
                                    <option value="weight-loss">Weight Loss (kg)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Start Date</label>
                                    <Input
                                        type="date"
                                        value={newContest.startDate}
                                        onChange={e => setNewContest({ ...newContest, startDate: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">End Date</label>
                                    <Input
                                        type="date"
                                        value={newContest.endDate}
                                        onChange={e => setNewContest({ ...newContest, endDate: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Description</label>
                                <textarea
                                    value={newContest.description}
                                    onChange={e => setNewContest({ ...newContest, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm h-24"
                                    placeholder="Rules, prizes, and details..."
                                />
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                Launch Contest
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Leaderboard Cards Component ---
const LeaderboardCardsView = ({ data }) => {
    if (!data) return <div className="text-white">Loading leaderboards...</div>;

    const { topProducers, topRecruiters, moversAndShakers } = data;

    const LeaderboardCard = ({ title, icon: Icon, color, data, metricLabel, metricKey, secondaryMetric }) => (
        <Card className="bg-slate-900 border-slate-800 h-full">
            <CardHeader>
                <CardTitle className="text-white flex items-center">
                    <Icon className={`w-5 h-5 ${color} mr-2`} /> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {data?.map((coach, index) => (
                    <div key={coach.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border
                                ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' :
                                    index === 1 ? 'bg-slate-400/20 text-slate-400 border-slate-400/50' :
                                        index === 2 ? 'bg-orange-700/20 text-orange-700 border-orange-700/50' :
                                            'bg-slate-800 text-slate-500 border-slate-700'}
                            `}>
                                {index + 1}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{coach.name}</p>
                                <p className="text-xs text-slate-500">{coach.level}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-white">
                                {metricKey === 'volume' ? coach[metricKey].toLocaleString() : coach[metricKey]} {metricLabel}
                            </p>
                            {secondaryMetric && (
                                <p className="text-xs text-slate-500">
                                    {secondaryMetric(coach)}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LeaderboardCard
                title="Top Producers"
                icon={Award}
                color="text-yellow-500"
                data={topProducers}
                metricLabel="VP"
                metricKey="volume"
            />
            <LeaderboardCard
                title="Top Recruiters"
                icon={UserPlus}
                color="text-blue-500"
                data={topRecruiters}
                metricLabel="Recruits"
                metricKey="recruits"
            />
            <LeaderboardCard
                title="Movers & Shakers"
                icon={TrendingUp}
                color="text-emerald-500"
                data={moversAndShakers}
                metricLabel="Growth"
                metricKey="growth"
                secondaryMetric={(coach) => `${coach.monthlyVolume.toLocaleString()} VP this month`}
            />
        </div>
    );
};

// --- Financials Data Component ---
const FinancialsDataView = ({ data }) => {
    if (!data) return <div className="text-white">Loading financials...</div>;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Total Earnings</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{data.totalEarnings?.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <IndianRupee className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Pending Payout</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{data.pendingPayout?.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Clock className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400">Last Payout</p>
                                <h3 className="text-2xl font-bold text-white mt-2">₹{data.lastPayout?.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Commission Breakdown */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-white">Commission Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.commissionBreakdown?.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <div>
                                        <p className="text-sm font-medium text-white">{item.type}</p>
                                        <p className="text-xs text-slate-400">{item.percentage}% of total</p>
                                    </div>
                                    <span className="text-emerald-400 font-bold">₹{item.amount?.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Payout History */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-white">Payout History</CardTitle>
                        <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="pb-3 font-medium">Date</th>
                                        <th className="pb-3 font-medium">Amount</th>
                                        <th className="pb-3 font-medium">Method</th>
                                        <th className="pb-3 font-medium text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {data.payoutHistory?.map((payout) => (
                                        <tr key={payout.id} className="group hover:bg-slate-800/30">
                                            <td className="py-4 text-white">{new Date(payout.date).toLocaleDateString()}</td>
                                            <td className="py-4 text-white font-medium">₹{payout.amount?.toLocaleString()}</td>
                                            <td className="py-4 text-slate-400">{payout.method}</td>
                                            <td className="py-4 text-right">
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                                                    {payout.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
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
    const [revenueData, setRevenueData] = useState(REVENUE_DATA);
    const [topCoaches, setTopCoaches] = useState(TOP_COACHES);
    const [financialsData, setFinancialsData] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState(null);

    const fetchManagerStats = async () => {
        try {
            const { data } = await api.get('/manager/me');
            if (data.stats) {
                setManagerStats(data.stats);
            }
            if (data.revenueHistory && data.revenueHistory.length > 0) {
                setRevenueData(data.revenueHistory);
            }
            if (data.topCoaches && data.topCoaches.length > 0) {
                setTopCoaches(data.topCoaches);
            }
            if (data.financials) {
                setFinancialsData(data.financials);
            }
            if (data.leaderboard) {
                setLeaderboardData(data.leaderboard);
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

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
                            <p className="text-slate-400">Welcome back, {user?.name || 'Manager'}</p>
                        </div>
                        <ManagerStats stats={managerStats} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <RevenueChart data={revenueData} />
                            <div className="space-y-6">
                                <FocusAreas coaches={topCoaches} />
                            </div>
                        </div>
                        {leaderboardData && <LeaderboardCardsView data={leaderboardData} />}
                    </div>
                );
            case 'profile':
                return <ManagerProfileSection />;
            case 'network':
                return <NetworkTree />;
            case 'resources':
                return <Resources />;
            case 'contests':
                return <Contests />;
            case 'my-center':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">My Center</h2>
                        <Card className="bg-slate-900 border-slate-800">
                            <CardContent className="p-6">
                                <p className="text-slate-400">Center management features coming soon...</p>
                            </CardContent>
                        </Card>
                    </div>
                );
            case 'directory':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Coach Directory</h2>
                        <Card className="bg-slate-900 border-slate-800">
                            <CardContent className="p-6">
                                <p className="text-slate-400">Coach directory features coming soon...</p>
                            </CardContent>
                        </Card>
                    </div>
                );
            case 'recruitment':
                return <RecruitmentPipeline />;
            case 'financials':
                return financialsData ? <FinancialsDataView data={financialsData} /> : <FinancialsView />;
            case 'leaderboard':
                return <LeaderboardView />;
            case 'health':
                return (
                    <CustomerStatsView
                        customer={customerProfile}
                        user={user}
                        logout={logout}
                        showNavbar={false}
                        onProfileUpdate={fetchCustomerProfile}
                    />
                );
            default:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Page Not Found</h2>
                        <Card className="bg-slate-900 border-slate-800">
                            <CardContent className="p-6">
                                <p className="text-slate-400">The requested page is not available.</p>
                            </CardContent>
                        </Card>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-orange-500/30 flex">
            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold">
                                PI
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">PulseIQ</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 ml-10">Manager Portal</p>
                    </div>
                    <Button variant="ghost" size="icon" className="lg:hidden text-slate-400" onClick={() => setMobileMenuOpen(false)}>
                        <XCircle className="w-6 h-6" />
                    </Button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                        { id: 'profile', icon: Settings, label: 'My Profile' },
                        { id: 'network', icon: Users, label: 'Network Tree' },
                        { id: 'resources', icon: BookOpen, label: 'Resources', badge: 'New' },
                        { id: 'contests', icon: Trophy, label: 'Contests', badge: 'New' },
                        { id: 'my-center', icon: Briefcase, label: 'My Center' },
                        { id: 'directory', icon: Users, label: 'Coach Directory' },
                        { id: 'recruitment', icon: UserPlus, label: 'Recruitment' },
                        { id: 'financials', icon: DollarSign, label: 'Financials' },
                        { id: 'leaderboard', icon: Award, label: 'Leaderboard' },
                        { id: 'health', icon: Activity, label: 'My Health' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveTab(item.id);
                                setMobileMenuOpen(false);
                            }}
                            className={`flex items-center w-full p-3 rounded-lg transition-all ${activeTab === item.id
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-5 h-5 mr-3" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge && (
                                <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {item.badge}
                                </span>
                            )}
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
            </aside >

            {/* Overlay for mobile */}
            {
                mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )
            }

            {/* Main Content */}
            < main className="flex-1 lg:ml-64 p-8 overflow-y-auto h-screen" >
                <div className="max-w-7xl mx-auto">
                    {/* Mobile Header */}
                    <header className="lg:hidden flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setMobileMenuOpen(true)}>
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
            </main >
        </div >
    );
};

export default ManagerDashboard;
