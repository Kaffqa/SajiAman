import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface ScanLaserOverlayProps {
  active?: boolean;
  height?: number;
}

/**
 * Smooth vertical sweeping laser bar inside the QR reticle so the viewfinder feels active.
 */
export const ScanLaserOverlay: React.FC<ScanLaserOverlayProps> = ({
  active = true,
  height = 128,
}) => {
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (!active) {
      cancelAnimation(translateY);
      translateY.value = 8;
      return;
    }
    translateY.value = 8;
    translateY.value = withRepeat(
      withTiming(height - 10, {
        duration: 1700,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(translateY);
    };
  }, [active, height, translateY]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!active) return null;

  return (
    <View className="absolute inset-0 overflow-hidden pointer-events-none px-2">
      <Animated.View
        style={[
          {
            height: 2.5,
            borderRadius: 2,
            backgroundColor: '#38BDF8',
            shadowColor: '#38BDF8',
            shadowOpacity: 0.9,
            shadowRadius: 6,
            elevation: 4,
          },
          laserStyle,
        ]}
      />
    </View>
  );
};
