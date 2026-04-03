import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '@radix-ui/react-label';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState('customer');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Form States
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');

    // Signup Specific States
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [uplineMobile, setUplineMobile] = useState('');
    const [coachMobileForOtp, setCoachMobileForOtp] = useState(''); // For Coach/Manager OTP
    const [customerMobileForOtp, setCustomerMobileForOtp] = useState(''); // For Customer OTP

    // Manager Specific States
    const [downlineCoach1, setDownlineCoach1] = useState('');
    const [downlineCoach1Level, setDownlineCoach1Level] = useState('');
    const [downlineCoach2, setDownlineCoach2] = useState('');
    const [downlineCoach2Level, setDownlineCoach2Level] = useState('');
    const [downlineCoach3, setDownlineCoach3] = useState('');
    const [downlineCoach3Level, setDownlineCoach3Level] = useState('');

    const { login, signup, sendOtp, devLogin } = useAuth();
    const navigate = useNavigate();

    const handleSendOtp = async () => {
        let actualMobile = '';
        if (role === 'customer') actualMobile = customerMobileForOtp;
        else if (role === 'coach') actualMobile = coachMobileForOtp;
        else if (role === 'manager') actualMobile = coachMobileForOtp;

        if (!actualMobile) {
            setError('Please enter the mobile number for OTP');
            return;
        }

        try {
            await sendOtp(actualMobile, role);
            alert(`OTP Sent to ${actualMobile} (Check Console)`);
        } catch (err) {
            setError(err);
        }
    };

    const redirectUser = (userRole) => {
        if (userRole === 'customer') navigate('/customer');
        else if (userRole === 'coach') navigate('/coach');
        else if (userRole === 'manager') navigate('/manager');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            if (isLogin) {
                const user = await login(mobile, password, role);
                redirectUser(user.role);
            } else {
                // Signup Validation
                if (password !== confirmPassword) {
                    throw "Passwords do not match";
                }

                // Prepare Downline Data for Manager
                const downlines = [];
                if (downlineCoach1) downlines.push({ mobile: downlineCoach1, lineLevel: downlineCoach1Level || '1' });
                if (downlineCoach2) downlines.push({ mobile: downlineCoach2, lineLevel: downlineCoach2Level || '1' });
                if (downlineCoach3) downlines.push({ mobile: downlineCoach3, lineLevel: downlineCoach3Level || '1' });

                // Prepare Signup Data
                const signupData = {
                    mobile: role === 'customer' ? customerMobileForOtp : coachMobileForOtp,
                    password,
                    role,
                    name,
                    uplineMobile,
                    downlineCoaches: downlines
                };

                const user = await signup(signupData);
                redirectUser(user.role);
            }
        } catch (err) {
            setError(typeof err === 'string' ? err : 'An error occurred');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B1120] to-black overflow-y-auto py-10">

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[600px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-tr from-green-400 to-emerald-600 shadow-lg shadow-green-500/20 mb-4">
                        <Sparkles className="text-white h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">PulseIQ</h1>
                    <p className="text-slate-400 mt-2">Track, Coach, and Grow Smarter.</p>
                </div>

                {/* Toggle */}
                <div className="bg-black/20 p-1 rounded-xl flex mb-8 border border-white/5">
                    <button
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Sign Up
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Role Selection - Always Visible */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Select Your Role</Label>
                        <div className="relative">
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all appearance-none cursor-pointer hover:bg-white/5"
                            >
                                <option value="customer" className="bg-slate-900">Customer</option>
                                <option value="coach" className="bg-slate-900">Wellness Coach</option>
                                <option value="manager" className="bg-slate-900">Manager</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ArrowRight className="h-4 w-4 rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* LOGIN FORM */}
                    {isLogin && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Mobile Number</Label>
                                <Input
                                    type="tel"
                                    placeholder="Enter your 10-digit mobile number"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* SIGNUP FORM */}
                    {!isLogin && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

                            {/* Common Field: Name */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Name <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="Enter your full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                />
                            </div>

                            {/* CUSTOMER FIELDS */}
                            {role === 'customer' && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Wellness Coach's Mobile Number <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="tel"
                                            placeholder="Enter coach's mobile number"
                                            value={uplineMobile}
                                            onChange={(e) => setUplineMobile(e.target.value)}
                                            className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Customer's Mobile Number for OTP <span className="text-red-500">*</span></Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="tel"
                                                placeholder="Enter your mobile number"
                                                value={customerMobileForOtp}
                                                onChange={(e) => setCustomerMobileForOtp(e.target.value)}
                                                className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                            />
                                            <Button type="button" onClick={handleSendOtp} className="bg-white/10 hover:bg-white/20 text-white h-12 px-4 rounded-xl">
                                                Send OTP
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* COACH & MANAGER FIELDS */}
                            {(role === 'coach' || role === 'manager') && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Upline Mobile Number (Optional)</Label>
                                        <Input
                                            type="tel"
                                            placeholder="Enter upline's mobile number"
                                            value={uplineMobile}
                                            onChange={(e) => setUplineMobile(e.target.value)}
                                            className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                        />
                                    </div>

                                    {/* Manager Specific Notes & Fields */}
                                    {role === 'manager' && (
                                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                                            <p className="text-xs text-blue-300">
                                                <strong>Important:</strong> Create your Wellness Coach account first (same mobile) before requesting Manager access. Manager tools unlock after at least two active downline coaches confirm.
                                            </p>
                                            <p className="text-xs text-blue-300">
                                                After verification, you can log in as Manager and see the full Manager Dashboard. Until then, you can still use the Coach view.
                                            </p>

                                            <div className="space-y-2 pt-2">
                                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Downline Wellness Coach Verification (Optional)</Label>
                                                <p className="text-[10px] text-slate-500">Enter verified coaches if available. Specify their Line Level (e.g., 1 for direct, 2 for indirect).</p>

                                                {/* Coach 1 */}
                                                <div className="flex gap-2 mb-2">
                                                    <Input
                                                        placeholder="Coach #1 Mobile"
                                                        value={downlineCoach1}
                                                        onChange={(e) => setDownlineCoach1(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-[2]"
                                                    />
                                                    <Input
                                                        placeholder="Level"
                                                        value={downlineCoach1Level}
                                                        onChange={(e) => setDownlineCoach1Level(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-1"
                                                    />
                                                </div>

                                                {/* Coach 2 */}
                                                <div className="flex gap-2 mb-2">
                                                    <Input
                                                        placeholder="Coach #2 Mobile"
                                                        value={downlineCoach2}
                                                        onChange={(e) => setDownlineCoach2(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-[2]"
                                                    />
                                                    <Input
                                                        placeholder="Level"
                                                        value={downlineCoach2Level}
                                                        onChange={(e) => setDownlineCoach2Level(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-1"
                                                    />
                                                </div>

                                                {/* Coach 3 */}
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Coach #3 Mobile"
                                                        value={downlineCoach3}
                                                        onChange={(e) => setDownlineCoach3(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-[2]"
                                                    />
                                                    <Input
                                                        placeholder="Level"
                                                        value={downlineCoach3Level}
                                                        onChange={(e) => setDownlineCoach3Level(e.target.value)}
                                                        className="bg-black/20 border-white/10 text-white h-10 rounded-lg text-sm flex-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">
                                            {role === 'manager' ? 'Manager Mobile Number for OTP' : 'Wellness Coach Mobile Number for OTP'} <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="tel"
                                                placeholder="Enter your mobile number"
                                                value={coachMobileForOtp}
                                                onChange={(e) => setCoachMobileForOtp(e.target.value)}
                                                className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20"
                                            />
                                            <Button type="button" onClick={handleSendOtp} className="bg-white/10 hover:bg-white/20 text-white h-12 px-4 rounded-xl">
                                                Send OTP
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Common Password Fields */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Create Password <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Confirm Password <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* OTP Field */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">OTP <span className="text-red-500">*</span></Label>
                                <Input
                                    type="text"
                                    placeholder="Enter OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="bg-black/20 border-white/10 text-white placeholder:text-slate-600 h-12 rounded-xl focus:border-green-500/50 focus:ring-green-500/20 tracking-widest text-center"
                                />
                            </div>
                        </motion.div>
                    )}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-green-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mt-6"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                {isLogin ? 'Sign In' : 'Sign Up'} <ArrowRight className="h-4 w-4" />
                            </span>
                        )}
                    </Button>
                </form>

                {/* DEV TOOLS - REMOVE IN PRODUCTION */}
                <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-3">Dev Quick Access</p>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={async () => { await devLogin('customer'); navigate('/customer'); }}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs py-2 rounded-lg border border-blue-500/20 transition-colors"
                        >
                            Customer
                        </button>
                        <button
                            onClick={async () => { await devLogin('coach'); navigate('/coach'); }}
                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs py-2 rounded-lg border border-purple-500/20 transition-colors"
                        >
                            Coach
                        </button>
                        <button
                            onClick={async () => { await devLogin('manager'); navigate('/manager'); }}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs py-2 rounded-lg border border-orange-500/20 transition-colors"
                        >
                            Manager
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
