/**
 * SajiAman Global Error Boundary
 * Catches unhandled JavaScript render exceptions and displays a Swiss-Utilitarian
 * recovery screen with options to reset state and resume operation.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertOctagon, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { CivicButton } from './ui/CivicButton';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[SajiAman ErrorBoundary] Unhandled exception:', error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          style={[
            styles.safeArea,
            { paddingTop: Platform.OS === 'ios' ? 48 : 20, paddingBottom: 16 },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <ShieldAlert size={36} color="#B91C1C" strokeWidth={2.2} />
              </View>

              <View style={styles.headerBlock}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>SISTEM PEMULIHAN MANDIRI</Text>
                </View>
                <Text style={styles.title}>Terjadi Kendala Sistem</Text>
                <Text style={styles.subtitle}>
                  Aplikasi mendeteksi anomali pada antarmuka. Integritas data keamanan pangan dan catatan batch Anda di server tetap terlindungi secara aman.
                </Text>
              </View>

              <CivicButton
                variant="primary"
                icon={<RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />}
                onPress={this.handleReload}
              >
                Muat Ulang Aplikasi
              </CivicButton>

              <Pressable
                onPress={() =>
                  this.setState((prev) => ({ showDetails: !prev.showDetails }))
                }
                style={styles.detailsToggle}
              >
                <Text style={styles.detailsToggleText}>
                  {this.state.showDetails ? 'Sembunyikan Rincian Teknis' : 'Tampilkan Rincian Teknis'}
                </Text>
              </Pressable>

              {this.state.showDetails && (
                <View style={styles.detailsBox}>
                  <Text style={styles.errorName}>
                    {this.state.error?.name}: {this.state.error?.message}
                  </Text>
                  {this.state.errorInfo?.componentStack && (
                    <Text style={styles.stackText}>
                      {this.state.errorInfo.componentStack.slice(0, 500)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#7F1D1D',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
  },
  detailsToggle: {
    paddingVertical: 6,
  },
  detailsToggleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#0F4C81',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  errorName: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#F87171',
  },
  stackText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
  },
});
