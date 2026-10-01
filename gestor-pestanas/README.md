# Gestor de Pestañas Inteligente

Extensión de Chrome (Manifest V3) para poner orden cuando tienes demasiadas pestañas abiertas.

## Funciones

- **Agrupar por tema**: crea grupos de colores como Desarrollo, Trabajo, Redes, Video y música, Compras, Noticias y Otros, según el sitio.
- **Agrupar por dominio**: junta en un grupo las pestañas del mismo sitio (por ejemplo, todas las de `github.com`).
- **Desagrupar** todo con un clic.
- **Cerrar duplicadas**: cierra las pestañas con la misma dirección y conserva la que estás viendo.
- **Cerrar inactivas**: cierra las pestañas que llevan 1, 3, 7 o 14 días sin usarse. Antes las guarda como sesión para que no pierdas nada.
- **Buscar** entre todas las pestañas abiertas, saltar a una con un clic o cerrarla.
- **Sesiones con nombre**: guarda la ventana actual (por ejemplo "Trabajo") y ábrela de nuevo cuando quieras.
- **Limpieza automática** (opcional): cada hora cierra las pestañas inactivas según el número de días que elijas.
- **Contador** de pestañas en el icono, que se pone en rojo cuando pasas de 30.
- **Atajos de teclado**: `Alt+Shift+G` agrupa por tema y `Alt+Shift+D` cierra duplicadas.

## Instalación

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` en Chrome.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y elige la carpeta `gestor-pestanas`.
5. Fija la extensión en la barra de Chrome (icono de la pieza de puzle) para tenerla a mano.

## Personalizar los temas

Los sitios de cada tema están en la lista `TOPICS` de [`tabs.js`](tabs.js). Puedes añadir dominios o crear temas nuevos. Los colores válidos son `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan` y `orange`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `manifest.json` | Configuración y permisos de la extensión |
| `tabs.js` | Lógica compartida: agrupar, cerrar, sesiones y ajustes |
| `background.js` | Service worker: contador, limpieza automática y atajos |
| `popup.html` / `popup.css` / `popup.js` | Ventana que se abre al pulsar el icono |
| `icons/` | Iconos de la extensión |

## Privacidad

Todo se queda en tu navegador (`chrome.storage.local`). La extensión no envía datos a ningún servidor.
