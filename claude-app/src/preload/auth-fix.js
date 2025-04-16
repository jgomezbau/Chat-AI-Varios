// Script para mejorar la autenticación con Google y otros proveedores

const authFixScript = `
(function() {
  // Variables de estado para rastreo del flujo de autenticación
  let inAuthFlow = false;
  let currentAuthStep = '';
  let authFlowStartTime = 0;
  
  // Guardar la versión original de funciones que vamos a reemplazar
  let _origPostMessage = window.postMessage;
  const originalWindowOpen = window.open;
  
  // Interceptar y corregir mensajes de postMessage para la autenticación de Google
  window.postMessage = function() {
    // Verificar si este es un mensaje de OAuth que viene de Google
    if (arguments.length > 0 && typeof arguments[0] === 'string' && 
        (arguments[0].includes('oauth2relay') || 
         arguments[0].includes('oauth2_relay') || 
         arguments[0].includes('storagerelay'))) {
      
      try {
        // Marcar que estamos en un flujo de autenticación
        inAuthFlow = true;
        
        // Llamar a la función original primero
        _origPostMessage.apply(this, arguments);
        
        // Verificar si estamos en la página de aprobación final del OAuth
        if (window.location.href.includes('approval') || 
            window.location.href.includes('consent')) {
          currentAuthStep = 'consent';
          
          // Añadir un pequeño retraso para asegurar que la redirección ocurra correctamente
          setTimeout(function() {
            // Verificar si hay un botón de aprobación no clicado y clicarlo automáticamente
            const approveButtonSelectors = [
              'button[id="submit_approve_access"]', 
              'button[name="approve"]',
              'button[id="accept"]',
              'button[id="submit"]',
              'button[id="continue"]',
              'div[role="button"][aria-label*="Accept"]',
              'div[role="button"][aria-label*="Allow"]',
              'button:not([id="cancel-button"]):not([id="back-button"])'
            ];
            
            // Intentar cada uno de los selectores
            for (const selector of approveButtonSelectors) {
              const button = document.querySelector(selector);
              // Verificar que el botón existe y es visible
              if (button && button.offsetParent !== null) {
                try {
                  button.click();
                  break; // Salir después del primer clic exitoso
                } catch (e) {
                  // Silenciar error
                }
              }
            }
            
            // Si hay un código de autorización en la URL, extraerlo y redirigir manualmente
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code') || urlParams.get('approval_code');
            
            if (code) {
              // Forzar redirección a Claude después de un pequeño retraso
              setTimeout(function() {
                window.location.href = 'https://claude.ai/?' + new Date().getTime();
              }, 800);
            }
          }, 800);
        }
      } catch (e) {
        // Usar la función original como fallback
        _origPostMessage.apply(this, arguments);
      }
    } else {
      // Para mensajes normales, usar el comportamiento predeterminado
      _origPostMessage.apply(this, arguments);
    }
  };
  
  // Detector simplificado de estado de autenticación
  function detectAuthenticationState() {
    // Detectar si estamos en una página de autenticación
    const hostname = window.location.hostname;
    
    // Detectar proveedores específicos
    const isGoogleAuthPage = hostname.includes('accounts.google.com');
    const isMicrosoftAuthPage = hostname.includes('login.live.com') || 
                               hostname.includes('login.microsoftonline.com');
    const isAppleAuthPage = hostname.includes('appleid.apple.com');
    
    // Comprobar si estamos en una página de autenticación
    const isAuthPage = isGoogleAuthPage || isMicrosoftAuthPage || isAppleAuthPage;
    
    // Si no estamos en una página de autenticación, no seguir analizando
    if (!isAuthPage) return { isAuthPage: false };
    
    // Determinar el paso específico de autenticación para cada proveedor
    let authStep = 'unknown';
    
    try {
      // Detectar paso específico para Google
      if (isGoogleAuthPage) {
        // Detectar entrada de correo electrónico - detectar solo elementos visibles
        const emailInput = document.querySelector('#identifierId') || 
                         document.querySelector('input[type="email"]');
        if (emailInput && emailInput.offsetParent !== null) {
          authStep = 'identifier';
        }
        // Detectar entrada de contraseña - detectar solo elementos visibles
        else if (document.querySelector('input[type="password"]') && 
                document.querySelector('input[type="password"]').offsetParent !== null) {
          authStep = 'password';
        }
        // Detectar verificación en dos pasos - buscar texto o elementos específicos
        else if (document.querySelector('[id*="challenge"]') || 
                document.querySelector('[data-challengetype]') ||
                document.body.textContent.includes('verificación') ||
                document.body.textContent.includes('verification')) {
          authStep = 'verification';
        }
        // Detectar pantalla de consentimiento
        else if (window.location.href.includes('consent') || 
                window.location.href.includes('oauth/approval') ||
                document.querySelector('[id*="consent"]')) {
          authStep = 'consent';
        }
      }
    } catch (e) {
      // Silenciar errores
    }
    
    return {
      isAuthPage,
      provider: isGoogleAuthPage ? 'google' : (isMicrosoftAuthPage ? 'microsoft' : 'apple'),
      authStep
    };
  }
  
  // Función mejorada para manejar formularios de autenticación
  function enhanceAuthForms(authState) {
    if (!authState || !authState.isAuthPage) return;
    
    // Mejoras específicas para Google
    if (authState.provider === 'google') {
      // Buscar todos los formularios relevantes
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        if (!form.hasAttribute('auth-enhanced')) {
          form.setAttribute('auth-enhanced', 'true');
          
          // Mejorar el envío del formulario
          form.addEventListener('submit', () => {
            // Actualizar estado de autenticación
            currentAuthStep = authState.authStep;
            
            // Para el paso de email, guardar el email usado
            if (authState.authStep === 'identifier') {
              const emailInput = form.querySelector('input[type="email"]') || form.querySelector('#identifierId');
              if (emailInput && emailInput.value) {
                try {
                  // Guardar el email para uso futuro si es necesario reintentar
                  localStorage.setItem('last_auth_email', emailInput.value);
                } catch (e) {
                  // Silenciar error
                }
              }
            }
          });
        }
      });
      
      // Mejorar botones relevantes
      const buttonSelectors = [
        '#identifierNext', 
        '#passwordNext', 
        'button[type="submit"]', 
        'div[role="button"]'
      ];
      
      // Unir todos los selectores con comas
      const selector = buttonSelectors.join(', ');
      const buttons = document.querySelectorAll(selector);
      
      buttons.forEach(button => {
        // Solo mejorar botones que son visibles
        if (button.offsetParent !== null && !button.hasAttribute('click-enhanced')) {
          button.setAttribute('click-enhanced', 'true');
          button.setAttribute('data-auth-button', 'true');
        }
      });
      
      // Detectar campos de entrada específicos según el paso
      if (authState.authStep === 'identifier') {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('#identifierId');
        if (emailInput && !emailInput.value && localStorage.getItem('last_auth_email')) {
          // Auto-rellenar email de intentos anteriores para evitar reingreso
          emailInput.value = localStorage.getItem('last_auth_email');
        }
      }
    }
  }
  
  // Detectar y manejar redirecciones de autenticación
  const handleAuthRedirect = () => {
    // Detectar estado actual de autenticación
    const authState = detectAuthenticationState();
    
    // Comprobar si estamos en una página de autenticación
    if (authState.isAuthPage) {
      // Si es nuestra primera detección, registrar el inicio del flujo
      if (!inAuthFlow) {
        inAuthFlow = true;
        authFlowStartTime = Date.now();
      }
      
      // Actualizar el paso actual
      currentAuthStep = authState.authStep;
      
      // Asegurarse que los formularios de autenticación funcionen correctamente
      enhanceAuthForms(authState);
      
      // Configurar un observador para detectar cambios dinámicos en la página
      const observer = new MutationObserver((mutations) => {
        let shouldEnhance = false;
        
        for (const mutation of mutations) {
          // Verificar cambios que podrían indicar nuevos elementos o cambios de estado
          if (mutation.addedNodes.length > 0 || 
              (mutation.type === 'attributes' && 
               (mutation.target.tagName === 'INPUT' || mutation.target.tagName === 'BUTTON'))) {
            shouldEnhance = true;
            break;
          }
        }
        
        // Si detectamos cambios significativos, reaplicar mejoras
        if (shouldEnhance) {
          const newState = detectAuthenticationState();
          enhanceAuthForms(newState);
        }
      });
      
      // Observar cambios en todo el DOM
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'disabled', 'aria-hidden']
      });
      
      // Parchar window.open para manejar mejor ventanas emergentes de autenticación
      window.open = function() {
        try {
          // Llamar a la implementación original
          return originalWindowOpen.apply(this, arguments);
        } catch (e) {
          // Intentar manejar el caso de error redirigiendo en la ventana actual
          if (arguments.length > 0 && typeof arguments[0] === 'string') {
            const url = arguments[0];
            if (url.includes('accounts.google.com') || 
                url.includes('login.microsoftonline.com') ||
                url.includes('appleid.apple.com')) {
              window.location.href = url;
            }
          }
          return null;
        }
      };
      
      // Detección de estancamiento más simple
      let lastAuthStep = authState.authStep;
      let lastStepChangeTime = Date.now();
      
      // Verificar cambios en el estado de autenticación cada 10 segundos
      const authCheckInterval = setInterval(() => {
        const newState = detectAuthenticationState();
        
        // Si cambia el paso, actualizar estado
        if (newState.authStep !== lastAuthStep) {
          lastAuthStep = newState.authStep;
          lastStepChangeTime = Date.now();
        }
      }, 10000);
      
      // Limpiar el intervalo después de 3 minutos para evitar fugas de memoria
      setTimeout(() => {
        clearInterval(authCheckInterval);
      }, 180000); // 3 minutos
    }
    
    // Detectar si estamos en la página de callback de autenticación
    const isAuthCallback = window.location.href.includes('oauth/callback') || 
                          window.location.href.includes('oauth2/callback') ||
                          window.location.href.includes('signin-oidc') ||
                          window.location.href.includes('auth/callback');
    
    if (isAuthCallback) {
      // Extraer parámetros de autenticación
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Marcar que completamos la autenticación
        try {
          sessionStorage.setItem('oauth_completed', 'true');
          sessionStorage.setItem('oauth_completion_time', Date.now().toString());
        } catch (e) {
          // Silenciar error
        }
        
        // Redirigir a Claude con el código de autorización
        setTimeout(() => {
          window.location.href = 'https://claude.ai/?' + Date.now();
        }, 800);
      }
    }
    
    // Procesar mensajes de ventanas emergentes de autenticación
    window.addEventListener('message', function(event) {
      // Solo procesar mensajes relacionados con autenticación
      if (typeof event.data === 'object' && event.data !== null) {
        // Detectar mensajes de popup-auth-helper.js
        if (event.data.type) {
          switch (event.data.type) {
            case 'auth_complete':
            case 'auth_code_received':
              // Marcar finalización y recargar para aplicar autenticación
              sessionStorage.setItem('oauth_completed', 'true');
              
              // Esperar un momento y recargar la aplicación
              setTimeout(() => {
                window.location.href = 'https://claude.ai/?' + Date.now();
              }, 1000);
              break;
          }
        }
      } 
      // Compatibilidad con mensajes de string simples (formato antiguo)
      else if (typeof event.data === 'string' && 
          (event.data.includes('oauth') || 
           event.data.includes('token') || 
           event.data.includes('code') ||
           event.data.includes('auth'))) {
        
        // Intentar extraer información relevante
        if (event.data.includes('auth_complete') || event.data.includes('code_received')) {
          sessionStorage.setItem('oauth_completed', 'true');
          
          // Recargar después de autenticación exitosa
          setTimeout(() => {
            window.location.href = 'https://claude.ai/?' + Date.now();
          }, 1000);
        }
      }
    }, false);
    
    // Asistencia específica para Claude después de autenticación
    if (window.location.hostname.includes('claude.ai')) {
      // Si acabamos de completar autenticación, forzar refresh de token/sesión
      if (sessionStorage.getItem('oauth_completed')) {
        // Obtener el timestamp de finalización
        const completionTime = parseInt(sessionStorage.getItem('oauth_completion_time') || '0');
        const now = Date.now();
        
        // Solo procesar si es reciente (menos de 5 minutos)
        if (now - completionTime < 300000 || completionTime === 0) {
          // Limpiar el flag para evitar bucles
          sessionStorage.removeItem('oauth_completed');
          sessionStorage.removeItem('oauth_completion_time');
          
          // Forzar recarga después de un breve retardo
          setTimeout(() => {
            // Verificar si la sesión ya está activa
            const hasUserMenu = !!document.querySelector('[aria-label="User Menu"], [class*="userMenu"], [class*="avatar"]');
            
            if (!hasUserMenu) {
              window.location.href = 'https://claude.ai/?' + Date.now();
            }
          }, 2000);
        }
      }
      
      // Monitorear estado de sesión
      let sessionCheckAttempts = 0;
      const maxSessionCheckAttempts = 5;
      
      const checkLoginState = setInterval(() => {
        sessionCheckAttempts++;
        
        // Buscar elementos que indiquen que estamos logueados
        const userMenu = document.querySelector('[aria-label="User Menu"], [class*="userMenu"], [class*="avatar"]');
        const chatContainer = document.querySelector('[class*="conversation"], [class*="chat"], main');
        
        // Si encontramos indicadores de sesión activa
        if (userMenu || chatContainer) {
          clearInterval(checkLoginState);
          
          // Resetear variables de flujo de autenticación
          inAuthFlow = false;
          currentAuthStep = '';
          
          // Guardar token de éxito para referencia futura
          try {
            localStorage.setItem('auth_success_timestamp', Date.now().toString());
          } catch (e) {
            // Silenciar error
          }
        } 
        // Si llevamos varios intentos sin detectar sesión, podría haber un problema
        else if (sessionCheckAttempts >= maxSessionCheckAttempts) {
          clearInterval(checkLoginState);
          
          // Solo recargar si realmente acabamos de autenticar
          if (sessionStorage.getItem('oauth_completed')) {
            sessionStorage.removeItem('oauth_completed');
            
            // Esperar un momento más largo antes de recargar
            setTimeout(() => {
              window.location.href = 'https://claude.ai/?' + Date.now();
            }, 3000);
          }
        }
      }, 2000); // Verificar cada 2 segundos
      
      // Limpiar el intervalo después de 30 segundos para evitar fugas de memoria
      setTimeout(() => {
        clearInterval(checkLoginState);
      }, 30000);
    }
  };
  
  // Ejecutar el código inmediatamente
  handleAuthRedirect();
  
  // También ejecutar cuando cambie la URL (redirecciones, cambios en la SPA)
  let lastUrl = window.location.href;
  
  // Crear un observador para detectar cambios en la URL
  const urlChangeObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (lastUrl !== currentUrl) {
      lastUrl = currentUrl;
      
      // Procesar el nuevo estado de la página
      setTimeout(handleAuthRedirect, 300);
    }
  });
  
  // Observar cambios en varios elementos que podrían indicar cambio de URL en SPAs
  if (document.querySelector('title')) {
    urlChangeObserver.observe(document.querySelector('title'), {
      subtree: true,
      characterData: true,
      childList: true
    });
  }
  
  // También observar cambios en todo el cuerpo cuando podría haber redirecciones SPA
  // que no actualicen el título
  urlChangeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
})();
`;

module.exports = { authFixScript };