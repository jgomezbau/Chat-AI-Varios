// Script auxiliar para la ventana emergente de autenticación

const popupAuthHelper = `
(function() {
  // Variables para seguimiento del estado de autenticación
  let authAttempted = false;
  let messagesSent = 0;
  let isClosing = false;
  let inMultiStepAuth = false;
  let lastAuthStep = '';
  let authStepCount = 0;
  
  // Función para enviar mensajes a la ventana principal con mejor manejo de errores
  function sendMessageToParent(message) {
    try {
      // Verificar que estamos en una ventana emergente
      if (!window.opener) {
        // Intentar IPC como fallback
        if (window.electronIPC) {
          window.electronIPC.send('auth-message', message);
          messagesSent++;
          return true;
        }
        return false;
      }
      
      // Intentar enviar mensaje con postMessage
      window.opener.postMessage(message, '*');
      messagesSent++;
      return true;
    } catch (error) {
      // Intentar IPC como último recurso
      try {
        if (window.electronIPC) {
          window.electronIPC.send('auth-message', message);
          return true;
        }
      } catch (e) {
        // Error fallback silencioso
      }
      return false;
    }
  }
  
  // Función para detectar si estamos en una página de finalización/redireccionamiento
  function isCompletionPage() {
    return window.location.href.includes('blank') || 
           window.location.href.includes('close') ||
           window.location.href.includes('success') ||
           window.location.href.includes('done') ||
           window.location.href.includes('canceled') ||
           window.location.href.includes('callback') ||
           window.location.href === 'about:blank';
  }
  
  // Función para detectar si estamos en un flujo de autenticación de múltiples pasos
  function detectAuthenticationStep() {
    // Detectar elementos específicos de Google para los diferentes pasos de autenticación
    const isIdentifierStep = !!document.querySelector('#identifierId') || 
                           !!document.querySelector('input[type="email"]') ||
                           document.title.includes('Sign in with Google');
    
    const isPasswordStep = !!document.querySelector('input[type="password"]') || 
                         !!document.querySelector('[aria-label*="password" i]');
    
    const isVerificationStep = document.body.textContent.includes('verification') || 
                             document.body.textContent.includes('verificación') ||
                             document.body.textContent.includes('2-Step Verification') ||
                             !!document.querySelector('[id*="challenge"]');
    
    const isConsentStep = window.location.href.includes('consent') ||
                        window.location.href.includes('oauth/approval') ||
                        !!document.querySelector('[id*="consent"]');
    
    // Detectar el paso actual basado en los elementos encontrados
    let currentStep = 'unknown';
    if (isIdentifierStep) currentStep = 'identifier';
    else if (isPasswordStep) currentStep = 'password';
    else if (isVerificationStep) currentStep = 'verification';
    else if (isConsentStep) currentStep = 'consent';
    
    // Verificar si estamos en un flujo de múltiples pasos
    if (currentStep !== 'unknown' && currentStep !== lastAuthStep) {
      authStepCount++;
      inMultiStepAuth = authStepCount > 1;
      lastAuthStep = currentStep;
    }
    
    return {
      step: currentStep,
      inMultiStepAuth: inMultiStepAuth,
      isNewStep: currentStep !== 'unknown' && currentStep !== lastAuthStep
    };
  }
  
  // Función para extraer códigos de autorización de la URL con mejor manejo de errores
  function extractAuthCode() {
    try {
      // Intentar extraer del URL actual
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      
      // Verificar parámetros comunes de OAuth
      if (params.has('code')) {
        return { type: 'code', value: params.get('code') };
      }
      
      if (params.has('token')) {
        return { type: 'token', value: params.get('token') };
      }
      
      if (params.has('access_token')) {
        return { type: 'access_token', value: params.get('access_token') };
      }
      
      // Buscar también en el fragmento de hash
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        if (hashParams.has('code')) {
          return { type: 'code', value: hashParams.get('code') };
        }
        
        if (hashParams.has('token') || hashParams.has('access_token')) {
          const token = hashParams.get('token') || hashParams.get('access_token');
          return { type: 'token', value: token };
        }
      }
      
      // Buscar en el DOM si los métodos anteriores fallan
      // Google a veces inserta el código en el HTML
      const codeElement = document.querySelector('[data-code], [name="code"], input[value*="ya29."]');
      if (codeElement && codeElement.value) {
        return { type: 'element', value: codeElement.value };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  // Función para verificar si estamos completamente autenticados
  function checkAuthComplete() {
    // Detectar elementos que indican finalización de auth
    const successIndicators = [
      document.querySelector('.signin-success'),
      document.querySelector('.auth-success'),
      document.querySelector('.logged-in'),
      document.querySelector('[data-auth-complete="true"]'),
      document.title.includes('Success') || document.title.includes('Éxito')
    ];
    
    return successIndicators.some(indicator => !!indicator);
  }
  
  // Función mejorada para manejar la ventana emergente de autenticación
  function handlePopupAuth() {
    // Si ya estamos en proceso de cierre, no continuar
    if (isClosing) return;
    
    // Detectar en qué paso de autenticación estamos
    const authState = detectAuthenticationStep();
    
    // Si estamos en un flujo de múltiples pasos, no cerrar la ventana hasta completar
    if (authState.step !== 'unknown') {
      // Notificar a la ventana principal sobre el paso actual
      sendMessageToParent({
        type: 'auth_step_change',
        step: authState.step,
        url: window.location.href,
        title: document.title
      });
      
      // Procesar formularios de autenticación inmediatamente sin delays
      processAuthForm(authState);
    }
    
    // Verificar si estamos en una página de finalización
    if (isCompletionPage() || checkAuthComplete()) {
      // Solo considerar como finalización si no estamos en un paso intermedio
      // o si ya hemos pasado por varios pasos (lo que indica que completamos el flujo)
      if (!authState.inMultiStepAuth || authStepCount >= 3) {
        // Marcar para evitar procesamientos duplicados
        if (!authAttempted) {
          authAttempted = true;
          
          // Enviar mensaje a la ventana principal
          sendMessageToParent({
            type: 'auth_complete',
            url: window.location.href
          });
          
          // Marcar que estamos cerrando y cerrar la ventana
          isClosing = true;
          
          // Cerrar la ventana
          try {
            window.close();
          } catch (e) {
            // Silenciar error
          }
          
          return;
        }
      }
    }
    
    // Buscar código de autorización
    const authData = extractAuthCode();
    if (authData) {
      // Solo procesar el código si no estamos en un paso intermedio
      // o si es un código real (no un token temporal entre pasos)
      if ((!authState.inMultiStepAuth || authStepCount >= 3) && !authAttempted) {
        authAttempted = true;
        
        // Enviar código a la ventana principal
        sendMessageToParent({
          type: 'auth_code_received',
          codeType: authData.type,
          code: authData.value,
          url: window.location.href
        });
        
        // Marcar que estamos cerrando
        isClosing = true;
        
        // Cerrar la ventana
        try {
          window.close();
        } catch (e) {
          // Silenciar error
        }
        
        return;
      }
    }
    
    // Detectar errores de autenticación
    const errorMessages = document.querySelectorAll('.error-message, .error, [role="alert"]');
    if (errorMessages.length > 0) {
      // Enviar mensaje de error a la ventana principal
      const errorTexts = Array.from(errorMessages).map(el => el.textContent.trim());
      if (errorTexts.length > 0) {
        sendMessageToParent({
          type: 'auth_error',
          errors: errorTexts,
          step: authState.step
        });
      }
    }
  }
  
  // Función separada para procesar formularios de autenticación
  function processAuthForm(authState) {
    // Si estamos en cualquier tipo de página de formulario de autenticación
    if (authState.step !== 'unknown') {
      // Lista ampliada de selectores para botones de aprobación
      const approveButtonSelectors = [
        'button[id="submit_approve_access"]',
        'button[name="approve"]',
        'button[id="accept"]',
        'button[id="submit"]',
        'button[id="continue"]',
        'button[id="next"]',
        'button[id="identifierNext"]',
        'button[id="passwordNext"]',
        'button[id="submit"]',
        'button:not([id="cancel-button"]):not([id="back-button"])',
        'input[type="submit"][value="Allow"]',
        'input[type="submit"][value="Accept"]',
        'input[type="submit"][value="Continue"]',
        'input[type="submit"][value="Next"]',
        'div[role="button"][aria-label*="Next"]',
        'div[role="button"][aria-label*="Accept"]',
        'div[role="button"][aria-label*="Allow"]'
      ];
      
      // Intentar encontrar un botón que coincida
      for (const selector of approveButtonSelectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) { // Verificar visibilidad
          // No hacer clic automático en los pasos de entrada de datos
          if (authState.step !== 'identifier' && authState.step !== 'password' && authState.step !== 'verification') {
            try {
              button.click();
              break; // Salir después del primer clic exitoso
            } catch (e) {
              // Silenciar error
            }
          }
        }
      }
      
      // Detectar campos de entrada según el paso de autenticación
      if (authState.step === 'identifier') {
        // Buscar campo de email para asistencia
        const emailField = document.querySelector('input[type="email"], input[name="Email"], input[id="identifierId"]');
        if (emailField && emailField.offsetParent !== null) {
          // Notificar a la ventana principal que se necesita entrada de usuario
          sendMessageToParent({
            type: 'auth_input_needed',
            inputType: 'email',
            step: 'identifier'
          });
        }
      } else if (authState.step === 'password') {
        // Buscar campo de contraseña
        const passwordField = document.querySelector('input[type="password"]');
        if (passwordField && passwordField.offsetParent !== null) {
          sendMessageToParent({
            type: 'auth_input_needed',
            inputType: 'password',
            step: 'password'
          });
        }
      } else if (authState.step === 'verification') {
        // Detectar tipo de verificación (código, teléfono, etc.)
        let verificationType = 'unknown';
        
        if (document.body.textContent.includes('phone')) {
          verificationType = 'phone';
        } else if (document.body.textContent.includes('code')) {
          verificationType = 'code';
        }
        
        sendMessageToParent({
          type: 'auth_input_needed',
          inputType: 'verification',
          verificationType: verificationType,
          step: 'verification'
        });
      }
    }
  }
  
  // Mejorar manejo de errores en la ventana emergente
  window.addEventListener('error', function(event) {
    // Enviar información de error a la ventana principal
    sendMessageToParent({
      type: 'popup_error',
      message: event.message,
      url: window.location.href
    });
  });
  
  // Configurar API de mensajería para la ventana principal
  window.addEventListener('message', function(event) {
    // Solo procesar mensajes de la ventana principal
    if (!event.source || event.source !== window.opener) return;
    
    // Procesar comandos de la ventana principal
    if (event.data && event.data.command) {
      switch (event.data.command) {
        case 'check_status':
          // Enviar estado actual de nuevo a la ventana principal
          const authState = detectAuthenticationStep();
          sendMessageToParent({
            type: 'popup_status',
            url: window.location.href,
            title: document.title,
            hasAuthCode: !!extractAuthCode(),
            authStep: authState.step,
            inMultiStepAuth: authState.inMultiStepAuth
          });
          break;
          
        case 'force_close':
          // Forzar cierre de la ventana
          isClosing = true;
          window.close();
          break;
          
        case 'reset_auth_state':
          // Permitir que la ventana principal reinicie el estado de autenticación
          authAttempted = false;
          authStepCount = 0;
          inMultiStepAuth = false;
          lastAuthStep = '';
          sendMessageToParent({
            type: 'auth_state_reset',
            success: true
          });
          break;
      }
    }
  });
  
  // Función para observar cambios en elementos dinámicos del DOM
  function observeDynamicElements() {
    // Configurar un observador para detectar cambios en el DOM
    const observer = new MutationObserver((mutations) => {
      let shouldProcessAuth = false;
      
      for (const mutation of mutations) {
        // Verificar si se agregaron nodos importantes como formularios o botones
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // Verificar si es un elemento relevante para autenticación
              if (element.tagName === 'FORM' || 
                  element.tagName === 'BUTTON' || 
                  element.tagName === 'INPUT' ||
                  element.getAttribute('role') === 'button') {
                shouldProcessAuth = true;
                break;
              }
              
              // Verificar si contiene elementos relevantes
              if (element.querySelector && 
                  (element.querySelector('input[type="email"]') || 
                   element.querySelector('input[type="password"]') ||
                   element.querySelector('button'))) {
                shouldProcessAuth = true;
                break;
              }
            }
          }
        }
        
        // Verificar cambios en atributos de elementos importantes
        if (mutation.type === 'attributes') {
          const element = mutation.target;
          if (element.tagName === 'INPUT' || element.tagName === 'BUTTON' || 
              element.getAttribute('role') === 'button') {
            // Solo procesar si el elemento es visible
            if (element.offsetParent !== null) {
              shouldProcessAuth = true;
              break;
            }
          }
        }
      }
      
      if (shouldProcessAuth) {
        handlePopupAuth();
      }
    });
    
    // Observar solo elementos relevantes para reducir carga
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'disabled']
    });
    
    return observer;
  }
  
  // Ejecutar cuando la página esté completamente cargada
  if (document.readyState === 'complete') {
    handlePopupAuth();
    observeDynamicElements();
  } else {
    window.addEventListener('load', () => {
      handlePopupAuth();
      observeDynamicElements();
    });
  }
  
  // Monitorear cambios de URL dentro de la ventana emergente
  let lastUrl = window.location.href;
  
  // Monitorear cambios de URL durante autenticación
  const urlCheckInterval = setInterval(() => {
    // Detener monitoreo si estamos cerrando
    if (isClosing) {
      clearInterval(urlCheckInterval);
      return;
    }
    
    // Verificar cambios en la URL
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      
      // Ejecutar manejo de autenticación con cada cambio
      authAttempted = false; // Resetear para permitir procesamiento de la nueva URL
      handlePopupAuth();
    }
  }, 500);
  
  // Establecer timeout de seguridad para cerrar la ventana emergente
  // si permanece abierta demasiado tiempo sin completar autenticación
  setTimeout(() => {
    if (!isClosing && messagesSent === 0) {
      sendMessageToParent({
        type: 'auth_timeout',
        url: window.location.href
      });
      
      // Cerrar ventana emergente
      isClosing = true;
      window.close();
    }
  }, 180000); // 3 minutos
})();
`;

module.exports = { popupAuthHelper };