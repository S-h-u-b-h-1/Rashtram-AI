"use client";

import React from "react";

export default function ContactForm() {
  return (
    <div className="isolate bg-white px-6 py-24 sm:py-32 lg:px-8 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu blur-3xl sm:top-[-20rem]"
        aria-hidden="true"
      >
      </div>

      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Contact Us
        </h2>
        <p className="mt-2 text-lg leading-8 text-gray-600">
          Feel Free to Contact Us. We will reply within 24 hours.
        </p>
      </div>

      <form
        method="post"
        className="mx-auto mt-16 max-w-xl sm:mt-20"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className="block text-sm font-semibold leading-6 text-gray-900">
              First name
            </label>
            <div className="mt-2.5">
              <input
                type="text"
                name="first-name"
                id="first-name"
                autoComplete="given-name"
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="last-name" className="block text-sm font-semibold leading-6 text-gray-900">
              Last name
            </label>
            <div className="mt-2.5">
              <input
                type="text"
                name="last-name"
                id="last-name"
                autoComplete="family-name"
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="company" className="block text-sm font-semibold leading-6 text-gray-900">
              Company
            </label>
            <div className="mt-2.5">
              <input
                type="text"
                name="company"
                id="company"
                autoComplete="organization"
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div className="sm:col-span-2">
            <label htmlFor="email" className="block text-sm font-semibold leading-6 text-gray-900">
              Email
            </label>
            <div className="mt-2.5">
              <input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="phone-number" className="block text-sm font-semibold leading-6 text-gray-900">
              Phone number
            </label>
            <div className="relative mt-2.5">
              <select
                id="country"
                name="country"
                className="absolute left-0 h-full rounded-md border-0 bg-transparent py-0 pl-4 pr-9 text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              >
                <option>IND</option>
                <option>US</option>
                <option>EU</option>
              </select>
              <input
                type="tel"
                name="phone-number"
                id="phone-number"
                autoComplete="tel"
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 pl-24 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="message" className="block text-sm font-semibold leading-6 text-gray-900">
              Message
            </label>
            <div className="mt-2.5">
              <textarea
                name="message"
                id="message"
                rows={4}
                className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
              ></textarea>
            </div>
          </div>

          </div>
        <div className="mt-10">
          <button
            type="submit"
            className="block w-full rounded-md bg-[#b20d38] px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#a2062f] focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Let's talk
          </button>
        </div>
      </form>
    </div>
  );
}
