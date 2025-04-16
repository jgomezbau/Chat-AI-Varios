# AI Desktop Apps
# Chat-AI-Varios

**Versión 2.0.0**

Este repositorio contiene cinco aplicaciones de escritorio, desarrolladas utilizando **Tauri**, que permiten a los usuarios interactuar con diferentes modelos de inteligencia artificial de manera independiente del navegador. Cada aplicación está centrada en una IA diferente, proporcionando una experiencia de usuario fluida y accesible para aquellos que prefieren tener una IA en su escritorio sin depender de un navegador web.

### Los cinco proyectos disponibles son:

- **ChatGPT Desktop App**: Interactúa con el modelo **ChatGPT** de OpenAI.
- **DeepSeek Desktop App**: Interactúa con el modelo **DeepSeek**.
- **Qwen Desktop App**: Interactúa con el modelo **Qwen**.
- **Claude Desktop App**: Interactúa con el modelo **Claude**.
- **Grok Desktop App**: Interactúa con el modelo **Grok AI**.

Cada uno de estos proyectos funciona de manera similar, pero conecta con una IA distinta. Puedes elegir el proyecto que prefieras según la IA que desees utilizar.

## Características Comunes

- **Interfaz Independiente**: Ejecuta la IA directamente en el escritorio sin necesidad de un navegador web.
- **Mayor Rendimiento**: Utilizando Tauri con el motor web nativo del sistema y Rust para el backend.
- **Permisos para cámara y micrófono**: Las aplicaciones están configuradas para solicitar permisos cuando sea necesario.
- **Menú contextual personalizado**: Se ha habilitado un menú contextual con opciones como cortar, copiar, pegar, recargar, imprimir, y más.
- **Recarga automática**: Las aplicaciones permiten recargar la página de la IA fácilmente desde el menú contextual.

## Tecnologías utilizadas

- **Tauri**: Framework para crear aplicaciones de escritorio eficientes usando Rust y tecnologías web.
- **Rust**: Lenguaje de programación para el backend, ofreciendo rendimiento y seguridad.
- **HTML/CSS/JavaScript**: Para la interfaz de usuario.

## Clona este repositorio:
```
git clone https://github.com/jgomezbau/Chat-AI-Varios.git
```

## Requisitos para compilar
- Rust y Cargo (https://rustup.rs/)
- Node.js y npm

## Compilación y ejecución (Dentro de la carpeta de la aplicación)
```
npm install
npm run tauri build
```

## Ventajas de Tauri sobre Electron
- **Menor tamaño**: Las aplicaciones Tauri son mucho más pequeñas que las equivalentes en Electron
- **Mejor rendimiento**: Uso más eficiente de recursos del sistema
- **Mayor seguridad**: Gracias al modelo de seguridad de Rust y su API restrictiva

