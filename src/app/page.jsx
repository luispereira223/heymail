"use client";
import React, { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [dialog, setDialog] = useState({ show: false, message: "", type: "" });

  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect after successful login
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  // Handle login form submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    try {
      const result = await signIn("credentials", {
        email: loginData.email,
        password: loginData.password,
        redirect: false,
      });

      if (result?.error) {
        setDialog({
          show: true,
          message: "Invalid email or password.",
          type: "error",
        });
      } else {
        setDialog({
          show: true,
          message: "Login successful! Redirecting...",
          type: "success",
        });
        setShowLoginModal(false);
      }
    } catch (error) {
      setDialog({
        show: true,
        message: "Something went wrong. Try again.",
        type: "error",
      });
    }
  };

  // Handle signup form submission
  const handleSignupSubmit = async (e) => {
    e.preventDefault();

    if (signupData.password !== signupData.confirmPassword) {
      setDialog({ show: true, message: "Passwords do not match!", type: "error" });
      return;
    }
    if (!signupData.agreeToTerms) {
      setDialog({ show: true, message: "Please agree to the terms.", type: "error" });
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupData),
      });

      if (!response.ok) {
        setDialog({
          show: true,
          message: "Failed to create account.",
          type: "error",
        });
      } else {
        setDialog({
          show: true,
          message: "Account created! You can now log in.",
          type: "success",
        });
        setShowSignupModal(false);
        setShowLoginModal(true);
      }
    } catch (error) {
      setDialog({
        show: true,
        message: "Something went wrong. Try again.",
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4">
        {/* NAVIGATION */}
        <nav className="flex items-center justify-between py-8 px-8 bg-white border border-gray-100 rounded-2xl mt-8 shadow-sm hover:shadow-md transition-shadow duration-300">
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
          >
            Login
          </button>

          <h1 className="text-2xl font-bold text-gray-900">HeyMail</h1>

          <button
            onClick={() => setShowSignupModal(true)}
            className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-medium py-3 px-8 rounded-xl transition-all duration-200 hover:scale-105"
          >
            Sign up
          </button>
        </nav>

        {/* MAIN CONTENT */}
        <div className="flex flex-col items-center justify-center mt-16">
          <div
            className="bg-white border border-gray-100 rounded-3xl p-12 lg:p-16 shadow-sm hover:shadow-lg transition-all duration-300 w-full max-w-4xl"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Hero Section */}
            <div className="text-center">
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Your personal
                <span className="text-blue-600 block mt-2">email solution</span>
              </h1>

              <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed">
                A clean, private email management platform designed specifically
                for your personal server. Simple, secure, and completely under
                your control.
              </p>

              {/* Action Button */}
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-12 rounded-2xl text-lg transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg mb-12">
                Access My Email
              </button>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors duration-300">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Manage</h3>
                  <p className="text-gray-600 text-sm">
                    Organize and manage all your emails in one clean interface
                  </p>
                </div>

                <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors duration-300">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Private</h3>
                  <p className="text-gray-600 text-sm">
                    Your personal server, your data, complete privacy
                  </p>
                </div>

                <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors duration-300">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sync</h3>
                  <p className="text-gray-600 text-sm">
                    Seamlessly sync across all your devices
                  </p>
                </div>
              </div>

              {/* Server Status */}
              <div className="flex items-center justify-center mt-12 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Server Status: Online
              </div>
            </div>
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Login to HeyMail</h2>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Create Account</h2>
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={signupData.fullName}
                onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <input
                type="email"
                placeholder="Email"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <input
                type="password"
                placeholder="Password"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={signupData.confirmPassword}
                onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                required
                className="w-full px-4 py-3 border rounded-xl"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dialog Box */}
      {dialog.show && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-lg z-50 text-white ${
            dialog.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          <p>{dialog.message}</p>
          <button
            onClick={() => setDialog({ show: false, message: "", type: "" })}
            className="ml-4 underline text-sm"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
