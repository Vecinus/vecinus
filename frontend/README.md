# Guia de frontend

Este documento va dirigido a todo aquel que trabaje en el equipo de frontend o tenga la necesidad de ejecutar el frontend.
AVISO: TODO AQUEL QUE NO SE TOME EN SERIO EL DESARROLLO Y SE REPITA ALGO SIMILAR AL SPRINT 2 LO INVITO A ABANDONAR EL EQUIPO Y LA ASIGNATURA.


## Instalación y ejecución
Para instalar las dependencias del proyecto:
```bash
    npm install // Esto instala las dependencias del package.json
```

Para ejecutar el servidor de desarrollo:

```bash
    npm run dev
```

This will start the Expo Dev Server. Open the app in:
Esto iniciará el servidor de desarrollo de expo. Para abrir la app en alguna plataforma:

- **iOS**: Pulse `i` para iniciar el emulador de ios _(Mac only)_  
- **Android**: Pulse `a` para iniciar el emulador de android
- **Web**: Pulse `w` para ejecutarlo en una navegador

Tambien podeis escanear el QR usando la app [Expo Go](https://expo.dev/go) en vuestro dispositivo.

## Estructura del proyecto
Seguiremos en un principio la siguiente estructura de carpetas:
```text
app/
├── (drawer)/             
│   ├── [communityId]/      
│   │   ├── index.tsx        
│   ├── _layout.tsx        
│   └── home.tsx            
└── _layout.tsx           
```
Aquellas vistas que no dependan de un id se debe de avisar por el grupo para acordar la ruta

## Tecnologías usadas

Las tecnología que usaremos durante el desarrollo serán las siguientes:

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Nativewind Docs](https://www.nativewind.dev/)
- [React Native Reusables](https://reactnativereusables.com)
- [TanStack Query](https://tanstack.com/query/latest)
- [Axios](https://axios-http.com/docs/intro)

## Duda frecuente:
AVISO: AQUEL QUE PREGUNTE FRECUENTEMENTE POR ALGUNA DUDA DOCUMENTADA SU NOTA SE VERÁ AFECTADA POR ENTORPECER EL DESARROLLO.

### Error FAILED TO FETCH
Este error ocurre cuando el frontend es incapaz de comunicarse con el backend correctamente.
Algunos motivos son:
- El backend no está iniciado
- El .env no está ajustado a la red a la que estamos conectados. Para corregirlo lo más facil es comprobar cual es vuestra ip mediante:
```bash
    ipconfig // windows
    ip addr // linux
```



