/**
 * Float Design System — Color Palette
 * 
 * Cartoony, soft UI style
 */
export const colors = {
  // Brand
  primary: '#3B82F6',        // Blue 500
  primaryDark: '#2563EB',    // Blue 600
  primaryLight: '#DBEAFE',   // Blue 100
  primaryMid: '#60A5FA',     // Blue 400

  // Accent
  accent: '#F59E0B',         // Amber 500
  accentLight: '#FEF3C7',    // Amber 100

  // Neutral / Surfaces
  background: '#E0F2FE',     // Light Blue Sunny Default
  backgroundSunny: '#E0F2FE',
  backgroundRainy: '#CBD5E1',
  backgroundStormy: '#818CF8',
  
  surface: 'rgba(255, 255, 255, 0.9)', // glass-card
  surfaceSolid: '#FFFFFF',
  surfaceElevated: 'rgba(255, 255, 255, 0.8)',

  // Text Hierarchy
  text: '#1E293B',           // Slate 800
  textLightMode: '#0F172A',
  textSecondary: '#475569',  // Slate 600
  textMuted: '#94A3B8',      // Slate 400
  textLight: '#CBD5E1',      // Slate 300
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#059669',        
  successLight: '#D1FAE5',   
  successBg: '#ECFDF5',      
  warning: '#D97706',        
  warningLight: '#FEF3C7',   
  warningBg: '#FFFBEB',      
  danger: '#DC2626',         
  dangerLight: '#FEE2E2',    
  dangerBg: '#FEF2F2',       
  info: '#2563EB',           
  infoLight: '#DBEAFE',      

  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.7)',     // Cartoony border
  borderLight: 'rgba(255, 255, 255, 0.5)',
  borderHeavy: 'rgba(15, 23, 42, 0.15)', // Added to satisfy TS requirements

  // Shadows
  shadowLight: '#FFFFFF',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
  shadowMedium: 'rgba(0, 0, 0, 0.08)',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.4)',

  // Legacy compat
  tierBasic: '#F59E0B',      
  tierProtection: '#3B82F6', 
  tierAdvanced: '#8B5CF6',
  secondary: '#F43F5E',
  tertiary: '#14B8A6',
};
