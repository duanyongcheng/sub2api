/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Colour tokens follow the redesign spec in `design-prototypes/docs/02-设计规范与实现映射.md`:
//
//   - `primary`  : brand teal, identical in light & dark (used only for
//                  clickable / current / primary-action affordances).
//   - `surface`  : the three-layer surface scale (page / card / inset). These
//                  are CSS variables (rgb triplets) so a single `.dark` class
//                  swap re-themes every surface without a `dark:` variant.
//   - `edge`     : border token (regular / strong).
//   - `ink`      : text token (primary / secondary / tertiary).
//   - `dark.*`   : legacy numeric palette. Kept for old screens, but the
//                  low/terminal stops below are realigned to the new dark
//                  surface scale so an untouched page already looks "new"
//                  instead of the old blue-slate look.
//   - `safe.*` / `core.*`: compatibility ramps. Existing screens pair a light
//                  utility with its `dark:` twin (e.g. `text-gray-500
//                  dark:text-dark-400`). In dark mode every low utility is in
//                  scope, so re-pointing the *dark* twin's light-mode value to
//                  the new ink-3 would also darken the light theme. These ramps
//                  let us remap only one theme at a time using a CSS variable
//                  that flips inside `.dark`.
//
// Colour values are declared as `<alpha-value>` placeholders wired to
// `var(--tw-*)` so Tailwind opacity modifiers (e.g. `bg-surface/80`) keep
// working.
// ---------------------------------------------------------------------------

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

// Primary ramps resolved through a variable so `bg-primary-50` etc. can be a
// different shade in dark mode without adding `dark:` twins everywhere.
const primary = {
  50: 'rgb(var(--primary-50) / <alpha-value>)',
  100: 'rgb(var(--primary-100) / <alpha-value>)',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: 'rgb(var(--primary-700) / <alpha-value>)',
  800: 'rgb(var(--primary-800) / <alpha-value>)',
  900: 'rgb(var(--primary-900) / <alpha-value>)',
  950: 'rgb(var(--primary-950) / <alpha-value>)'
}

// Neutral ramps. `dark.*` keeps numeric names so old class names still work.
const dark = {
  50: '#f6f8fa',
  100: '#f1f5f9',
  200: 'rgb(var(--dark-200) / <alpha-value>)',
  300: 'rgb(var(--dark-300) / <alpha-value>)',
  400: 'rgb(var(--dark-400) / <alpha-value>)',
  500: 'rgb(var(--dark-500) / <alpha-value>)',
  600: 'rgb(var(--dark-600) / <alpha-value>)',
  700: 'rgb(var(--dark-700) / <alpha-value>)',
  800: 'rgb(var(--dark-800) / <alpha-value>)',
  900: 'rgb(var(--dark-900) / <alpha-value>)',
  950: 'rgb(var(--dark-950) / <alpha-value>)'
}

const accent = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e8edf2',
  300: '#d9e1ea',
  400: 'rgb(var(--accent-400) / <alpha-value>)',
  500: 'rgb(var(--accent-500) / <alpha-value>)',
  600: 'rgb(var(--accent-600) / <alpha-value>)',
  700: '#2a374a',
  800: '#1d2838',
  900: '#111a28',
  950: '#070b12'
}

// Semantic colours stay literal: their `-50` tints already flip in dark mode
// (see `.primary-50`-style utilities generated from the CSS variables below),
// which is enough for pills and callouts to read correctly in both themes.
const colors = {
  primary,
  accent,
  dark,
  primaryDark: primary,

  // New semantic tokens -----------------------------------------------------
  surface: {
    DEFAULT: v('surface'),
    card: v('surface'), // legacy alias, some widgets use `bg-surface-card`
    2: v('surface-2'),
    3: v('surface-3')
  },
  edge: {
    DEFAULT: v('edge'),
    strong: v('edge-strong')
  },
  ink: {
    DEFAULT: v('ink'),
    2: v('ink-2'),
    3: v('ink-3')
  },
  canvas: v('canvas'),

  // Compatibility ramps (see header comment) --------------------------------
  safe: {
    50: 'rgb(var(--tw-safe-50) / <alpha-value>)',
    100: 'rgb(var(--tw-safe-100) / <alpha-value>)',
    200: 'rgb(var(--tw-safe-200) / <alpha-value>)',
    300: 'rgb(var(--tw-safe-300) / <alpha-value>)',
    400: 'rgb(var(--tw-safe-400) / <alpha-value>)',
    500: 'rgb(var(--tw-safe-500) / <alpha-value>)'
  },
  core: {
    50: 'rgb(var(--tw-core-50) / <alpha-value>)',
    100: 'rgb(var(--tw-core-100) / <alpha-value>)',
    400: 'rgb(var(--tw-core-400) / <alpha-value>)',
    500: 'rgb(var(--tw-core-500) / <alpha-value>)',
    600: 'rgb(var(--tw-core-600) / <alpha-value>)',
    700: 'rgb(var(--tw-core-700) / <alpha-value>)',
    900: 'rgb(var(--tw-core-900) / <alpha-value>)'
  }
}

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],

  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'Segoe UI',
          'system-ui',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SF Mono', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace']
      },
      fontSize: {
        // Spec ladder: page title 21 / card title 14 / body 13 / table 12.4 /
        // helper 11.5 / micro label 10.5.
        '2xs': ['10.5px', { lineHeight: '14px' }],
        '3xs': ['10px', { lineHeight: '13px' }],
        meta: ['11.5px', { lineHeight: '16px' }],
        data: ['12.4px', { lineHeight: '18px' }],
        body: ['13px', { lineHeight: '19px' }],
        title: ['21px', { lineHeight: '28px', letterSpacing: '-0.025em' }]
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.05)',
        sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        md: '0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.05)',
        lg: '0 18px 40px -12px rgba(15, 23, 42, 0.22), 0 4px 12px -6px rgba(15, 23, 42, 0.1)',
        'primary-outline': '0 6px 16px -8px rgba(13, 148, 136, 0.9)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.06)',
        glow: '0 0 20px rgba(20, 184, 166, 0.25)',
        'glow-lg': '0 0 40px rgba(20, 184, 166, 0.35)',
        card: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 10px 40px rgba(15, 23, 42, 0.08)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      },
      borderRadius: {
        '4xl': '2rem',
        // Spec radii: input/button 10, card 14, container 18.
        field: '10px',
        card: '14px',
        shell: '18px'
      },
      spacing: {
        sidebar: '248px',
        'sidebar-collapsed': '72px',
        header: '64px'
      },
      maxWidth: {
        content: '1400px'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
        'gradient-dark': 'linear-gradient(140deg, #16202f 0%, #0d1420 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'hero-glow':
          'radial-gradient(900px 240px at 8% -30%, rgba(20,184,166,.16), transparent 62%), radial-gradient(700px 220px at 92% 130%, rgba(59,130,246,.10), transparent 60%)',
        'mesh-gradient':
          'radial-gradient(at 40% 20%, rgba(20, 184, 166, 0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(6, 182, 212, 0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(20, 184, 166, 0.08) 0px, transparent 50%)'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 0.61, 0.36, 1)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        'live-pulse': 'livePulse 1.8s ease-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.25)' },
          '100%': { boxShadow: '0 0 30px rgba(20, 184, 166, 0.4)' }
        },
        livePulse: {
          '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.45)' },
          '70%': { boxShadow: '0 0 0 6px rgba(16, 185, 129, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
