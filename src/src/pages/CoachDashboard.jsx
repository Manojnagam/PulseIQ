import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    TrendingUp,
    IndianRupee,
    Star,
    LogOut,
    User,
    Bell,
    ChevronRight,
    ChevronLeft,
    UserPlus,
    MessageSquare,
    X,
    Check,
    Calendar,
    Activity,
    Scale,
    LayoutDashboard,
    PieChart,
    Megaphone,
    Phone,
    MoreHorizontal,
    RefreshCw,
    Edit2,
    Upload,
    Download,
    Share2,
    Plus,
    Utensils,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    Search,
    CreditCard
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
    Bar
} from 'recharts';

export const CoachView = ({ isEmbedded = false }) => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [clients, setClients] = useState([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeLeads: 0,
        churnRisk: 0,
        monthlyGrowth: 0,
        totalClients: 0
    });
    const [loading, setLoading] = useState(true);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // New Modals State
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [editingClient, setEditingClient] = useState(null);

    // Profile Edit State

    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileFormData, setProfileFormData] = useState({});

    // Add Client Form State
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        age: '',
        gender: 'Female',
        joinedDate: new Date().toISOString().split('T')[0],
        height: '',
        weight: '',
        fatPercent: '',
        visceralFat: '',
        muscleMassPercent: '',
        rmr: '',
        bmi: '',
        bodyAge: '',
        tsfPercent: '',
        idealWeight: '',
        idealFatPercent: '',
        idealVisceralFat: '',
        idealMuscleMassPercent: '',
        idealRmr: '',
        idealBmi: '',
        idealBodyAge: '',
        idealTsfPercent: '',
        referrer: '',
        referrerMobile: '',
        pack: '',
        packPrice: 0,
        status: 'active',
        pipelineStage: 'New',
        initialPayment: { amount: '', type: 'Cash', notes: '' }
    });

    // Check-in Data State
    const [checkInData, setCheckInData] = useState({
        weight: '',
        fatPercent: '',
        visceralFat: '',
        muscleMassPercent: '',
        rmr: '',
        bmi: '',
        bodyAge: '',
        tsfPercent: ''
    });

    // Renew Data State
    const [renewData, setRenewData] = useState({
        pack: '', packPrice: 0
    });

    // Auto-calculate Target (Current - Ideal) for display
    const calculateTarget = (field) => {
        const current = parseFloat(formData[field]);
        const ideal = parseFloat(formData[`ideal${field.charAt(0).toUpperCase() + field.slice(1)}`]);
        if (!isNaN(current) && !isNaN(ideal)) {
            return (current - ideal).toFixed(2);
        }
        return '-';
    };

    // Auto-fill price based on pack
    useEffect(() => {
        const prices = {
            '30 Days Shake Pack': 6969,
            '26 Days Shake Pack': 5600,
            '3 Days Trial Pack': 900,
            'Hot Drink Pack (30 Days)': 1000,
            'Coach Self-Use': 0
        };
        if (formData.pack && prices[formData.pack] !== undefined) {
            setFormData(prev => ({ ...prev, packPrice: prices[formData.pack] }));
        }
        // Also for renew data
        if (renewData.pack && prices[renewData.pack] !== undefined) {
            setRenewData(prev => ({ ...prev, packPrice: prices[renewData.pack] }));
        }
    }, [formData.pack, renewData.pack]);

    const [profile, setProfile] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-Inactivity Check
    useEffect(() => {
        if (clients.length > 0) {
            checkAutoInactivity();
        }
    }, [clients]);

    const checkAutoInactivity = async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const inactiveClients = clients.filter(c => {
            if (c.status !== 'active') return false;

            // Check last attendance
            const lastAttendance = c.attendance && c.attendance.length > 0
                ? new Date(c.attendance[c.attendance.length - 1])
                : new Date(c.createdAt); // Fallback to join date if no attendance

            return lastAttendance < thirtyDaysAgo;
        });

        if (inactiveClients.length > 0) {
            console.log(`Found ${inactiveClients.length} inactive clients. Updating status...`);
            let updatedCount = 0;

            for (const client of inactiveClients) {
                try {
                    await api.put(`/coach/customers/${client._id}`, { status: 'inactive' });
                    updatedCount++;
                } catch (err) {
                    console.error(`Failed to auto-inactive client ${client.name}`, err);
                }
            }

            if (updatedCount > 0) {
                // Refresh data to reflect changes
                fetchData();
                // Optional: Show a toast notification here
                // alert(`${updatedCount} clients moved to inactive due to absence (>30 days).`);
            }
        }
    };

    const fetchData = async () => {
        try {
            const [clientsRes, statsRes, profileRes] = await Promise.all([
                api.get('/coach/downlines'),
                api.get('/coach/stats'),
                api.get('/coach/me')
            ]);
            setClients(clientsRes.data);
            setStats(statsRes.data);
            setProfile(profileRes.data);
            setProfileFormData(profileRes.data || {});
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelfRegister = async () => {
        try {
            await api.post('/coach/self-register');
            alert("Successfully registered as a customer!");
            fetchData(); // Refresh to show new status if needed
        } catch (error) {
            alert(error.response?.data?.message || "Failed to register as customer");
        }
    };

    const handleUpdateProfile = async () => {
        try {
            await api.put('/coach/profile', profileFormData);
            setIsEditingProfile(false);
            fetchData();
            alert("Profile updated successfully!");
        } catch (error) {
            alert(error.response?.data?.message || "Failed to update profile");
        }
    };

    const handleCheckInSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/coach/customers/${selectedClient._id}/checkin`, checkInData);
            setShowCheckInModal(false);
            fetchData();
            // Update selected client locally
            const updatedClient = { ...selectedClient };
            updatedClient.bodyComposition = { ...updatedClient.bodyComposition, ...checkInData };
            setSelectedClient(updatedClient);
            alert("Check-in recorded!");
        } catch (error) {
            alert(error.response?.data?.message || "Failed to check-in");
        }
    };

    const handleRenewSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/coach/customers/${selectedClient._id}/renew`, renewData);
            setShowRenewModal(false);
            fetchData();
            alert("Membership renewed!");
        } catch (error) {
            alert(error.response?.data?.message || "Failed to renew");
        }
    };

    const handleMarkAttendance = async (clientId) => {
        if (!clientId) return;
        try {
            await api.post(`/coach/customers/${clientId}/attendance`);
            fetchData();
            if (selectedClient?._id === clientId) {
                setSelectedClient({
                    ...selectedClient,
                    attendance: [...(selectedClient.attendance || []), new Date().toISOString()],
                });
            }
            alert('Attendance marked!');
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to mark attendance');
        }
    };

    const handleDeleteClient = async () => {
        if (!window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;
        try {
            await api.delete(`/coach/customers/${selectedClient._id}`);
            setSelectedClient(null);
            fetchData();
            alert("Customer deleted successfully");
        } catch (error) {
            alert(error.response?.data?.message || "Failed to delete customer");
        }
    };

    const handleAddClient = async (e) => {
        e.preventDefault();
        try {
            // Construct payload matching backend expectation
            const payload = {
                ...formData,
                date: formData.joinedDate,
                bodyComposition: {
                    height: formData.height,
                    weight: formData.weight,
                    fatPercent: formData.fatPercent,
                    visceralFat: formData.visceralFat,
                    muscleMassPercent: formData.muscleMassPercent,
                    rmr: formData.rmr,
                    bmi: formData.bmi,
                    bodyAge: formData.bodyAge,
                    tsfPercent: formData.tsfPercent
                },
                idealBodyComposition: {
                    weight: formData.idealWeight,
                    fatPercent: formData.idealFatPercent,
                    visceralFat: formData.idealVisceralFat,
                    muscleMassPercent: formData.idealMuscleMassPercent,
                    rmr: formData.idealRmr,
                    bmi: formData.idealBmi,
                    bodyAge: formData.idealBodyAge,
                    tsfPercent: formData.idealTsfPercent
                }
            };

            if (editingClient) {
                await api.put(`/coach/customers/${editingClient._id}`, payload);
                alert("Client updated successfully!");
            } else {
                await api.post('/coach/customers', payload);
                alert("Client added successfully!");
            }

            setShowAddClient(false);
            setEditingClient(null); // Reset editing state
            fetchData();
            // Reset form
            setFormData({
                name: '', mobile: '', age: '', gender: 'Female', joinedDate: new Date().toISOString().split('T')[0],
                height: '', weight: '', fatPercent: '', visceralFat: '', muscleMassPercent: '', rmr: '', bmi: '', bodyAge: '', tsfPercent: '',
                idealWeight: '', idealFatPercent: '', idealVisceralFat: '', idealMuscleMassPercent: '', idealRmr: '', idealBmi: '', idealBodyAge: '', idealTsfPercent: '',
                referrer: '', referrerMobile: '', pack: '', packPrice: 0, status: 'active', pipelineStage: 'New',
                initialPayment: { amount: '', type: 'Cash', notes: '' }
            });
        } catch (error) {
            alert(error.response?.data?.message || (editingClient ? "Failed to update client" : "Failed to add client"));
        }
    };

    const openEditClientModal = (client) => {
        setEditingClient(client);
        setFormData({
            name: client.name || '',
            mobile: client.mobile || '',
            age: client.age || '',
            gender: client.gender || 'Female',
            joinedDate: client.date ? new Date(client.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],

            // Current Body Comp
            height: client.bodyComposition?.height || '',
            weight: client.bodyComposition?.weight || '',
            fatPercent: client.bodyComposition?.fatPercent || '',
            visceralFat: client.bodyComposition?.visceralFat || '',
            muscleMassPercent: client.bodyComposition?.muscleMassPercent || '',
            rmr: client.bodyComposition?.rmr || '',
            bmi: client.bodyComposition?.bmi || '',
            bodyAge: client.bodyComposition?.bodyAge || '',
            tsfPercent: client.bodyComposition?.tsfPercent || '',

            // Ideal Body Comp
            idealWeight: client.idealBodyComposition?.weight || '',
            idealFatPercent: client.idealBodyComposition?.fatPercent || '',
            idealVisceralFat: client.idealBodyComposition?.visceralFat || '',
            idealMuscleMassPercent: client.idealBodyComposition?.muscleMassPercent || '',
            idealRmr: client.idealBodyComposition?.rmr || '',
            idealBmi: client.idealBodyComposition?.bmi || '',
            idealBodyAge: client.idealBodyComposition?.bodyAge || '',
            idealTsfPercent: client.idealBodyComposition?.tsfPercent || '',

            referrer: client.referrer || '',
            referrerMobile: client.referrerMobile || '',
            pack: client.pack || '',
            packPrice: client.packPrice || 0,
            status: client.status || 'active',
            pipelineStage: client.pipelineStage || 'New',
            initialPayment: { amount: '', type: 'Cash', notes: '' } // Don't pre-fill payment for edit usually, or fetch if needed
        });
        setShowAddClient(true);
    };

    const updateClientStatus = async (id, status, stage) => {
        try {
            await api.put(`/coach/customers/${id}`, { status, pipelineStage: stage });
            fetchData();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    // --- Sub-Components ---

    const Sidebar = () => (
        <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 border-r border-slate-800">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    PulseIQ
                </h1>
                <p className="text-xs text-slate-400 mt-1">Coach Command Center</p>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {[
                    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                    { id: 'clients', icon: Users, label: 'My Clients' },
                    { id: 'crm', icon: UserPlus, label: 'CRM & Leads' },
                    { id: 'analytics', icon: PieChart, label: 'Analytics' },
                    { id: 'nutrition', icon: Utensils, label: 'Nutrition' },
                    { id: 'marketing', icon: Megaphone, label: 'Marketing' },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center w-full p-3 rounded-lg transition-all ${activeTab === item.id
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
                        {user?.name?.charAt(0)}
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-slate-400">Coach</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 justify-start text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => setShowProfile(true)}>
                        <User className="w-4 h-4 mr-2" /> Profile
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={logout}>
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );

    const EmbeddedNav = () => (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-800">
            {[
                { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                { id: 'clients', icon: Users, label: 'My Clients' },
                { id: 'crm', icon: UserPlus, label: 'CRM' },
                { id: 'analytics', icon: PieChart, label: 'Analytics' },
                { id: 'nutrition', icon: Utensils, label: 'Nutrition' },
                { id: 'marketing', icon: Megaphone, label: 'Marketing' },
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === item.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
            {!isEmbedded && <Sidebar />}

            <main className={`flex-1 ${!isEmbedded ? 'md:ml-64' : ''} p-8 overflow-y-auto h-screen`}>
                <div className="max-w-7xl mx-auto">
                    {isEmbedded && <EmbeddedNav />}
                    <header className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                {activeTab === 'overview' && 'Dashboard Overview'}
                                {activeTab === 'clients' && 'My Clients'}
                                {activeTab === 'crm' && 'CRM & Lead Management'}
                                {activeTab === 'analytics' && 'Business Analytics'}
                                {activeTab === 'nutrition' && 'Local Food Library'}
                                {activeTab === 'marketing' && 'Marketing Tools'}
                            </h1>
                            <p className="text-slate-400 mt-1">Welcome back, {user?.name}</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                <Bell className="w-4 h-4" />
                            </Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                                setEditingClient(null);
                                setFormData({
                                    name: '', mobile: '', age: '', gender: 'Female', joinedDate: new Date().toISOString().split('T')[0],
                                    height: '', weight: '', fatPercent: '', visceralFat: '', muscleMassPercent: '', rmr: '', bmi: '', bodyAge: '', tsfPercent: '',
                                    idealWeight: '', idealFatPercent: '', idealVisceralFat: '', idealMuscleMassPercent: '', idealRmr: '', idealBmi: '', idealBodyAge: '', idealTsfPercent: '',
                                    referrer: '', referrerMobile: '', pack: '', packPrice: 0, status: 'active', pipelineStage: 'New',
                                    initialPayment: { amount: '', type: 'Cash', notes: '' }
                                });
                                setShowAddClient(true);
                            }}>
                                <UserPlus className="w-4 h-4 mr-2" /> Add Client
                            </Button>
                        </div>
                    </header>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'overview' && <Overview stats={stats} />}
                            {activeTab === 'clients' && <Clients clients={clients} fetchData={fetchData} setSelectedClient={setSelectedClient} selectedClient={selectedClient} handleMarkAttendance={handleMarkAttendance} handleDeleteClient={handleDeleteClient} setCheckInData={setCheckInData} setShowCheckInModal={setShowCheckInModal} setRenewData={setRenewData} setShowRenewModal={setShowRenewModal} updateClientStatus={updateClientStatus} openEditClientModal={openEditClientModal} />}
                            {activeTab === 'crm' && (() => { console.log('Mounting CRM'); return <CRM clients={clients} setClients={setClients} setShowAddClient={setShowAddClient} updateClientStatus={updateClientStatus} />; })()}
                            {activeTab === 'analytics' && <Analytics stats={stats} />}
                            {activeTab === 'nutrition' && <FoodLibrary clients={clients} />}
                            {activeTab === 'marketing' && <SuccessStoryGenerator clients={clients} user={user} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* Add Client Modal */}
            {showAddClient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{editingClient ? 'Edit Client Details' : 'Add New Client / Lead'}</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowAddClient(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleAddClient} className="space-y-6">

                            {/* Personal Details Section */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Personal Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        placeholder="Full Name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                    <Input
                                        placeholder="Mobile Number"
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        placeholder="Age"
                                        type="number"
                                        value={formData.age}
                                        onChange={e => setFormData({ ...formData, age: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm w-full focus:border-indigo-500 outline-none transition-colors"
                                        value={formData.gender}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                    >
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        placeholder="Referrer Name"
                                        value={formData.referrer}
                                        onChange={e => setFormData({ ...formData, referrer: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                    <Input
                                        placeholder="Referrer Mobile"
                                        value={formData.referrerMobile}
                                        onChange={e => setFormData({ ...formData, referrerMobile: e.target.value })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500">Joined:</span>
                                        <Input
                                            type="date"
                                            value={formData.joinedDate}
                                            onChange={e => setFormData({ ...formData, joinedDate: e.target.value })}
                                            className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors pl-16"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Input
                                            placeholder="Height"
                                            type="number"
                                            value={formData.height}
                                            onChange={e => setFormData({ ...formData, height: e.target.value })}
                                            className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs text-slate-500">cm</span>
                                    </div>
                                </div>
                            </div>

                            {/* Body Composition Section */}
                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Body Composition (Current vs Ideal)</h4>

                                {/* Header Row */}
                                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 uppercase font-bold text-center">
                                    <div>Metric</div>
                                    <div>Current</div>
                                    <div>Ideal</div>
                                </div>

                                {/* Weight */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">Weight (kg)</label>
                                    <Input type="number" placeholder="Curr" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealWeight} onChange={e => setFormData({ ...formData, idealWeight: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* Fat % */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">Fat %</label>
                                    <Input type="number" placeholder="Curr" value={formData.fatPercent} onChange={e => setFormData({ ...formData, fatPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealFatPercent} onChange={e => setFormData({ ...formData, idealFatPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* Visceral Fat */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">Visceral Fat</label>
                                    <Input type="number" placeholder="Curr" value={formData.visceralFat} onChange={e => setFormData({ ...formData, visceralFat: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealVisceralFat} onChange={e => setFormData({ ...formData, idealVisceralFat: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* RMR */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">RMR</label>
                                    <Input type="number" placeholder="Curr" value={formData.rmr} onChange={e => setFormData({ ...formData, rmr: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealRmr} onChange={e => setFormData({ ...formData, idealRmr: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* BMI */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">BMI</label>
                                    <Input type="number" placeholder="Curr" value={formData.bmi} onChange={e => setFormData({ ...formData, bmi: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealBmi} onChange={e => setFormData({ ...formData, idealBmi: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* TSF % */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">TSF %</label>
                                    <Input type="number" placeholder="Curr" value={formData.tsfPercent} onChange={e => setFormData({ ...formData, tsfPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealTsfPercent} onChange={e => setFormData({ ...formData, idealTsfPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* Muscle Mass % */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">Muscle Mass %</label>
                                    <Input type="number" placeholder="Curr" value={formData.muscleMassPercent} onChange={e => setFormData({ ...formData, muscleMassPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealMuscleMassPercent} onChange={e => setFormData({ ...formData, idealMuscleMassPercent: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* Body Age */}
                                <div className="grid grid-cols-3 gap-2 items-center">
                                    <label className="text-xs text-slate-400">Body Age</label>
                                    <Input type="number" placeholder="Curr" value={formData.bodyAge} onChange={e => setFormData({ ...formData, bodyAge: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                    <Input type="number" placeholder="Ideal" value={formData.idealBodyAge} onChange={e => setFormData({ ...formData, idealBodyAge: e.target.value })} className="h-8 bg-slate-800 border-slate-700 text-white text-xs" />
                                </div>

                                {/* Target Display (Auto Calculated) */}
                                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                                    <h5 className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Target Goals (To Lose/Gain)</h5>
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div>
                                            <p className="text-[10px] text-slate-500">Weight</p>
                                            <p className="text-xs font-bold text-white">{calculateTarget('weight')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500">Fat %</p>
                                            <p className="text-xs font-bold text-white">{calculateTarget('fatPercent')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500">Visceral</p>
                                            <p className="text-xs font-bold text-white">{calculateTarget('visceralFat')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500">Muscle %</p>
                                            <p className="text-xs font-bold text-white">{calculateTarget('muscleMassPercent')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Membership Section */}
                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Membership & Status</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm w-full focus:border-indigo-500 outline-none transition-colors"
                                        value={formData.pack}
                                        onChange={e => setFormData({ ...formData, pack: e.target.value })}
                                    >
                                        <option value="">Select Pack</option>
                                        <option value="30 Days Shake Pack">30 Days Shake Pack</option>
                                        <option value="26 Days Shake Pack">26 Days Shake Pack</option>
                                        <option value="3 Days Trial Pack">3 Days Trial Pack</option>
                                        <option value="Hot Drink Pack (30 Days)">Hot Drink Pack (30 Days)</option>
                                        <option value="Coach Self-Use">Coach Self-Use</option>
                                    </select>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500">₹</span>
                                        <Input
                                            placeholder="Price"
                                            type="number"
                                            value={formData.packPrice}
                                            onChange={e => setFormData({ ...formData, packPrice: e.target.value })}
                                            className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors pl-6"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none transition-colors"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Active Client</option>
                                        <option value="lead">Lead</option>
                                        <option value="trial">Trial</option>
                                    </select>
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none transition-colors"
                                        value={formData.pipelineStage}
                                        onChange={e => setFormData({ ...formData, pipelineStage: e.target.value })}
                                    >
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Trial">Trial</option>
                                        <option value="Converted">Converted</option>
                                    </select>
                                </div>
                            </div>

                            {/* Initial Payment Section */}
                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Initial Payment (Optional)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500">₹</span>
                                        <Input
                                            placeholder="Amount"
                                            type="number"
                                            value={formData.initialPayment.amount}
                                            onChange={e => setFormData({ ...formData, initialPayment: { ...formData.initialPayment, amount: e.target.value } })}
                                            className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors pl-6"
                                        />
                                    </div>
                                    <select
                                        className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none transition-colors"
                                        value={formData.initialPayment.type}
                                        onChange={e => setFormData({ ...formData, initialPayment: { ...formData.initialPayment, type: e.target.value } })}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                    <Input
                                        placeholder="Notes (e.g. GPay)"
                                        value={formData.initialPayment.notes}
                                        onChange={e => setFormData({ ...formData, initialPayment: { ...formData.initialPayment, notes: e.target.value } })}
                                        className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-2.5 shadow-lg shadow-indigo-900/20">
                                {editingClient ? 'Update Client Profile' : 'Save Client Profile'}
                            </Button>

                            {editingClient && (
                                <div className="pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400"
                                        onClick={() => {
                                            if (window.confirm("Are you sure you want to permanently delete this client? This action cannot be undone.")) {
                                                handleDeleteClient(); // Note: handleDeleteClient uses selectedClient, ensure it matches editingClient or pass ID
                                                setShowAddClient(false);
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Permanently Delete Client
                                    </Button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Coach Profile</h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setIsEditingProfile(!isEditingProfile);
                                        if (!isEditingProfile) setProfileFormData(profile || user);
                                    }}
                                    className={isEditingProfile ? "text-indigo-400" : "text-slate-400"}
                                >
                                    {isEditingProfile ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setShowProfile(false)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-center mb-6">
                                <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white">
                                    {profile?.name?.charAt(0) || user?.name?.charAt(0)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Full Name</label>
                                    {isEditingProfile ? (
                                        <Input
                                            value={profileFormData.name || ''}
                                            onChange={e => setProfileFormData({ ...profileFormData, name: e.target.value })}
                                            className="bg-slate-800 border-slate-700 text-white"
                                        />
                                    ) : (
                                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-white text-sm">
                                            {profile?.name || user?.name}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Mobile Number</label>
                                    {isEditingProfile ? (
                                        <Input
                                            value={profileFormData.mobile || ''}
                                            onChange={e => setProfileFormData({ ...profileFormData, mobile: e.target.value })}
                                            className="bg-slate-800 border-slate-700 text-white"
                                        />
                                    ) : (
                                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-white text-sm">
                                            {profile?.mobile || user?.mobile}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 uppercase font-bold">Role</label>
                                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-white capitalize text-sm">
                                    {user?.role}
                                </div>
                            </div>

                            {/* Upline Details */}
                            <div className="pt-4 border-t border-slate-800">
                                <h4 className="text-sm font-semibold text-slate-300 mb-3">Upline Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold">Upline Name</label>
                                        {isEditingProfile ? (
                                            <Input
                                                value={profileFormData.uplineCoachName || ''}
                                                onChange={e => setProfileFormData({ ...profileFormData, uplineCoachName: e.target.value })}
                                                className="bg-slate-800 border-slate-700 text-white"
                                            />
                                        ) : (
                                            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-white text-sm">
                                                {profile?.uplineCoachName || 'N/A'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold">Upline Mobile</label>
                                        {isEditingProfile ? (
                                            <Input
                                                value={profileFormData.uplineCoachMobile || ''}
                                                onChange={e => setProfileFormData({ ...profileFormData, uplineCoachMobile: e.target.value })}
                                                className="bg-slate-800 border-slate-700 text-white"
                                            />
                                        ) : (
                                            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-white text-sm">
                                                {profile?.uplineCoachMobile || 'N/A'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Self Register Button or Save Button */}
                            <div className="pt-4 border-t border-slate-800">
                                {isEditingProfile ? (
                                    <Button
                                        onClick={handleUpdateProfile}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Save Changes
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            onClick={handleSelfRegister}
                                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                                        >
                                            Register as Customer (Self-Use)
                                        </Button>
                                        <p className="text-[10px] text-slate-500 text-center mt-2">
                                            This will create a customer profile for you to track your own health stats.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Check-in Modal */}
            {showCheckInModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">New Body Composition Check-in</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowCheckInModal(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleCheckInSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Weight (kg)</label>
                                    <Input type="number" placeholder="Weight" value={checkInData.weight} onChange={e => setCheckInData({ ...checkInData, weight: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Fat %</label>
                                    <Input type="number" placeholder="Fat %" value={checkInData.fatPercent} onChange={e => setCheckInData({ ...checkInData, fatPercent: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Visceral Fat</label>
                                    <Input type="number" placeholder="Visceral Fat" value={checkInData.visceralFat} onChange={e => setCheckInData({ ...checkInData, visceralFat: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Muscle Mass %</label>
                                    <Input type="number" placeholder="Muscle Mass %" value={checkInData.muscleMassPercent} onChange={e => setCheckInData({ ...checkInData, muscleMassPercent: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">RMR (kcal)</label>
                                    <Input type="number" placeholder="RMR" value={checkInData.rmr} onChange={e => setCheckInData({ ...checkInData, rmr: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">BMI</label>
                                    <Input type="number" placeholder="BMI" value={checkInData.bmi} onChange={e => setCheckInData({ ...checkInData, bmi: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">TSF %</label>
                                    <Input type="number" placeholder="TSF %" value={checkInData.tsfPercent} onChange={e => setCheckInData({ ...checkInData, tsfPercent: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase font-bold">Body Age</label>
                                    <Input type="number" placeholder="Body Age" value={checkInData.bodyAge} onChange={e => setCheckInData({ ...checkInData, bodyAge: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                Save Check-in
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Renew Modal */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Renew Membership</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowRenewModal(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <form onSubmit={handleRenewSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Select Pack</label>
                                <select
                                    className="bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm w-full focus:border-indigo-500 outline-none"
                                    value={renewData.pack}
                                    onChange={e => setRenewData({ ...renewData, pack: e.target.value })}
                                >
                                    <option value="">Select Pack</option>
                                    <option value="30 Days Shake Pack">30 Days Shake Pack</option>
                                    <option value="26 Days Shake Pack">26 Days Shake Pack</option>
                                    <option value="3 Days Trial Pack">3 Days Trial Pack</option>
                                    <option value="Hot Drink Pack (30 Days)">Hot Drink Pack (30 Days)</option>
                                    <option value="Coach Self-Use">Coach Self-Use</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Pack Price</label>
                                <Input
                                    type="number"
                                    value={renewData.packPrice}
                                    onChange={e => setRenewData({ ...renewData, packPrice: e.target.value })}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                                Confirm Renewal
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Component Definitions (moved outside main component for proper hoisting)

function StatCard({ title, value, icon: Icon, color, bg }) {
    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-400">{title}</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${bg}`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function Overview({ stats }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Clients"
                    value={stats.totalClients}
                    icon={Users}
                    color="text-indigo-400"
                    bg="bg-indigo-400/10"
                />
                <StatCard
                    title="Active Clients"
                    value={stats.totalClients}
                    icon={Activity}
                    color="text-emerald-400"
                    bg="bg-emerald-400/10"
                />
                <StatCard
                    title="Total Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString()}`}
                    icon={IndianRupee}
                    color="text-amber-400"
                    bg="bg-amber-400/10"
                />
                <StatCard
                    title="Monthly Growth"
                    value={`${stats.monthlyGrowth}%`}
                    icon={TrendingUp}
                    color="text-rose-400"
                    bg="bg-rose-400/10"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[
                                { name: 'Jan', value: 4000 },
                                { name: 'Feb', value: 3000 },
                                { name: 'Mar', value: 2000 },
                                { name: 'Apr', value: 2780 },
                                { name: 'May', value: 1890 },
                                { name: 'Jun', value: 2390 },
                            ]}>
                                <defs>
                                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorPv)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white font-medium">New client added</p>
                                        <p className="text-xs text-slate-400">2 hours ago</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const Clients = ({
    clients = [],
    fetchData,
    selectedClient,
    setSelectedClient,
    handleMarkAttendance,
    handleDeleteClient,
    setCheckInData,
    setShowCheckInModal,
    setRenewData,
    setShowRenewModal,
    updateClientStatus,
    openEditClientModal
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const statusCounts = useMemo(() => ({
        active: clients.filter(c => c.status === 'active').length,
        lead: clients.filter(c => c.status === 'lead').length,
        trial: clients.filter(c => c.status === 'trial').length,
        inactive: clients.filter(c => c.status === 'inactive').length,
    }), [clients]);

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => {
                const matchesSearch =
                    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.mobile?.includes(searchTerm);
                const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [clients, searchTerm, statusFilter]);

    useEffect(() => {
        if (!selectedClient && filteredClients.length) {
            setSelectedClient(filteredClients[0]);
        } else if (selectedClient) {
            // Find the updated version of the selected client in the new list
            const updatedClient = clients.find(c => c._id === selectedClient._id);
            if (updatedClient) {
                // If the client still exists (even if filtered out), update the selection to the new object
                // This ensures status changes are reflected immediately
                if (updatedClient !== selectedClient) {
                    setSelectedClient(updatedClient);
                }
            } else if (filteredClients.length) {
                // If client was deleted, select the first one in the filtered list
                setSelectedClient(filteredClients[0]);
            } else {
                setSelectedClient(null);
            }
        }
    }, [clients, filteredClients, selectedClient, setSelectedClient]);

    const openCheckInModal = () => {
        if (!selectedClient) return;
        setCheckInData({
            weight: selectedClient.bodyComposition?.weight || '',
            fatPercent: selectedClient.bodyComposition?.fatPercent || '',
            visceralFat: selectedClient.bodyComposition?.visceralFat || '',
            muscleMassPercent: selectedClient.bodyComposition?.muscleMassPercent || '',
            rmr: selectedClient.bodyComposition?.rmr || '',
            bmi: selectedClient.bodyComposition?.bmi || '',
            bodyAge: selectedClient.bodyComposition?.bodyAge || '',
            tsfPercent: selectedClient.bodyComposition?.tsfPercent || '',
        });
        setShowCheckInModal(true);
    };

    const openRenewModal = () => {
        if (!selectedClient) return;
        setRenewData({
            pack: selectedClient.pack || '',
            packPrice: selectedClient.packPrice || 0,
        });
        setShowRenewModal(true);
    };

    const renderBodyMetric = (label, current, ideal, suffix = '') => (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-lg font-semibold text-white">
                {current ?? '-'}{current !== undefined && current !== null ? suffix : ''}
            </p>
            {ideal !== undefined && ideal !== null ? (
                <p className="text-xs text-slate-500">Ideal: {ideal}{suffix}</p>
            ) : null}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Total Clients</p>
                        <p className="text-2xl font-bold text-white mt-1">{clients.length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Active</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{statusCounts.active}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Leads</p>
                        <p className="text-2xl font-bold text-indigo-400 mt-1">{statusCounts.lead}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Trials</p>
                        <p className="text-2xl font-bold text-amber-400 mt-1">{statusCounts.trial}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Inactive</p>
                        <p className="text-2xl font-bold text-slate-500 mt-1">{statusCounts.inactive}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-[320px,1fr] gap-6">
                <Card className="bg-slate-900 border-slate-800 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center justify-between">
                            <span>Client Roster</span>
                            <span className="text-xs text-slate-500">{filteredClients.length} shown</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name or mobile"
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="lead">Lead</option>
                            <option value="trial">Trial</option>
                            <option value="inactive">Inactive</option>
                        </select>

                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredClients.length === 0 && (
                                <div className="text-center text-slate-500 text-sm py-8">
                                    No clients match this filter.
                                </div>
                            )}
                            {filteredClients.map(client => {
                                const isActive = selectedClient?._id === client._id;
                                return (
                                    <button
                                        key={client._id}
                                        onClick={() => setSelectedClient(client)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all ${isActive
                                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-900/20'
                                            : 'border-slate-800 bg-slate-800/50 hover:border-slate-600'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-semibold">{client.name}</p>
                                                <p className="text-xs text-slate-400">{client.mobile}</p>
                                            </div>
                                            <span className={`text-[10px] uppercase px-2 py-1 rounded-full ${client.status === 'active'
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : client.status === 'lead'
                                                    ? 'bg-indigo-500/20 text-indigo-300'
                                                    : 'bg-amber-500/20 text-amber-300'
                                                }`}>
                                                {client.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
                                            <span>Pack: {client.pack || 'N/A'}</span>
                                            <span>Joined: {client.date ? new Date(client.date).toLocaleDateString() : '-'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {selectedClient ? (
                        <>
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-white">{selectedClient.name}</CardTitle>
                                        <CardDescription className="text-slate-400">
                                            {selectedClient.pack || 'No pack selected'}
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 uppercase">Status</p>
                                        <p className="text-sm font-semibold text-white capitalize">{selectedClient.status}</p>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-indigo-600 hover:bg-indigo-700 w-full"
                                            onClick={() => handleMarkAttendance(selectedClient._id)}
                                        >
                                            <Calendar className="w-4 h-4 mr-2" /> Mark Attendance
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-slate-700 text-slate-200"
                                            onClick={openCheckInModal}
                                        >
                                            <Activity className="w-4 h-4 mr-2" /> Log Check-in
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-slate-700 text-slate-200"
                                            onClick={openRenewModal}
                                        >
                                            <RefreshCw className="w-4 h-4 mr-2" /> Renew Pack
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-slate-700 text-slate-200"
                                            onClick={() => {
                                                const newStatus = selectedClient.status === 'inactive' ? 'active' : 'inactive';
                                                if (window.confirm(`Are you sure you want to mark this client as ${newStatus}?`)) {
                                                    updateClientStatus(selectedClient._id, newStatus, selectedClient.pipelineStage);
                                                }
                                            }}
                                        >
                                            {selectedClient.status === 'inactive' ? (
                                                <><CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> Reactivate</>
                                            ) : (
                                                <><XCircle className="w-4 h-4 mr-2 text-slate-400" /> Mark Inactive</>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
                                            onClick={() => openEditClientModal(selectedClient)}
                                        >
                                            <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                                        </Button>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Mobile</p>
                                            <p className="text-white font-medium">{selectedClient.mobile}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Pipeline Stage</p>
                                            <p className="text-white font-medium">{selectedClient.pipelineStage || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Referrer</p>
                                            <p className="text-white font-medium">{selectedClient.referrer || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Membership Value</p>
                                            <p className="text-white font-medium">₹{selectedClient.packPrice || 0}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {renderBodyMetric(
                                    'Weight',
                                    selectedClient.bodyComposition?.weight,
                                    selectedClient.idealBodyComposition?.weight,
                                    ' kg'
                                )}
                                {renderBodyMetric(
                                    'Body Fat %',
                                    selectedClient.bodyComposition?.fatPercent,
                                    selectedClient.idealBodyComposition?.fatPercent,
                                    '%'
                                )}
                                {renderBodyMetric(
                                    'Visceral Fat',
                                    selectedClient.bodyComposition?.visceralFat,
                                    selectedClient.idealBodyComposition?.visceralFat
                                )}
                                {renderBodyMetric(
                                    'Muscle Mass %',
                                    selectedClient.bodyComposition?.muscleMassPercent,
                                    selectedClient.idealBodyComposition?.muscleMassPercent,
                                    '%'
                                )}
                                {renderBodyMetric(
                                    'RMR',
                                    selectedClient.bodyComposition?.rmr,
                                    selectedClient.idealBodyComposition?.rmr,
                                    ' kcal'
                                )}
                                {renderBodyMetric(
                                    'BMI',
                                    selectedClient.bodyComposition?.bmi,
                                    selectedClient.idealBodyComposition?.bmi
                                )}
                                {renderBodyMetric(
                                    'TSF %',
                                    selectedClient.bodyComposition?.tsfPercent,
                                    selectedClient.idealBodyComposition?.tsfPercent,
                                    '%'
                                )}
                                {renderBodyMetric(
                                    'Body Age',
                                    selectedClient.bodyComposition?.bodyAge,
                                    selectedClient.idealBodyComposition?.bodyAge,
                                    ' years'
                                )}
                            </div>

                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Attendance & Payments</CardTitle>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase mb-2">Recent Attendance</p>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                            {(selectedClient.attendance || []).slice().reverse().map((entry, idx) => (
                                                <div key={idx} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white">
                                                    {new Date(entry).toLocaleString()}
                                                </div>
                                            ))}
                                            {(!selectedClient.attendance || selectedClient.attendance.length === 0) && (
                                                <p className="text-xs text-slate-500">No attendance yet.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase mb-2">Payment History</p>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                            {(selectedClient.payments || []).slice().reverse().map((p, idx) => (
                                                <div key={idx} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white flex items-center justify-between">
                                                    <span>₹{p.amount}</span>
                                                    <span className="text-xs text-slate-400">{new Date(p.date).toLocaleDateString()}</span>
                                                </div>
                                            ))}
                                            {(!selectedClient.payments || selectedClient.payments.length === 0) && (
                                                <p className="text-xs text-slate-500">No payments recorded.</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card className="bg-slate-900 border-slate-800 flex items-center justify-center h-full min-h-[320px]">
                            <CardContent className="text-center space-y-3">
                                <Users className="w-10 h-10 mx-auto text-slate-600" />
                                <p className="text-white font-semibold">No client selected</p>
                                <p className="text-slate-400 text-sm">Choose a client from the list to view details.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

const CRM = ({ clients, setClients, setShowAddClient, updateClientStatus }) => {
    const [viewMode, setViewMode] = useState('my');
    const [teamLeads, setTeamLeads] = useState([]);
    const stages = ['New', 'Contacted', 'Trial', 'Converted'];

    useEffect(() => {
        if (viewMode === 'team' && teamLeads.length === 0) {
            fetchTeamLeads();
        }
    }, [viewMode]);

    const fetchTeamLeads = async () => {
        try {
            const { data } = await api.get('/coach/network-leads');
            setTeamLeads(data);
        } catch (error) {
            console.error("Failed to fetch team leads", error);
        }
    };

    const displayLeads = viewMode === 'my'
        ? (Array.isArray(clients) ? clients.filter(c => c.status === 'lead' || c.status === 'trial' || c.status === 'active') : [])
        : teamLeads;

    const handleFollowUpToggle = async (leadId, day, currentValue) => {
        const updateList = (list) =>
            list.map(l =>
                l._id === leadId
                    ? { ...l, followUp: { ...l.followUp, [day]: !currentValue } }
                    : l
            );

        if (viewMode === 'my') setClients(prev => updateList(prev));
        else setTeamLeads(prev => updateList(prev));

        try {
            await api.put(`/coach/customers/${leadId}`, { followUp: { [day]: !currentValue } });
        } catch (error) {
            console.error("Failed to update follow-up", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Lead Pipeline</h2>
                <div className="flex gap-3">
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
                        <button
                            onClick={() => setViewMode('my')}
                            className={`px-4 py-1.5 text-sm rounded-md transition-all ${viewMode === 'my' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            My Leads
                        </button>
                        <button
                            onClick={() => setViewMode('team')}
                            className={`px-4 py-1.5 text-sm rounded-md transition-all ${viewMode === 'team' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Team Leads
                        </button>
                    </div>
                    <Button onClick={() => setShowAddClient(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <UserPlus className="w-4 h-4 mr-2" /> Add Lead
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto">
                {stages.map(stage => (
                    <div key={stage} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 min-w-[250px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-slate-300">{stage}</h3>
                            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
                                {displayLeads.filter(l => l.pipelineStage === stage).length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {displayLeads.filter(l => l.pipelineStage === stage).map(lead => (
                                <motion.div
                                    layoutId={lead._id}
                                    key={lead._id}
                                    className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm hover:border-indigo-500/50 cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-white">{lead.name}</h4>
                                            <p className="text-xs text-slate-400">{lead.pack || lead.pipelineStage}</p>
                                            {viewMode === 'team' && lead.coach && (
                                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                                    Ref: {lead.coach.name}
                                                </span>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 opacity-0 group-hover:opacity-100">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{lead.mobile}</p>

                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">3-Day Follow-up</p>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(day => {
                                                const key = `day${day}`;
                                                const isChecked = lead.followUp?.[key];
                                                return (
                                                    <div key={day} className="flex items-center gap-1">
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFollowUpToggle(lead._id, key, isChecked);
                                                            }}
                                                            className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isChecked
                                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                : 'border-slate-600 hover:border-slate-500'
                                                                }`}
                                                        >
                                                            {isChecked && <Check className="w-3 h-3" />}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">D{day}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-3">
                                        <Button size="xs" variant="outline" className="h-7 text-xs border-slate-600 text-slate-300 hover:bg-slate-700">
                                            <Phone className="w-3 h-3 mr-1" /> Call
                                        </Button>
                                        {stage !== 'Converted' && (
                                            <Button
                                                size="xs"
                                                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 ml-auto"
                                                onClick={() => {
                                                    const nextStage = stages[stages.indexOf(stage) + 1];
                                                    if (nextStage) updateClientStatus(lead._id, lead.status, nextStage);
                                                }}
                                            >
                                                Move <ChevronRight className="w-3 h-3 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

function Analytics({ stats }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Client Growth</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Jan', value: 10 },
                                { name: 'Feb', value: 15 },
                                { name: 'Mar', value: 25 },
                                { name: 'Apr', value: stats.totalClients }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Revenue Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <p className="text-slate-500">No data available</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const SuccessStoryGenerator = ({ clients, user }) => {
    const [storyData, setStoryData] = useState({
        clientId: '',
        beforeImage: null,
        afterImage: null,
        caption: 'Transforming lives, one day at a time! 💪✨ #PulseIQ #Transformation',
        showPreview: false,
    });

    const handleImageUpload = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setStoryData(prev => ({ ...prev, [field]: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const selectedClientDetails = (clients || []).find(c => c._id === storyData.clientId);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Success Story Generator</h2>
                <Button variant="outline" className="border-slate-700 text-slate-300">
                    <Share2 className="w-4 h-4 mr-2" /> Share History
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Controls */}
                <Card className="bg-slate-900 border-slate-800 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white">Create New Story</CardTitle>
                        <CardDescription>Select a client and upload photos to generate a poster.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Select Client</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={storyData.clientId}
                                onChange={(e) => setStoryData(prev => ({ ...prev, clientId: e.target.value }))}
                            >
                                <option value="">-- Choose a Client --</option>
                                {(clients || []).map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">Before Photo</label>
                                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => handleImageUpload(e, 'beforeImage')}
                                    />
                                    {storyData.beforeImage ? (
                                        <img src={storyData.beforeImage} alt="Before" className="w-full h-24 object-cover rounded" />
                                    ) : (
                                        <div className="py-4">
                                            <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                                            <span className="text-xs text-slate-500">Upload</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400">After Photo</label>
                                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => handleImageUpload(e, 'afterImage')}
                                    />
                                    {storyData.afterImage ? (
                                        <img src={storyData.afterImage} alt="After" className="w-full h-24 object-cover rounded" />
                                    ) : (
                                        <div className="py-4">
                                            <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                                            <span className="text-xs text-slate-500">Upload</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Caption</label>
                            <textarea
                                className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                value={storyData.caption}
                                onChange={(e) => setStoryData(prev => ({ ...prev, caption: e.target.value }))}
                            />
                        </div>

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                            <Download className="w-4 h-4 mr-2" /> Download Poster
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview */}
                <div className="flex flex-col items-center">
                    <h3 className="text-slate-400 mb-4 text-sm uppercase tracking-wider font-semibold">Live Preview</h3>
                    <div className="w-[320px] bg-white rounded-xl overflow-hidden shadow-2xl relative aspect-[9/16] flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-center">
                            <h2 className="text-white font-bold text-xl tracking-tight">TRANSFORMATION</h2>
                            <p className="text-indigo-100 text-xs uppercase tracking-widest">Tuesday</p>
                        </div>

                        {/* Images */}
                        <div className="flex-1 grid grid-cols-2 gap-0.5 bg-white">
                            <div className="relative h-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                {storyData.beforeImage ? (
                                    <img src={storyData.beforeImage} alt="Before" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-slate-300 text-xs">Before</span>
                                )}
                                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">BEFORE</div>
                            </div>
                            <div className="relative h-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                {storyData.afterImage ? (
                                    <img src={storyData.afterImage} alt="After" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-slate-300 text-xs">After</span>
                                )}
                                <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded">AFTER</div>
                            </div>
                        </div>

                        {/* Stats Overlay (Optional) */}
                        {selectedClientDetails && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-indigo-100">
                                <p className="text-indigo-900 font-bold text-sm">
                                    {selectedClientDetails.bodyComposition?.weight ? `-${(selectedClientDetails.bodyComposition.weight * 0.1).toFixed(1)} kg` : 'Amazing Result!'} 🔥
                                </p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="bg-slate-900 p-4 text-white">
                            <p className="text-sm font-medium mb-2 line-clamp-2 opacity-90">{storyData.caption}</p>
                            <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs mr-2">
                                        {user?.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold">{user?.name}</p>
                                        <p className="text-[10px] text-slate-400">Wellness Coach</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-indigo-400">PulseIQ</p>
                                    <p className="text-[10px] text-slate-500">Join the revolution</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function FoodLibrary({ clients }) {
    const [foods, setFoods] = useState([]);
    const [showAddFood, setShowAddFood] = useState(false);
    const [editingFood, setEditingFood] = useState(null);
    const [newFood, setNewFood] = useState({
        name: '',
        category: 'Breakfast',
        type: 'Recommended',
        image: '',
        description: ''
    });

    // Assignment State
    const [assigningFood, setAssigningFood] = useState(null);
    const [selectedClients, setSelectedClients] = useState([]);
    const [assignmentType, setAssignmentType] = useState('recommended');
    const [assignLoading, setAssignLoading] = useState(false);

    useEffect(() => {
        fetchFoods();
    }, []);

    const fetchFoods = async () => {
        try {
            const { data } = await api.get('/coach/foods');
            setFoods(data);
        } catch (error) {
            console.error("Failed to fetch foods", error);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewFood(prev => ({ ...prev, image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddFood = async () => {
        try {
            if (editingFood) {
                const { data } = await api.put(`/coach/foods/${editingFood._id}`, newFood);
                setFoods(prev => prev.map(f => f._id === editingFood._id ? data : f));
            } else {
                const { data } = await api.post('/coach/foods', newFood);
                setFoods(prev => [...prev, data]);
            }
            setShowAddFood(false);
            setEditingFood(null);
            setNewFood({ name: '', category: 'Breakfast', type: 'Recommended', image: '', description: '' });
        } catch (error) {
            console.error("Failed to save food", error);
        }
    };

    const handleEditFood = (food) => {
        setEditingFood(food);
        setNewFood(food);
        setShowAddFood(true);
    };

    const handleDeleteFood = async (foodId) => {
        if (!window.confirm('Are you sure you want to delete this food item?')) return;
        try {
            await api.delete(`/coach/foods/${foodId}`);
            setFoods(prev => prev.filter(f => f._id !== foodId));
        } catch (error) {
            console.error("Failed to delete food", error);
        }
    };

    // Assignment Functions
    const handleAssignClick = (food) => {
        setAssigningFood(food);
        setSelectedClients([]);
        setAssignmentType('recommended');
    };

    const toggleClientSelection = (clientId) => {
        setSelectedClients(prev =>
            prev.includes(clientId)
                ? prev.filter(id => id !== clientId)
                : [...prev, clientId]
        );
    };

    const handleAssignSubmit = async () => {
        if (!assigningFood || selectedClients.length === 0) return;

        setAssignLoading(true);
        try {
            await Promise.all(selectedClients.map(clientId =>
                api.post(`/coach/customers/${clientId}/diet-plan`, {
                    foodId: assigningFood._id,
                    type: assignmentType,
                    day: 'Monday', // Default or make selectable
                    meal: assigningFood.category // Default to food category
                })
            ));
            alert(`Assigned ${assigningFood.name} to ${selectedClients.length} clients!`);
            setAssigningFood(null);
            setSelectedClients([]);
        } catch (error) {
            console.error("Failed to assign food", error);
            alert("Failed to assign food to some clients.");
        } finally {
            setAssignLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Local Food Library</h2>
                <Button onClick={() => {
                    setEditingFood(null);
                    setNewFood({ name: '', category: 'Breakfast', type: 'Recommended', image: '', description: '' });
                    setShowAddFood(true);
                }} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Food Item
                </Button>
            </div>

            {/* Food Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {foods.map(food => (
                    <div key={food._id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all">
                        <div className="h-40 bg-slate-800 relative">
                            {food.image ? (
                                <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <Utensils className="w-8 h-8" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEditFood(food)}
                                    className="p-1.5 bg-slate-900/80 text-white rounded-md hover:bg-indigo-600"
                                    title="Edit"
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => handleDeleteFood(food._id)}
                                    className="p-1.5 bg-slate-900/80 text-white rounded-md hover:bg-red-600"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${food.type === 'Recommended' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {food.type}
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-white">{food.name}</h3>
                                    <p className="text-xs text-slate-400">{food.category}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 border-slate-700 text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                                onClick={() => handleAssignClick(food)}
                            >
                                <UserPlus className="w-3 h-3 mr-2" /> Assign to Client
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Food Modal */}
            {showAddFood && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{editingFood ? 'Edit Food Item' : 'Add New Food Item'}</h2>
                            <Button variant="ghost" size="icon" onClick={() => setShowAddFood(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 mb-1 block">Food Name</label>
                                <Input
                                    value={newFood.name}
                                    onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    placeholder="e.g., Oatmeal with Berries"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-slate-400 mb-1 block">Category</label>
                                    <select
                                        value={newFood.category}
                                        onChange={(e) => setNewFood({ ...newFood, category: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white text-sm"
                                    >
                                        {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Hydration'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 mb-1 block">Type</label>
                                    <select
                                        value={newFood.type}
                                        onChange={(e) => setNewFood({ ...newFood, type: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white text-sm"
                                    >
                                        <option value="Recommended">Recommended</option>
                                        <option value="Avoid">Avoid</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-1 block">Image</label>
                                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleImageUpload}
                                    />
                                    {newFood.image ? (
                                        <img src={newFood.image} alt="Preview" className="h-20 mx-auto rounded object-cover" />
                                    ) : (
                                        <div className="text-slate-500 text-xs">
                                            <Upload className="w-6 h-6 mx-auto mb-2" />
                                            Click to upload image
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button onClick={handleAddFood} className="w-full bg-indigo-600 hover:bg-indigo-700">
                                {editingFood ? 'Update Food Item' : 'Add Food Item'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Food Modal */}
            {assigningFood && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md h-[500px] flex flex-col">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white">Assign to Clients</h2>
                                <p className="text-sm text-slate-400">Assigning: <span className="text-white font-medium">{assigningFood.name}</span></p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setAssigningFood(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Assignment Type</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assignType"
                                        value="recommended"
                                        checked={assignmentType === 'recommended'}
                                        onChange={() => setAssignmentType('recommended')}
                                        className="accent-emerald-500"
                                    />
                                    <span className={assignmentType === 'recommended' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>Recommended</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assignType"
                                        value="avoid"
                                        checked={assignmentType === 'avoid'}
                                        onChange={() => setAssignmentType('avoid')}
                                        className="accent-red-500"
                                    />
                                    <span className={assignmentType === 'avoid' ? 'text-red-400 font-bold' : 'text-slate-400'}>Avoid</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-800 rounded-lg p-2 mb-4 bg-slate-950/50">
                            <div className="space-y-1">
                                {clients.filter(c => c.status === 'active').map(client => (
                                    <div
                                        key={client._id}
                                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedClients.includes(client._id) ? 'bg-indigo-500/20 border border-indigo-500/50' : 'hover:bg-slate-800'
                                            }`}
                                        onClick={() => toggleClientSelection(client._id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                                {client.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">{client.name}</p>
                                                <p className="text-[10px] text-slate-400">{client.pack || 'No Pack'}</p>
                                            </div>
                                        </div>
                                        {selectedClients.includes(client._id) && <Check className="w-4 h-4 text-indigo-400" />}
                                    </div>
                                ))}
                                {clients.filter(c => c.status === 'active').length === 0 && (
                                    <p className="text-center text-slate-500 py-4">No active clients found.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                            <p className="text-sm text-slate-400">
                                {selectedClients.length} client{selectedClients.length !== 1 && 's'} selected
                            </p>
                            <Button
                                onClick={handleAssignSubmit}
                                disabled={selectedClients.length === 0 || assignLoading}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function PaymentLedger({ client, onUpdate }) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('Cash');
    const [loading, setLoading] = useState(false);

    const handleAddPayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payment = { amount: Number(amount), date, type };
            await api.post(`/coach/customers/${client._id}/payments`, payment);
            alert("Payment added!");
            setAmount('');
            if (onUpdate) onUpdate({ ...client, payments: [...(client.payments || []), payment] });
        } catch (error) {
            alert("Failed to add payment");
        } finally {
            setLoading(false);
        }
    };

    const totalPaid = client.payments?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800 mt-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Payment Ledger (Khata)</span>
                <span className="text-emerald-400">Total: ₹{totalPaid}</span>
            </h3>

            {/* Add Payment Form */}
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                <Input
                    type="number"
                    placeholder="Amount (₹)"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-700 h-9 text-white"
                />
                <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-700 h-9 text-white"
                />
                <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 text-sm text-white h-9 outline-none"
                >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                </select>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" disabled={loading}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
            </form>

            {/* History List */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {client.payments?.slice().reverse().map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-slate-900 p-2 rounded border border-slate-800">
                        <div>
                            <p className="text-white font-medium">₹{p.amount}</p>
                            <p className="text-[10px] text-slate-500">{new Date(p.date).toLocaleDateString()} • {p.type}</p>
                        </div>
                        {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                    </div>
                ))}
                {(!client.payments || client.payments.length === 0) && (
                    <p className="text-center text-xs text-slate-500 py-2">No payments recorded yet.</p>
                )}
            </div>
        </div>
    );
}

function ClientDietPlan({ client }) {
    const [foods, setFoods] = useState([]);
    const [assignedRecommended, setAssignedRecommended] = useState([]);
    const [assignedAvoid, setAssignedAvoid] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchFoods();
        if (client.dietPlan) {
            setAssignedRecommended(client.dietPlan.recommended.map(f => f._id || f));
            setAssignedAvoid(client.dietPlan.avoid.map(f => f._id || f));
        }
    }, [client]);

    const fetchFoods = async () => {
        try {
            const { data } = await api.get('/foods');
            setFoods(data);
        } catch (error) {
            console.error("Failed to fetch foods", error);
        }
    };

    const handleSaveDiet = async () => {
        setLoading(true);
        try {
            await api.put(`/coach/customers/${client._id}`, {
                dietPlan: {
                    recommended: assignedRecommended,
                    avoid: assignedAvoid
                }
            });
            alert("Diet plan updated!");
        } catch (error) {
            alert("Failed to update diet plan");
        } finally {
            setLoading(false);
        }
    };

    const toggleAssignment = (foodId, type) => {
        if (type === 'recommended') {
            if (assignedRecommended.includes(foodId)) {
                setAssignedRecommended(prev => prev.filter(id => id !== foodId));
            } else {
                setAssignedRecommended(prev => [...prev, foodId]);
                setAssignedAvoid(prev => prev.filter(id => id !== foodId));
            }
        } else if (type === 'avoid') {
            if (assignedAvoid.includes(foodId)) {
                setAssignedAvoid(prev => prev.filter(id => id !== foodId));
            } else {
                setAssignedAvoid(prev => [...prev, foodId]);
                setAssignedRecommended(prev => prev.filter(id => id !== foodId));
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-white">Personalized Diet</h3>
                    <p className="text-sm text-slate-400">Assign specific foods for {client.name} to eat or avoid.</p>
                </div>
                <Button onClick={handleSaveDiet} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recommended Column */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30">
                    <h4 className="text-emerald-400 font-bold mb-4 flex items-center">
                        <Check className="w-4 h-4 mr-2" /> Recommended (Eat This)
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                        {foods.map(food => {
                            const isSelected = assignedRecommended.includes(food._id);
                            return (
                                <div
                                    key={food._id}
                                    onClick={() => toggleAssignment(food._id, 'recommended')}
                                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                                        ? 'bg-emerald-500/20 border-emerald-500'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="h-10 w-10 rounded bg-slate-700 overflow-hidden flex-shrink-0">
                                        {food.image ? <img src={food.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="p-2 text-slate-500" />}
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className={`text-sm font-medium ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>{food.name}</p>
                                        <p className="text-[10px] text-slate-500">{food.category}</p>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Avoid Column */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-red-500/30">
                    <h4 className="text-red-400 font-bold mb-4 flex items-center">
                        <X className="w-4 h-4 mr-2" /> Avoid (Don't Eat)
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                        {foods.map(food => {
                            const isSelected = assignedAvoid.includes(food._id);
                            return (
                                <div
                                    key={food._id}
                                    onClick={() => toggleAssignment(food._id, 'avoid')}
                                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                                        ? 'bg-red-500/20 border-red-500'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="h-10 w-10 rounded bg-slate-700 overflow-hidden flex-shrink-0">
                                        {food.image ? <img src={food.image} alt="" className="w-full h-full object-cover" /> : <Utensils className="p-2 text-slate-500" />}
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className={`text-sm font-medium ${isSelected ? 'text-red-300' : 'text-slate-300'}`}>{food.name}</p>
                                        <p className="text-[10px] text-slate-500">{food.category}</p>
                                    </div>
                                    {isSelected && <X className="w-4 h-4 text-red-400" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}



const CoachDashboard = () => <CoachView />;
export default CoachDashboard;

