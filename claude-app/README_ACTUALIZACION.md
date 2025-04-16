# Actualización de Claude App

## Resumen de mejoras

Se ha realizado una actualización completa de Claude App para que funcione como un navegador web moderno y evite ser detectado como una aplicación Electron. Las principales mejoras incluyen:

### 1. Simulación de navegador

- Se ha modificado el User-Agent para simular un navegador Chrome actualizado
- Se han agregado encabezados HTTP específicos de Chrome para una simulación completa
- Se ha implementado un sistema para ocultar características propias de Electron
- Se han parchado APIs y propiedades del navegador para evitar la detección

### 2. Mejoras de funcionalidad

- Persistencia de sesiones y cookies (mantiene la sesión incluso después de cerrar la app)
- Soporte mejorado para CORS y recursos externos
- Gestión avanzada del portapapeles compatible con el 100% de los elementos de Claude
- Soporte completo para drag & drop de archivos
- Búsqueda en página (Ctrl+F) como un navegador real
- Menú contextual mejorado con opciones tipo navegador

### 3. Compatibilidad y rendimiento

- Se ha habilitado la aceleración por hardware para mejor rendimiento
- Se mantiene el estado y tamaño de la ventana entre sesiones
- Soporte ampliado para permisos de navegador (notificaciones, medios, etc.)
- Corregidas incompatibilidades con las APIs modernas de Claude
- Mejora en la detección de carga de la interfaz

### 4. Sistema de pruebas

- Implementado framework de pruebas automatizadas
- Opciones para pruebas headless (sin interfaz visual)
- Captura de pantallas para verificación visual
- Pruebas de funcionalidad de portapapeles, storage y cookies

## Cómo usar la aplicación

### Instalación de dependencias

```bash
npm install
```

### Ejecución

```bash
# Modo normal
npm start

# Modo desarrollo con logs
npm run dev

# Modo debug
npm run debug
```

### Pruebas

```bash
# Ejecutar pruebas interactivas
npm test

# Ejecutar pruebas sin interfaz
npm run test:headless

# Ejecutar pruebas con capturas de pantalla
npm run test:screenshots

# Ejecutar pruebas completas (headless + screenshots)
npm run test:full
```

### Compilación

```bash
# Compilar para todas las plataformas
npm run build

# Compilar específicamente para Linux
npm run build:linux

# Compilar AppImage
npm run build:appimage

# Compilar paquete Debian
npm run build:deb
```

## Notas técnicas

### Enfoque anti-detección

El enfoque para evitar la detección como Electron incluye:

1. **Nivel de red**: Modificación de User-Agent y encabezados HTTP
2. **Nivel DOM**: Reemplazo de propiedades del navegador y navigator
3. **Nivel API**: Implementación de APIs específicas de Chrome
4. **Nivel visual**: Implementación de comportamientos visuales y UX de navegador

### Persistencia y cookies

La persistencia se implementa mediante:

- Partición persistente para el almacenamiento de sesión
- Conversión automática de cookies de sesión a cookies persistentes
- Almacenamiento local del estado de la ventana

### Problemas conocidos y soluciones

- **Detección de Electron**: Si Claude implementa nuevos métodos de detección, se pueden agregar parches en `browser-detection-fix.js`
- **CORS**: Si hay problemas con recursos externos, revisar las reglas de dominio permitido en `main.js`
- **Portapapeles**: Para cualquier problema con el portapapeles, consultar `clipboard-fix.js`

## Pruebas realizadas

El sistema de pruebas automatizadas verifica:

1. Carga correcta de Claude
2. Simulación correcta de User-Agent
3. Funcionalidad de localStorage y sessionStorage
4. Detección correcta de interfaz de Claude
5. Funcionalidad del portapapeles
6. Persistencia de cookies

Para ejecutar las pruebas y ver los resultados detallados, utiliza los comandos de prueba mencionados anteriormente.