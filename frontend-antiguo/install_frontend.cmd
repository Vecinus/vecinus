@echo off
echo ========================================
echo  INSTALANDO DEPENDENCIAS FRONTEND VECINUS
echo ========================================

cd frontend

npm install expo
npx expo install react-native-gesture-handler react-native-reanimated
npm install @react-navigation/drawer
npm install zustand

echo ========================================
echo  INSTALACION COMPLETADA
echo ========================================
pause