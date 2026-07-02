# CRM WhatsApp Frontend

Frontend de la aplicación `crm-whatsapp-front`, construido con React + Vite para la gestión de chats de WhatsApp en tiempo real.

## Descripción general

Esta aplicación es la interfaz web de Euroman CRM. Permite:

- Iniciar sesión con email y contraseña.
- Mantener sesión con token JWT en almacenamiento persistente.
- Ver y buscar conversaciones activas.
- Enviar mensajes de texto.
- Enviar archivos multimedia.
- Recibir mensajes en tiempo real vía Socket.IO.
- Administrar líneas de WhatsApp y vincular nuevos dispositivos con QR.
- Controlar acceso de usuarios y permisos de administrador.

## Tecnologías principales

- React 19
- Vite 4
- Tailwind CSS 4
- Zustand para estado global persistente
- Axios para llamadas HTTP
- Socket.IO Client para tiempo real
- React Router DOM para navegación
- Emoji Picker React para selección de emojis

## Estructura del proyecto

- `src/main.jsx`: punto de entrada de React.
- `src/App.jsx`: rutas, protección de rutas y el layout principal.
- `src/pages/Login.jsx`: pantalla de login y manejo de formulario.
- `src/pages/Chat.jsx`: interfaz principal para conversaciones y chat.
- `src/pages/Admin.jsx`: panel de administración de cuentas WhatsApp.
- `src/api/axios.js`: instancia de Axios con interceptores para token y 401.
- `src/store/useAuthStore.js`: estado de autenticación con persistencia en localStorage.
- `src/index.css`: estilos globales, scrollbar personalizado y patrón de fondo.
- `tailwind.config.js`: configuración de temas y colores personalizados.
- `vite.config.js`: configuración básica de Vite con plugin React.

## Flujo de la aplicación

1. El usuario ingresa su correo y contraseña en `/login`.
2. El backend responde con token JWT y datos de usuario.
3. El token se guarda en `useAuthStore` y se usa en todas las peticiones Axios.
4. El usuario accede a la página principal `/` donde se cargan conversaciones.
5. Al seleccionar una conversación, se muestran los mensajes y se puede escribir.
6. El frontend recibe eventos en tiempo real mediante Socket.IO.
7. El panel `/admin` permite crear nuevas líneas y visualizar QR para vincularlas.

## Funcionalidades principales

### Autenticación

- Login con `POST /api/auth/login`.
- Persistencia de sesión con `zustand` y `persist`.
- Redirección automática a `/login` si se recibe `401`.
- Rutas privadas protegidas en `App.jsx`.
- `Admin` solo disponible para usuarios con `user.rol === 'admin'`.

### Chat en tiempo real

- Carga de conversaciones con `GET /api/conversaciones`.
- Carga de mensajes con `GET /api/conversaciones/:id/mensajes`.
- Envío de mensajes con `POST /api/messages/send`.
- Envío de archivos con `POST /api/messages/send-media`.
- Notificaciones y actualización de lista de chats en tiempo real.
- Filtro de chats por nombre o teléfono.
- Emoji picker integrado.
- Auto-scroll al final de la conversación.

### Administración de líneas WhatsApp

- Listado de cuentas WhatsApp con sus estados.
- Creación de nuevas cuentas con `POST /api/whatsapp-accounts`.
- Cierre de sesión de cada línea con `POST /api/whatsapp-accounts/:id/logout`.
- Recepción de códigos QR para conexión de dispositivos.
- Manejo de eventos: `qr_generated`, `auth_error`, `status_changed`.

## Variables de entorno

Configura estas variables en un archivo `.env` en la raíz de `crm-whatsapp-front`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

Si no se establecen, el frontend usa estos valores por defecto:

- `http://localhost:3000/api`
- `http://localhost:3000`

## Comandos disponibles

Desde `crm-whatsapp-front`:

- `npm install`: instala dependencias.
- `npm run dev`: inicia el servidor de desarrollo.
- `npm run build`: crea el build de producción.
- `npm run preview`: previsualiza el build.
- `npm run lint`: ejecuta ESLint.

## Requisitos del backend

El frontend espera que el backend implemente al menos estas rutas:

- `POST /api/auth/login`
- `GET /api/whatsapp-accounts`
- `POST /api/whatsapp-accounts`
- `POST /api/whatsapp-accounts/:id/logout`
- `GET /api/conversaciones`
- `GET /api/conversaciones/:id/mensajes`
- `POST /api/messages/send`
- `POST /api/messages/send-media`

Y que el servidor Socket.IO emita eventos:

- `qr_generated`
- `auth_error`
- `status_changed`
- `new_message`
- `message_sent`

## Buenas prácticas y notas

- Mantén la URL del backend configurada en `VITE_API_URL`.
- No hardcodees rutas directamente en componentes.
- Usa el estado global de `useAuthStore` para controlar sesión y logout.
- Modifica `tailwind.config.js` para temas y colores.
- Si agregas nuevas APIs, actualiza `src/api/axios.js` y los componentes afectados.

---

_Proyecto: Euroman CRM Frontend de WhatsApp._
