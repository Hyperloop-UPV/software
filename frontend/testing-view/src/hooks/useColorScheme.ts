import { useColorSchemeStore } from "../store/useColorSchemeStore";

export const useColorScheme = () => {
  const { colorScheme, setColorScheme } = useColorSchemeStore();

  return {
    colorScheme,
    setColorScheme,
  };
};
