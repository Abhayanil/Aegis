'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Activity } from 'lucide-react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="border-b border-primary-800 bg-dark-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-primary-100">Aegis</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
            >
              Analyze
            </Link>
            <Link 
              href="/dashboard" 
              className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link 
              href="/docs" 
              className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
            >
              Documentation
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="btn-ghost">
              Sign In
            </button>
            <button className="btn-primary">
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-primary-300 hover:text-primary-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-primary-800">
            <nav className="flex flex-col space-y-4">
              <Link 
                href="/" 
                className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Analyze
              </Link>
              <Link 
                href="/dashboard" 
                className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link 
                href="/docs" 
                className="text-primary-300 hover:text-primary-100 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Documentation
              </Link>
              <div className="flex flex-col space-y-2 pt-4 border-t border-primary-800">
                <button className="btn-ghost justify-start">
                  Sign In
                </button>
                <button className="btn-primary justify-start">
                  Get Started
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}