"use client";
import React, { useState } from 'react'
import Link from 'next/link'
import { Cylinder, Menu, X, ChevronRight } from 'lucide-react'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="flex items-center justify-between py-4 px-6 bg-white shadow-sm w-full">
      <div className="flex items-center">
        <Link href="/" className="flex items-center font-bold text-xl text-black">
          <Cylinder className="mr-2 text-black transform rotate-45" size={20}/>
          Rashtram AI
        </Link>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex space-x-8">
        <Link href="/solutions" className="text-gray-700 hover:text-gray-900 relative group">
          Solutions
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
        </Link>
        <Link href="/product" className="text-gray-700 hover:text-gray-900 relative group">
          Product
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
        </Link>
        <Link href="/resources" className="text-gray-700 hover:text-gray-900 relative group">
          Resources
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
        </Link>
        <Link href="/pricing" className="text-gray-700 hover:text-gray-900 relative group">
          Pricing
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
        </Link>
      </div>
      
      {/* Desktop CTA Buttons */}
      <div className="hidden md:flex items-center space-x-6">
        <Link 
          href="/get-started" 
          className="bg-[#B20D38] hover:bg-primary-dark text-white px-6 py-2.5 rounded-md font-medium transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
        >
          Get Started
        </Link>
        <Link 
          href="/contact-sales" 
          className="text-gray-700 hover:text-gray-900 font-medium relative group"
        >
          Contact Sales
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
        </Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-gray-700 hover:text-gray-900 focus:outline-none"
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white shadow-md py-4 px-6 md:hidden z-10">
          <div className="flex flex-col space-y-4">
            <Link 
              href="/solutions" 
              className="text-gray-700 hover:text-gray-900 font-medium py-2 border-b border-gray-50 flex items-center justify-between group relative"
              onClick={() => setIsMenuOpen(false)}
            >
              <span>Solutions</span>
              <ChevronRight className="text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4 w-4" />
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link 
              href="/product" 
              className="text-gray-700 hover:text-gray-900 font-medium py-2 border-b border-gray-50 flex items-center justify-between group relative"
              onClick={() => setIsMenuOpen(false)}
            >
              <span>Product</span>
              <ChevronRight className="text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4 w-4" />
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link 
              href="/resources" 
              className="text-gray-700 hover:text-gray-900 font-medium py-2 border-b border-gray-50 flex items-center justify-between group relative"
              onClick={() => setIsMenuOpen(false)}
            >
              <span>Resources</span>
              <ChevronRight className="text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4 w-4" />
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-700 hover:text-gray-900 font-medium py-2 border-b border-gray-50 flex items-center justify-between group relative"
              onClick={() => setIsMenuOpen(false)}
            >
              <span>Pricing</span>
              <ChevronRight className="text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4 w-4" />
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <div className="pt-4 flex flex-col space-y-4 mt-2">
              <Link 
                href="/get-started" 
                className="bg-[#B20D38] hover:bg-primary-dark text-white px-5 py-3 rounded-md font-medium text-center transition-all duration-300 shadow-sm hover:shadow-md"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </Link>
              <Link 
                href="/contact-sales" 
                className="text-gray-700 hover:text-gray-900 font-medium text-center py-2 border border-gray-200 rounded-md hover:border-gray-400 flex items-center justify-center space-x-2 group relative"
                onClick={() => setIsMenuOpen(false)}
              >
                <span>Contact Sales</span>
                <ChevronRight className="text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-4 w-4" />
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
