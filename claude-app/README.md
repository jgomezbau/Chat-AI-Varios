# Claude Desktop App

**Versión 1.0.0**

Una aplicación de escritorio desarrollada utilizando **Electron**, que permite interactuar con **Claude** de manera independiente del navegador. La aplicación está optimizada para funcionar como un contenedor nativo, proporcionando todas las funcionalidades de Claude pero en una ventana de aplicación independiente.

## 🚀 Características principales

- **Interfaz independiente**: Ejecuta Claude directamente en el escritorio sin necesidad de un navegador web.
- **Soporte completo para el portapapeles**: Soluciona problemas de copiado en bloques de código y canvas.
- **Permisos para multimedia**: Acceso a cámara y micrófono cuando sea necesario.
- **Menú contextual mejorado**: Opciones para cortar, copiar, pegar, recargar, imprimir e inspeccionar.
- **Atajos de teclado**: Soporte para comandos comunes como Ctrl+C, Ctrl+V, Ctrl+R, etc.
- **Interfaz nativa**: Aspecto y comportamiento de aplicación nativa.

## ⚙️ Tecnologías utilizadas

- **Electron**: Framework para crear aplicaciones de escritorio con tecnologías web.
- **Node.js**: Entorno de ejecución para JavaScript del lado del servidor.
- **JavaScript/HTML/CSS**: Para la interfaz de usuario y comportamiento.
- **IPC (Inter-Process Communication)**: Para comunicación segura entre procesos.
- **electron-clipboard-extended**: Para mejorar la gestión del portapapeles.
- **electron-store**: Para almacenamiento local persistente.

## 🔧 Requisitos previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (versión 14.x o superior)
- **npm** (versión 6.x o superior)
- Para Linux: `libnotify4`, `libxtst6`, `libnss3` (necesarios para AppImage)

## 📦 Instalación desde código fuente

### Clonar e instalar dependencias

```bash
# Clonar el repositorio
git clone https://github.com/jgomezbau/claude-app.git

# Entrar al directorio
cd claude-app

# Instalar dependencias
npm install
```

### Scripts disponibles

```bash
# Iniciar en modo desarrollo
npm start

# Iniciar con logs habilitados
npm run dev

# Iniciar en modo depuración
npm run debug

# Construir para todas las plataformas
npm run build

# Construir específicamente para Linux
npm run build:linux

# Construir solo AppImage
npm run build:appimage

# Construir paquete .deb
npm run build:deb
```

## 📦 Instalación desde paquetes compilados

### Linux (Debian/Ubuntu)

1. Descarga el archivo .deb o .AppImage de la sección de releases
2. Para archivos .deb:
   ```bash
   sudo dpkg -i claude-app_1.0.0.deb
   ```

3. Para archivos .AppImage:
   ```bash
   chmod +x Claude_App_1.0.0.AppImage
   ./Claude_App_1.0.0.AppImage
   ```

## 🔍 Guía de uso

### Menú contextual
- **Clic derecho** en cualquier parte de la ventana para acceder a las opciones disponibles.
- **Opciones de edición**: Cortar, Copiar, Pegar, Seleccionar todo.
- **Opciones de aplicación**: Recargar, Imprimir, Inspeccionar.

### Copiado de texto y bloques de código
- Utiliza el botón "Copiar" en bloques de código.
- Selecciona texto y usa Ctrl+C o clic derecho > Copiar.
- La aplicación maneja automáticamente los problemas de copiado en canvas.

### Atajos de teclado globales
- **Ctrl+R**: Recargar la aplicación.
- **Ctrl+Shift+I**: Abrir herramientas de desarrollo.
- **Ctrl+Q**: Salir de la aplicación.

## 🧪 Solución de problemas

### Problemas con el portapapeles
Si experimentas problemas al copiar texto:
1. Reinicia la aplicación (Ctrl+R)
2. Verifica que no haya otra aplicación bloqueando el portapapeles
3. En Linux, asegúrate de tener instalados los paquetes `xclip` o `xsel`

### Problemas de conexión
Si no puedes conectar con Claude:
1. Verifica tu conexión a internet
2. Asegúrate de tener una cuenta activa en OpenAI
3. Reinicia la aplicación

## 🔄 Actualización

Para actualizar a la última versión:

1. Descarga la última versión desde la sección de releases
2. Desinstala la versión anterior (si usaste .deb)
3. Instala la nueva versión

## 🛠️ Desarrollo y contribución

Si deseas contribuir al proyecto:

1. Haz un fork del repositorio
2. Crea una nueva rama: `git checkout -b feature/nueva-caracteristica`
3. Realiza tus cambios y haz commit: `git commit -am 'Añadir nueva característica'`
4. Envía tus cambios: `git push origin feature/nueva-caracteristica`
5. Abre un Pull Request

### Estructura del proyecto

```
claude-app/
├── icons/               # Iconos de la aplicación
├── src/                 # Código fuente
│   ├── preload/         # Scripts de precarga
│   │   ├── clipboard-fix.js     # Solución para problemas del portapapeles
│   │   ├── inject-styles.js     # Estilos CSS para inyectar
│   │   ├── ipc.js               # Comunicación entre procesos
│   │   └── preload.js           # Script principal de precarga
│   ├── index.html       # Página HTML inicial
│   └── styles.css       # Estilos CSS
├── main.js              # Archivo principal de Electron
├── package.json         # Dependencias y configuración
└── README.md            # Documentación
```

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo LICENSE para más detalles.

---
## para tener en cuenta cuando ejecutes.
    "start": "electron .",
    "dev": "electron . --enable-logging",
    "debug": "electron --inspect=5858 .",
    "build": "electron-builder",
    "build:linux": "electron-builder --linux",
    "build:appimage": "electron-builder --linux AppImage",
    "build:deb": "electron-builder --linux deb",
    "postinstall": "electron-builder install-app-deps"


Desarrollado con ❤️ por Juan Bau (jgomezbau@gmail.com)