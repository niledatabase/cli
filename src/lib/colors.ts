import chalk from 'chalk';

export const theme = {
  // Primary colors for main actions and headings
  primary: chalk.hex('#FF6B35'),     // Deep orange - more vibrant main brand color
  
  // Status colors
  success: chalk.hex('#00A676'),     // Deep teal - richer green
  warning: chalk.hex('#FFB800'),     // Rich amber - more visible warning
  error: chalk.hex('#FF4365'),       // Deep rose - stronger red
  
  // Information and secondary content
  info: chalk.hex('#7B61FF'),        // Rich purple - more vibrant
  secondary: chalk.hex('#64748B'),   // Dark slate - deeper neutral
  
  // Highlights and accents
  highlight: chalk.hex('#FF6B35'),   // Deep orange - matching primary
  accent: chalk.hex('#0EA5E9'),      // Electric blue - more vibrant
  
  // Specific use cases
  command: chalk.hex('#FF6B35'),     // Deep orange for commands
  param: chalk.hex('#7B61FF'),       // Rich purple for parameters
  url: chalk.hex('#0EA5E9'),         // Electric blue for URLs
  
  // Table formatting
  header: chalk.bold.hex('#FF6B35'), // Deep orange headers
  border: chalk.hex('#64748B'),      // Dark slate borders
  
  // Dim text for less important information
  dim: chalk.hex('#64748B').dim,
  
  // Formatting helpers
  bold: chalk.bold,
  underline: chalk.underline,
  
  // Status indicators
  active: chalk.hex('#00A676'),      // Deep teal for active/running
  inactive: chalk.hex('#64748B'),    // Dark slate for inactive/stopped
  pending: chalk.hex('#FFB800'),     // Rich amber for pending/processing
};

// Helper function for table borders
export const table = {
  topLeft: theme.border('┌'),
  topRight: theme.border('┐'),
  bottomLeft: theme.border('└'),
  bottomRight: theme.border('┘'),
  vertical: theme.border('│'),
  horizontal: theme.border('─'),
  cross: theme.border('┼'),
};

// Helper function for command examples
export function formatCommand(command: string, args?: string): string {
  return `${theme.command('$')} ${theme.command(command)}${args ? ' ' + theme.param(args) : ''}`;
}

// Helper function for URLs
export function formatUrl(url: string): string {
  return theme.url(url);
}

// Helper function for status
export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
    case 'success':
      return theme.active(status);
    case 'inactive':
    case 'stopped':
    case 'failed':
      return theme.inactive(status);
    case 'pending':
    case 'creating':
    case 'updating':
      return theme.pending(status);
    default:
      return theme.secondary(status);
  }
} 