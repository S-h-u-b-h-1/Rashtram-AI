"use client";
import React from 'react'

import { useState } from "react";
import Link from "next/link";
import Typewriter from "typewriter-effect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import PublicRoute from "@/components/PublicRoute";
import { Chrome } from "lucide-react";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const { register, googleLogin, loading } = useAuth();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    const result = await register(name, email, password);

    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <PublicRoute>
      <div className="flex min-h-screen">
      {}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 rounded-lg mb-4"></div>
            <h1 className="text-2xl font-bold">Sign up for an account</h1>
          </div>

          <div className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 py-5"
                onClick={() => googleLogin()}
                disabled={loading}
              >
                <Chrome className="h-5 w-5" />
                Continue with Google
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">OR</span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={setAgreeTerms}
                  disabled={loading}
                />
                <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to the <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>
                </label>
              </div>

              <Button type="submit" className="w-full py-5" disabled={loading}>
                {loading ? "Creating Account..." : "Sign up"}
              </Button>
            </form>

            <div className="text-center text-sm">
              Already have an account? <Link href="/login" className="underline">Log in</Link>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="hidden md:flex md:w-1/2 justify-center items-center p-12 relative overflow-hidden">
        {}
        <div className="absolute inset-0">
          <img src="/Gradiant.png" alt="Gradient Background" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.3)_0%,transparent_70%)] mix-blend-overlay"></div>

        {}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-white/50 blur-xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/3 w-56 h-56 rounded-full bg-pink-300/40 blur-xl animate-pulse animation-delay-1000"></div>
          <div className="absolute top-2/3 left-1/2 w-40 h-40 rounded-full bg-red-300/40 blur-xl animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-32 h-32 rounded-full bg-rose-400/30 blur-xl animate-pulse animation-delay-1500"></div>
        </div>

        <div className="relative z-10 bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-white/50 shadow-xl max-w-md w-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-black text-xl font-medium mb-2">$ rashtram-ai</div>
          <div className="text-black text-xl font-bold flex items-center">
            <span className="text-green-600 mr-2"></span>
            <Typewriter
              options={{
                strings: ['Join our community today', 'Create amazing projects', 'Connect with other developers'],
                autoStart: true,
                loop: true,
                delay: 50,
                deleteSpeed: 30,
              }}
            />
            <span className="ml-1 animate-blink bg-black"></span>
          </div>
        </div>
      </div>
    </div>
    </PublicRoute>
  );
};

export default Signup;
