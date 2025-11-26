import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { motion } from 'framer-motion';
import {
    Activity,
    Droplets,
    Utensils,
    Trophy,
    TrendingUp,
    LogOut,
    User,
    Bell,
    Scale,
    Zap,
    Target,
    X,
    Plus
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("CustomerDashboard Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-8">
                    <div className="max-w-lg w-full bg-slate-900 p-6 rounded-xl border border-red-500/50">
                        <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
                        <pre className="bg-black/50 p-4 rounded text-xs text-slate-300 overflow-auto">
                            {this.state.error?.toString()}
                        </pre>
                        <Button onClick={() => window.location.reload()} className="mt-4 w-full bg-slate-800 hover:bg-slate-700">
                            Reload Page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const BodyCompositionUpdateModal = ({ isOpen, onClose, onUpdate, currentData }) => {
    const [formData, setFormData] = useState({
        // Personal
        age: '',
        gender: 'Female',
        height: '',

        // Current Body Comp
        weight: '',
        fatPercent: '',
        visceralFat: '',
        muscleMassPercent: '',
        rmr: '',
        bmi: '',
        bodyAge: '',
        tsfPercent: '',

        // Ideal Body Comp
        idealWeight: '',
        idealFatPercent: '',
        idealVisceralFat: '',
        idealMuscleMassPercent: '',
        idealRmr: '',
        idealBmi: '',
        idealBodyAge: '',
        idealTsfPercent: '',

        // Membership
        pack: '',
        packPrice: 0,
        status: 'active'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && currentData) {
            setFormData({
                age: currentData.age || '',
                gender: currentData.gender || 'Female',
                height: currentData.bodyComposition?.height || '',

                weight: currentData.bodyComposition?.weight || '',
                fatPercent: currentData.bodyComposition?.fatPercent || '',
                visceralFat: currentData.bodyComposition?.visceralFat || '',
                muscleMassPercent: currentData.bodyComposition?.muscleMassPercent || '',
                rmr: currentData.bodyComposition?.rmr || '',
                bmi: currentData.bodyComposition?.bmi || '',
                bodyAge: currentData.bodyComposition?.bodyAge || '',
                tsfPercent: currentData.bodyComposition?.tsfPercent || '',

                idealWeight: currentData.idealBodyComposition?.weight || '',
                idealFatPercent: currentData.idealBodyComposition?.fatPercent || '',
                idealVisceralFat: currentData.idealBodyComposition?.visceralFat || '',
                idealMuscleMassPercent: currentData.idealBodyComposition?.muscleMassPercent || '',
                idealRmr: currentData.idealBodyComposition?.rmr || '',
                idealBmi: currentData.idealBodyComposition?.bmi || '',
                idealBodyAge: currentData.idealBodyComposition?.bodyAge || '',
                idealTsfPercent: currentData.idealBodyComposition?.tsfPercent || '',

                pack: currentData.pack || '',
                packPrice: currentData.packPrice || 0,
                status: currentData.status || 'active'
            });
        }
    }, [isOpen, currentData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const calculateTarget = (field) => {
        const current = parseFloat(formData[field]);
        const ideal = parseFloat(formData[`ideal${field.charAt(0).toUpperCase() + field.slice(1)}`]);
        if (!isNaN(current) && !isNaN(ideal)) {
            return (current - ideal).toFixed(2);
        }
        return '-';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                age: formData.age,
                gender: formData.gender,
                pack: formData.pack,
                packPrice: formData.packPrice,
                status: formData.status,
                bodyComposition: {
                    height: parseFloat(formData.height),
                    weight: parseFloat(formData.weight),
                    fatPercent: parseFloat(formData.fatPercent),
                    visceralFat: parseFloat(formData.visceralFat),
                    muscleMassPercent: parseFloat(formData.muscleMassPercent),
                    rmr: parseFloat(formData.rmr),
                    bmi: parseFloat(formData.bmi),
                    bodyAge: parseFloat(formData.bodyAge),
                    tsfPercent: parseFloat(formData.tsfPercent)
                },
                idealBodyComposition: {
                    weight: parseFloat(formData.idealWeight),
                    fatPercent: parseFloat(formData.idealFatPercent),
                    visceralFat: parseFloat(formData.idealVisceralFat),
                    muscleMassPercent: parseFloat(formData.idealMuscleMassPercent),
                    rmr: parseFloat(formData.idealRmr),
                    bmi: parseFloat(formData.idealBmi),
                    bodyAge: parseFloat(formData.idealBodyAge),
                    tsfPercent: parseFloat(formData.idealTsfPercent)
                }
            };

            await api.put('/customers/me', payload);
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error("Failed to update profile", error);
            alert("Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
                <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-white">Update Health Profile</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {/* Personal Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Personal Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Age</label>
                                <Input name="age" type="number" value={formData.age} onChange={handleChange} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none">
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Height (cm)</label>
                                <Input name="height" type="number" value={formData.height} onChange={handleChange} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Body Composition */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Body Composition (Current vs Ideal)</h3>

                        <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-500 uppercase text-center mb-2">
                            <div>Metric</div>
                            <div>Current</div>
                            <div>Ideal</div>
                        </div>

                        {[
                            { label: 'Weight (kg)', key: 'weight', idealKey: 'idealWeight' },
                            { label: 'Fat %', key: 'fatPercent', idealKey: 'idealFatPercent' },
                            { label: 'Visceral Fat', key: 'visceralFat', idealKey: 'idealVisceralFat' },
                            { label: 'Muscle Mass %', key: 'muscleMassPercent', idealKey: 'idealMuscleMassPercent' },
                            { label: 'RMR (kcal)', key: 'rmr', idealKey: 'idealRmr' },
                            { label: 'BMI', key: 'bmi', idealKey: 'idealBmi' },
                            { label: 'Body Age', key: 'bodyAge', idealKey: 'idealBodyAge' },
                            { label: 'TSF %', key: 'tsfPercent', idealKey: 'idealTsfPercent' },
                        ].map((item) => (
                            <div key={item.key} className="grid grid-cols-3 gap-4 items-center">
                                <label className="text-xs text-slate-400 font-medium">{item.label}</label>
                                <Input
                                    name={item.key}
                                    type="number"
                                    step="0.1"
                                    placeholder="Curr"
                                    value={formData[item.key]}
                                    onChange={handleChange}
                                    className="h-9 bg-slate-800 border-slate-700 text-white text-sm"
                                />
                                <Input
                                    name={item.idealKey}
                                    type="number"
                                    step="0.1"
                                    placeholder="Ideal"
                                    value={formData[item.idealKey]}
                                    onChange={handleChange}
                                    className="h-9 bg-slate-800 border-slate-700 text-white text-sm"
                                />
                            </div>
                        ))}

                        {/* Target Goals Display */}
                        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-800">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3">Target Goals (To Lose/Gain)</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                {[
                                    { label: 'Weight', key: 'weight' },
                                    { label: 'Fat %', key: 'fatPercent' },
                                    { label: 'Visceral', key: 'visceralFat' },
                                    { label: 'Muscle %', key: 'muscleMassPercent' },
                                ].map((item) => (
                                    <div key={item.key} className="bg-slate-900/50 p-2 rounded-lg">
                                        <p className="text-[10px] text-slate-500 uppercase mb-1">{item.label}</p>
                                        <p className={`text-sm font-bold ${parseFloat(calculateTarget(item.key)) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {calculateTarget(item.key)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Membership Details */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Membership & Status</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Pack</label>
                                <select name="pack" value={formData.pack} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none">
                                    <option value="">Select Pack</option>
                                    <option value="30 Days Shake Pack">30 Days Shake Pack</option>
                                    <option value="26 Days Shake Pack">26 Days Shake Pack</option>
                                    <option value="3 Days Trial Pack">3 Days Trial Pack</option>
                                    <option value="Hot Drink Pack (30 Days)">Hot Drink Pack (30 Days)</option>
                                    <option value="Coach Self-Use">Coach Self-Use</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-md p-2 text-sm focus:border-indigo-500 outline-none">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="trial">Trial</option>
                                    <option value="lead">Lead</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                        <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Updates'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export const CustomerStatsView = ({ customer, user, logout, showNavbar = true, onProfileUpdate }) => {
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const isRecentlyRenewed = useMemo(() => {
        if (!customer?.lastRenewalDate) return false;
        const renewalDate = new Date(customer.lastRenewalDate);
        const diffTime = Math.abs(new Date() - renewalDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
    }, [customer]);

    const progressData = useMemo(() => {
        if (!customer?.progressLogs?.length) return [];
        try {
            const data = customer.progressLogs.map(log => ({
                date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                weight: log.weight,
                fat: log.fatPercent,
                muscle: log.muscleMassPercent
            }));
            return data;
        } catch (err) {
            console.error("Error mapping progress logs:", err);
            return [];
        }
    }, [customer]);

    // Helper to safely get data
    const getMetric = (path, fallback = '-') => {
        if (!customer?.bodyComposition) return fallback;
        return customer.bodyComposition[path] || fallback;
    };

    const getIdeal = (path, fallback = '-') => {
        if (!customer?.idealBodyComposition) return fallback;
        return customer.idealBodyComposition[path] || fallback;
    };

    const NutritionGuide = () => {
        // Use diet plan from customer profile
        const dietPlan = customer?.dietPlan;
        const hasPlan = dietPlan && (dietPlan.recommended?.length > 0 || dietPlan.avoid?.length > 0);

        if (!hasPlan) {
            return (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                        <Utensils className="w-5 h-5 mr-2 text-indigo-400" /> Local Nutrition Guide
                    </h2>
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardContent className="py-8 text-center">
                            <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Utensils className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No Diet Plan Assigned</h3>
                            <p className="text-slate-400 text-sm max-w-md mx-auto">
                                Your coach hasn't assigned a specific nutrition guide yet. Ask them to create a personalized plan for you!
                            </p>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        const recommended = dietPlan.recommended || [];
        const avoid = dietPlan.avoid || [];

        return (
            <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Utensils className="w-5 h-5 mr-2 text-indigo-400" /> Your Personalized Nutrition
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Eat This */}
                    <Card className="bg-slate-900/50 border-emerald-500/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-emerald-400 text-lg flex items-center">
                                ✅ Eat Freely
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {recommended.map(food => (
                                    <div key={food._id} className="bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700">
                                        <div className="h-20 w-full bg-slate-700 rounded mb-2 overflow-hidden">
                                            {food.image ? (
                                                <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No Image</div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-white">{food.name}</p>
                                        <p className="text-[10px] text-slate-400">{food.category}</p>
                                    </div>
                                ))}
                                {recommended.length === 0 && <p className="text-slate-500 text-sm col-span-full">No specific recommendations.</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Avoid This */}
                    <Card className="bg-slate-900/50 border-red-500/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-red-400 text-lg flex items-center">
                                ❌ Avoid / Limit
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {avoid.map(food => (
                                    <div key={food._id} className="bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700 opacity-80">
                                        <div className="h-20 w-full bg-slate-700 rounded mb-2 overflow-hidden grayscale">
                                            {food.image ? (
                                                <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No Image</div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-300 line-through decoration-red-500">{food.name}</p>
                                        <p className="text-[10px] text-slate-500">{food.category}</p>
                                    </div>
                                ))}
                                {avoid.length === 0 && <p className="text-slate-500 text-sm col-span-full">No specific restrictions.</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500/30">
            {/* Navbar */}
            {showNavbar && (
                <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                    PulseIQ
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-white">{customer?.name || user?.name}</p>
                                    <p className="text-xs text-slate-400">{customer?.pack || 'Member'}</p>
                                </div>
                                <Button
                                    onClick={logout}
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-red-400"
                                >
                                    <LogOut className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </nav>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 flex justify-between items-end"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Hello, {customer?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Champion'}! 👋
                        </h1>
                        <p className="text-slate-400">
                            Here's your latest health breakdown.
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Update Stats
                    </Button>
                </motion.div>

                <BodyCompositionUpdateModal
                    isOpen={isUpdateModalOpen}
                    onClose={() => setIsUpdateModalOpen(false)}
                    onUpdate={onProfileUpdate}
                    currentData={customer}
                />

                {/* Renewal Celebration Card */}
                {isRecentlyRenewed && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy className="w-8 h-8 text-yellow-300" />
                                <h2 className="text-2xl font-bold">Membership Renewed! 🎉</h2>
                            </div>
                            <p className="text-indigo-100 text-lg italic">
                                "The only bad workout is the one that didn't happen. Keep crushing it!"
                            </p>
                            <p className="mt-4 text-sm font-medium bg-white/20 inline-block px-3 py-1 rounded-full">
                                Active Plan: {customer.pack}
                            </p>
                        </div>
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl"></div>
                    </motion.div>
                )}

                {/* Nutrition Guide */}
                <NutritionGuide />

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Weight */}
                    <Card className="bg-slate-900/50 border-white/10 hover:border-purple-500/30 transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                    <Scale className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                                    Goal: {getIdeal('weight')} kg
                                </span>
                            </div>
                            <p className="text-sm text-slate-400">Weight</p>
                            <h3 className="text-2xl font-bold text-white">{getMetric('weight')} <span className="text-sm font-normal text-slate-500">kg</span></h3>
                        </CardContent>
                    </Card>

                    {/* Body Fat */}
                    <Card className="bg-slate-900/50 border-white/10 hover:border-blue-500/30 transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <Activity className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                                    Goal: {getIdeal('fatPercent')} %
                                </span>
                            </div>
                            <p className="text-sm text-slate-400">Body Fat</p>
                            <h3 className="text-2xl font-bold text-white">{getMetric('fatPercent')} <span className="text-sm font-normal text-slate-500">%</span></h3>
                        </CardContent>
                    </Card>

                    {/* Muscle Mass */}
                    <Card className="bg-slate-900/50 border-white/10 hover:border-emerald-500/30 transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                                    Goal: {getIdeal('muscleMassPercent')} %
                                </span>
                            </div>
                            <p className="text-sm text-slate-400">Muscle Mass</p>
                            <h3 className="text-2xl font-bold text-white">{getMetric('muscleMassPercent')} <span className="text-sm font-normal text-slate-500">%</span></h3>
                        </CardContent>
                    </Card>

                    {/* Visceral Fat */}
                    <Card className="bg-slate-900/50 border-white/10 hover:border-orange-500/30 transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                                    <Target className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                                    Goal: {getIdeal('visceralFat')}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400">Visceral Fat</p>
                            <h3 className="text-2xl font-bold text-white">{getMetric('visceralFat')}</h3>
                        </CardContent>
                    </Card>
                </div>

                {/* Progress Charts */}
                {progressData.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-white mb-4">Your Progress Trends</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white text-sm">Weight History</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={progressData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white text-sm">Body Composition %</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={progressData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                            />
                                            <Line type="monotone" dataKey="fat" name="Fat %" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                                            <Line type="monotone" dataKey="muscle" name="Muscle %" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Progress History Table */}
                {customer?.progressLogs?.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-white mb-4">Progress History</h2>
                        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Weight</th>
                                            <th className="px-6 py-3">Fat %</th>
                                            <th className="px-6 py-3">Visceral</th>
                                            <th className="px-6 py-3">Muscle %</th>
                                            <th className="px-6 py-3">RMR</th>
                                            <th className="px-6 py-3">BMI</th>
                                            <th className="px-6 py-3">Body Age</th>
                                            <th className="px-6 py-3">TSF %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...customer.progressLogs].reverse().map((log, index) => (
                                            <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white">
                                                    {new Date(log.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4">{log.weight} kg</td>
                                                <td className="px-6 py-4">{log.fatPercent}%</td>
                                                <td className="px-6 py-4">{log.visceralFat}</td>
                                                <td className="px-6 py-4">{log.muscleMassPercent}%</td>
                                                <td className="px-6 py-4">{log.rmr}</td>
                                                <td className="px-6 py-4">{log.bmi}</td>
                                                <td className="px-6 py-4">{log.bodyAge}</td>
                                                <td className="px-6 py-4">{log.tsfPercent}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Detailed Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-slate-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">Detailed Composition</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[
                                    { label: 'BMI', key: 'bmi', color: 'bg-purple-500' },
                                    { label: 'RMR (Metabolism)', key: 'rmr', unit: 'kcal', color: 'bg-blue-500' },
                                    { label: 'Body Age', key: 'bodyAge', unit: 'yrs', color: 'bg-orange-500' },
                                    { label: 'TSF (Subcutaneous Fat)', key: 'tsfPercent', unit: '%', color: 'bg-emerald-500' },
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full ${item.color}`}></div>
                                            <span className="text-sm text-slate-300">{item.label}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-bold text-white">{getMetric(item.key)}</span>
                                            <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                                            {getIdeal(item.key) !== '-' && (
                                                <p className="text-[10px] text-slate-500">Goal: {getIdeal(item.key)}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-900/20 to-slate-900 border-purple-500/20">
                        <CardHeader>
                            <CardTitle className="text-white">Your Plan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8">
                                <div className="h-20 w-20 rounded-full bg-purple-500/20 mx-auto mb-4 flex items-center justify-center text-3xl">
                                    🥤
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{customer?.pack || 'No Active Plan'}</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    {customer?.pack ? 'You are on the right track! Keep following your coach\'s advice.' : 'Contact your coach to activate a plan.'}
                                </p>
                                <Button className="bg-purple-600 hover:bg-purple-500 text-white w-full sm:w-auto">
                                    View Plan Details
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

const CustomerDashboard = () => {
    const { user, logout } = useAuth();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomerData();
    }, []);

    const fetchCustomerData = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/customers/me');
            setCustomer(data);
        } catch (error) {
            console.error('Failed to fetch customer data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async () => {
        await fetchCustomerData();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <CustomerStatsView
                customer={customer}
                user={user}
                logout={logout}
                showNavbar={true}
                onProfileUpdate={handleProfileUpdate}
            />
        </ErrorBoundary>
    );
};

export default CustomerDashboard;
