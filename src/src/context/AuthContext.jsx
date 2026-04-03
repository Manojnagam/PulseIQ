import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../config/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        console.log("AuthContext: Initializing. Stored user:", storedUser);
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                console.log("AuthContext: Parsed user:", parsedUser);
                setUser(parsedUser);
            } catch (e) {
                console.error("AuthContext: Failed to parse user", e);
                localStorage.removeItem('user');
            }
        } else {
            console.log("AuthContext: No user found in localStorage");
        }
        setLoading(false);
    }, []);

    const login = async (mobile, password, role) => {
        try {
            const { data } = await api.post('/auth/login', { mobile, password, role });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            return data;
        } catch (error) {
            console.error("Login error:", error);
            throw error.response?.data?.message || 'Login failed';
        }
    };

    const signup = async (signupData) => {
        try {
            // If signupData is an object with keys, use it. Otherwise assume it's (mobile, password, role, name) legacy call
            // But to be safe, let's just pass the whole object if it's the first arg
            let payload = {};
            if (typeof signupData === 'object' && signupData.mobile) {
                payload = signupData;
            } else {
                // Fallback for legacy calls (though we updated the only caller)
                // arguments[0] is mobile, [1] password, etc.
                // Ideally we just enforce object now.
                payload = { mobile: arguments[0], password: arguments[1], role: arguments[2], name: arguments[3] };
            }

            const { data } = await api.post('/auth/signup', payload);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            return data;
        } catch (error) {
            console.error("Signup error:", error);
            throw error.response?.data?.message || 'Signup failed';
        }
    };

    const sendOtp = async (mobile, role) => {
        try {
            await api.post('/auth/send-otp', { mobile, role });
        } catch (error) {
            throw error.response?.data?.message || 'Failed to send OTP';
        }
    };

    const verifyOtp = async (mobile, otp) => {
        try {
            const { data } = await api.post('/auth/verify-otp', { mobile, otp });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Verification failed';
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    // DEV ONLY: Bypass auth for UI testing
    const devLogin = (role) => {
        const dummyUser = {
            _id: 'dev-id-' + role,
            name: 'Dev ' + role.charAt(0).toUpperCase() + role.slice(1),
            mobile: '9999999999',
            role: role,
            isVerified: true
        };
        localStorage.setItem('token', 'dev-token');
        localStorage.setItem('user', JSON.stringify(dummyUser));
        setUser(dummyUser);
        return dummyUser;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, sendOtp, verifyOtp, devLogin }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
