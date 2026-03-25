import { theme } from './colors';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDatabaseName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Database name is required' };
  }
  
  if (name.length > 63) {
    return { valid: false, error: 'Database name must be 63 characters or less' };
  }
  
  if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
    return { valid: false, error: 'Database name must start with lowercase letter and contain only lowercase letters, numbers, underscores, and hyphens' };
  }
  
  const reservedWords = ['postgres', 'template0', 'template1', 'information_schema'];
  if (reservedWords.includes(name.toLowerCase())) {
    return { valid: false, error: `Database name cannot be a reserved word: ${reservedWords.join(', ')}` };
  }
  
  if (name.toLowerCase().startsWith('pg_')) {
    return { valid: false, error: 'Database name cannot start with "pg_"' };
  }
  
  return { valid: true };
}

export function validateTenantName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Tenant name is required' };
  }
  
  if (name.length > 255) {
    return { valid: false, error: 'Tenant name must be 255 characters or less' };
  }
  
  return { valid: true };
}

export function validateTenantId(id: string): ValidationResult {
  if (!id || id.trim().length === 0) {
    return { valid: false, error: 'Tenant ID is required' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'Tenant ID can only contain letters, numbers, hyphens, and underscores' };
  }
  
  if (id.length > 255) {
    return { valid: false, error: 'Tenant ID must be 255 characters or less' };
  }
  
  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (email.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or less' };
  }
  
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or less' };
  }
  
  return { valid: true };
}

// Region validation removed: region format and availability is validated by the control plane.
export function validateRegion(_region: string): ValidationResult {
  return { valid: true };
}

export function validateTableName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Table name is required' };
  }
  
  if (name.length > 63) {
    return { valid: false, error: 'Table name must be 63 characters or less' };
  }
  
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Table name must start with a letter or underscore and contain only letters, numbers, and underscores' };
  }
  
  return { valid: true };
}

export function assertValid(result: ValidationResult): void {
  if (!result.valid) {
    console.error(theme.error(`Validation error: ${result.error}`));
    process.exit(1);
  }
}

export function validateOrExit<T>(value: T, validator: (value: T) => ValidationResult): T | never {
  const result = validator(value as any);
  if (!result.valid) {
    console.error(theme.error(`Validation error: ${result.error}`));
    process.exit(1);
  }
  return value;
}
