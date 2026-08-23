/** @type {import('tailwindcss').Config} */

// The same palette as the admin portal.
//
// The two halves of MiDrive shared no colour at all: admin was indigo, the
// driver app was amber, and neither used a token the other knew about. They
// read as two products from two companies, which matters most at the moment a
// driver and a site manager are looking at the same job on two screens.
//
// Marine carries brand and interaction on both sides. The semantic ramps mean
// exactly what they mean in the portal, so amber is a warning here too rather
// than simply being the driver app's accent colour.

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        marine: {
          50: "#eef4fa",
          100: "#d9e6f4",
          200: "#b3cbe7",
          300: "#83a9d5",
          400: "#5285bf",
          500: "#2f66a6",
          600: "#1f5089",
          700: "#1a4070",
          800: "#16345a",
          900: "#122942",
          950: "#0c1b2c",
        },

        canvas: "#f1f5f9",
        surface: "#ffffff",
        "surface-sunken": "#f8fafc",
        line: "#e2e8f0",
        "line-strong": "#cbd5e1",
        ink: "#0f172a",
        "ink-muted": "#475569",
        "ink-subtle": "#64748b",
        "ink-faint": "#94a3b8",

        ok: {
          surface: "#ecfdf5",
          line: "#a7f3d0",
          DEFAULT: "#047857",
          strong: "#065f46",
        },
        warn: {
          surface: "#fffbeb",
          line: "#fde68a",
          DEFAULT: "#b45309",
          strong: "#92400e",
        },
        bad: {
          surface: "#fef2f2",
          line: "#fecaca",
          DEFAULT: "#b91c1c",
          strong: "#991b1b",
        },
      },
    },
  },
  plugins: [],
};
