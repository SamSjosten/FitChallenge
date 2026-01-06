// src/components/ui.tsx
// Basic UI components for FitChallenge

import React from 'react';
import {
  TouchableOpacity,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  TextInputProps,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';

// =============================================================================
// BUTTON
// =============================================================================

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const buttonStyles: ViewStyle[] = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    disabled && styles.button_disabled,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.buttonText,
    styles[`buttonText_${variant}`],
    styles[`buttonText_${size}`],
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={[buttonStyles, style]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' ? '#fff' : '#007AFF'} 
          size="small" 
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// INPUT
// =============================================================================

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ 
  label, 
  error, 
  style,
  containerStyle,
  ...props 
}: InputProps) {
  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error && styles.input_error,
          style,
        ]}
        placeholderTextColor="#999"
        {...props}
      />
      {error && <Text style={styles.inputError}>{error}</Text>}
    </View>
  );
}

// =============================================================================
// CARD
// =============================================================================

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      style={[styles.card, style]} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Wrapper>
  );
}

// =============================================================================
// LOADING SCREEN
// =============================================================================

export function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

// =============================================================================
// ERROR MESSAGE
// =============================================================================

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Button 
          title="Retry" 
          variant="outline" 
          size="small" 
          onPress={onRetry} 
        />
      )}
    </View>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  title, 
  message, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMessage}>{message}</Text>}
      {actionLabel && onAction && (
        <Button 
          title={actionLabel} 
          onPress={onAction}
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Button styles
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: {
    backgroundColor: '#007AFF',
  },
  button_secondary: {
    backgroundColor: '#E5E5EA',
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  button_danger: {
    backgroundColor: '#FF3B30',
  },
  button_disabled: {
    opacity: 0.5,
  },
  button_small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button_medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button_large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonText: {
    fontWeight: '600',
  },
  buttonText_primary: {
    color: '#fff',
  },
  buttonText_secondary: {
    color: '#000',
  },
  buttonText_outline: {
    color: '#007AFF',
  },
  buttonText_danger: {
    color: '#fff',
  },
  buttonText_small: {
    fontSize: 14,
  },
  buttonText_medium: {
    fontSize: 16,
  },
  buttonText_large: {
    fontSize: 18,
  },

  // Input styles
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  input_error: {
    borderColor: '#FF3B30',
  },
  inputError: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },

  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },

  // Error styles
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },

  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
