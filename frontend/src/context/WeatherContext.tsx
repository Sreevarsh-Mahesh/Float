import React, { createContext, useContext, useState } from 'react';

export type WeatherType = 'sunny' | 'rainy' | 'thunderstorm' | 'aqi' | 'heat' | 'rain' | 'closure' | 'platform' | 'road' | 'unpaid';

interface WeatherContextProps {
  weather: WeatherType;
  setWeather: (w: WeatherType) => void;
}

export const WeatherContext = createContext<WeatherContextProps>({
  weather: 'sunny',
  setWeather: () => {},
});

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [weather, setWeather] = useState<WeatherType>('sunny');

  return (
    <WeatherContext.Provider value={{ weather, setWeather }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => useContext(WeatherContext);
