/**
 * Public Site Theme Tokens
 * Shared design tokens for public-facing pages (/, /apply, /login)
 */

export const publicTheme = {
  colors: {
    // Primary orange (warm, friendly)
    primary: {
      DEFAULT: '#E4893D',
      light: '#FF9F5A',
      lighter: '#FFB884',
      dark: '#D4792D',
      foreground: '#FFFFFF',
    },
    // Soft pastel accents
    pastels: {
      blue: '#E3F2FD',
      blueText: '#1976D2',
      green: '#E8F5E9',
      greenText: '#388E3C',
      purple: '#F3E5F5',
      purpleText: '#7B1FA2',
      pink: '#FCE4EC',
      pinkText: '#C2185B',
      yellow: '#FFF9C4',
      yellowText: '#F57F17',
    },
    // Neutral grays
    gray: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    // Background
    background: {
      DEFAULT: '#FFFFFF',
      offWhite: '#FEFEFE',
      subtle: '#FAFAFA',
      base: '#FEFEFE',
      gradientTop: 'linear-gradient(180deg, rgba(255, 245, 240, 0.8) 0%, rgba(255, 255, 255, 0) 100%)',
      gradientSection: {
        blue: 'linear-gradient(180deg, rgba(227, 242, 253, 0.4) 0%, rgba(255, 255, 255, 0) 100%)',
        green: 'linear-gradient(180deg, rgba(232, 245, 233, 0.4) 0%, rgba(255, 255, 255, 0) 100%)',
        purple: 'linear-gradient(180deg, rgba(243, 229, 245, 0.4) 0%, rgba(255, 255, 255, 0) 100%)',
      },
      noise: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.02) 1px, transparent 0)',
    },
    // Text
    text: {
      primary: '#212121',
      secondary: '#616161',
      muted: '#9E9E9E',
      light: '#FFFFFF',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%)',
    primaryLight: 'linear-gradient(135deg, #FF9F5A 0%, #FFB884 100%)',
    hero: 'linear-gradient(135deg, #E4893D 0%, #FF9F5A 50%, #FFB884 100%)',
    background: 'linear-gradient(135deg, #FFFFFF 0%, #FEF5F0 100%)',
    cardBorder: 'linear-gradient(135deg, rgba(228, 137, 61, 0.2) 0%, rgba(255, 159, 90, 0.1) 100%)',
    cta: 'linear-gradient(135deg, rgba(228, 137, 61, 0.95) 0%, rgba(255, 159, 90, 0.95) 100%)',
  },
  spacing: {
    section: {
      mobile: '3rem', // py-12
      desktop: '5rem', // py-20
    },
    container: {
      padding: '1rem', // px-4
      paddingSm: '1.5rem', // px-6
      paddingLg: '2rem', // px-8
    },
  },
  borderRadius: {
    card: '1.125rem', // 18px
    cardLarge: '1.5rem', // 24px
    pill: '9999px',
    button: '0.75rem', // 12px
    input: '0.75rem', // 12px
  },
  shadows: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    cardSoft: '0 2px 8px 0 rgba(0, 0, 0, 0.08), 0 1px 4px 0 rgba(0, 0, 0, 0.04)',
    cardHover: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    cardLift: '0 20px 40px -4px rgba(228, 137, 61, 0.2)',
    cardGlow: '0 0 20px rgba(228, 137, 61, 0.15), 0 4px 12px rgba(228, 137, 61, 0.1)',
    button: '0 4px 12px rgba(228, 137, 61, 0.3)',
    buttonHover: '0 6px 16px rgba(228, 137, 61, 0.4)',
    buttonGlow: '0 0 0 4px rgba(228, 137, 61, 0.1)',
    floating: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  borders: {
    card: '1px solid rgba(0, 0, 0, 0.08)',
    cardHover: '1px solid rgba(228, 137, 61, 0.2)',
    button: '0',
    buttonSecondary: '2px solid rgba(0, 0, 0, 0.1)',
    gradient: '1px solid transparent',
  },
  animations: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '400ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    },
    stagger: {
      fast: 0.05,
      normal: 0.1,
      slow: 0.15,
    },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    },
    fontSize: {
      hero: {
        mobile: '2.25rem', // text-4xl
        desktop: '3.75rem', // text-6xl
      },
      h1: {
        mobile: '2rem', // text-3xl
        desktop: '2.5rem', // text-4xl
      },
      h2: {
        mobile: '1.75rem', // text-2xl
        desktop: '2rem', // text-3xl
      },
      body: '1rem', // text-base
      bodyLarge: '1.125rem', // text-lg
      small: '0.875rem', // text-sm
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  effects: {
    glass: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.5)',
    },
    hover: {
      lift: 'translateY(-4px)',
      rotate: 'rotate(1deg)',
      scale: 'scale(1.02)',
    },
  },
} as const

export type PublicTheme = typeof publicTheme
