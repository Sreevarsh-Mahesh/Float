import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Platform } from 'react-native';
import { storage } from './src/api/storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CoverageScreen from './src/screens/CoverageScreen';
import ClaimsScreen from './src/screens/ClaimsScreen';
import SimulationScreen from './src/screens/SimulationScreen';

// Weather Context & UI
import { WeatherProvider } from './src/context/WeatherContext';
import { WeatherBackground } from './src/components/WeatherBackground';

// Theme
import { colors } from './src/theme/colors';
import { LayoutDashboard, Shield, FileText, Beaker } from 'lucide-react-native';

function withFocus(WrappedComponent: React.ComponentType<any>) {
  return function FocusedComponent(props: any) {
    const isFocused = useIsFocused();
    if (!isFocused) return null;
    return <WrappedComponent {...props} />;
  };
}
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        lazy: true,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 20,
          right: 20,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.6)',
          borderRadius: 32,
          height: 64,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 15,
        },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          padding: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: 'transparent', borderRadius: 32 }} />
        )
      }}
    >
      <Tab.Screen
        name="Home"
        component={withFocus(DashboardScreen)}
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Coverage"
        component={withFocus(CoverageScreen)}
        options={{
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Claims"
        component={withFocus(ClaimsScreen)}
        options={{
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Simulate"
        component={withFocus(SimulationScreen)}
        options={{
          tabBarIcon: ({ color, size }) => <Beaker color={color} size={size - 2} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await storage.getItem('access_token');
        setUserToken(token);
      } catch (e) {
        console.error('Failed to restore token', e);
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'transparent',
      card: 'rgba(255,255,255,0.9)',
    },
  };

  return (
    <WeatherProvider>
      <View style={{ flex: 1, backgroundColor: '#dbeafe' }}>
        <WeatherBackground />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false, }}>
        {userToken == null ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="MainTabs" component={MainTabs} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
      </View>
    </WeatherProvider>
  );
}
