"use client";
import React from 'react'

import { useState } from "react";
import Link from "next/link";
import Typewriter from "typewriter-effect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { Checkbox } from "@/components/ui/checkbox";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    // Handle login logic here
    console.log({ email, password, rememberMe });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Login form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 rounded-lg mb-4"></div>
            <h1 className="text-2xl font-bold">Login to your account</h1>
          </div>
          
          <div className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Button variant="outline" className="w-full justify-start gap-2 py-5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" x2="12" y1="8" y2="8"></line><line x1="3.95" x2="8.54" y1="6.06" y2="14"></line><line x1="10.88" x2="15.46" y1="21.94" y2="14"></line></svg>
                Continue with Google
              </Button>
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Button variant="outline" className="w-full justify-start gap-2 py-5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
                Continue with GitHub
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
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full py-5 cursor-pointer">Login</Button>
            </form>
            
            <div className="text-center text-sm">
              Don't have an account? <Link href="/signup" className="underline">Register</Link>
            </div>
            
            <div className="text-center">
              <Link href="/" className="text-sm underline">Home</Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="hidden md:flex md:w-1/2 justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/Gradiant.png" alt="Gradient Background" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.3)_0%,transparent_70%)] mix-blend-overlay"></div>
        
        {/* Animated background elements */}
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
                strings: ['Welcome to Rashtram AI', 'Empowering with Indian Values', 'Building AI with First Principles'],
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
  );
};

export default Login;
