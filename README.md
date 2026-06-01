# Desarrollo de ambiente local - chatbot de prueba

![Made with Love](https://img.shields.io/badge/Made%20with-Love-pink?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyByb2xlPSJpbWciIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+R2l0SHViIFNwb25zb3JzIGljb248L3RpdGxlPjxwYXRoIGQ9Ik0xNy42MjUgMS40OTljLTIuMzIgMC00LjM1NCAxLjIwMy01LjYyNSAzLjAzLTEuMjcxLTEuODI3LTMuMzA1LTMuMDMtNS42MjUtMy4wM0MzLjEyOSAxLjQ5OSAwIDQuMjUzIDAgOC4yNDljMCA0LjI3NSAzLjA2OCA3Ljg0NyA1LjgyOCAxMC4yMjdhMzMuMTQgMzMuMTQgMCAwIDAgNS42MTYgMy44NzZsLjAyOC4wMTcuMDA4LjAwMy0uMDAxLjAwM2MuMTYzLjA4NS4zNDIuMTI2LjUyMS4xMjUuMTc5LjAwMS4zNTgtLjA0MS41MjEtLjEyNWwtLjAwMS0uMDAzLjAwOC0uMDAzLjAyOC0uMDE3YTMzLjE0IDMzLjE0IDAgMCAwIDUuNjE2LTMuODc2QzIwLjkzMiAxNi4wOTYgMjQgMTIuNTI0IDI0IDguMjQ5YzAtMy45OTYtMy4xMjktNi43NS02LjM3NS02Ljc1em0tLjkxOSAxNS4yNzVhMzAuNzY2IDMwLjc2NiAwIDAgMS00LjcwMyAzLjMxNmwtLjAwNC0uMDAyLS4wMDQuMDAyYTMwLjk1NSAzMC45NTUgMCAwIDEtNC43MDMtMy4zMTZjLTIuNjc3LTIuMzA3LTUuMDQ3LTUuMjk4LTUuMDQ3LTguNTIzIDAtMi43NTQgMi4xMjEtNC41IDQuMTI1LTQuNSAyLjA2IDAgMy45MTQgMS40NzkgNC41NDQgMy42ODQuMTQzLjQ5NS41OTYuNzk3IDEuMDg2Ljc5Ni40OS4wMDEuOTQzLS4zMDIgMS4wODUtLjc5Ni42My0yLjIwNSAyLjQ4NC0zLjY4NCA0LjU0NC0zLjY4NCAyLjAwNCAwIDQuMTI1IDEuNzQ2IDQuMTI1IDQuNSAwIDMuMjI1LTIuMzcgNi4yMTYtNS4wNDggOC41MjN6Ii8+PC9zdmc+)


## Instrucciones

### Backend

Para levantar y correr el backend es necesario seguir los siguientes pasos:

1. Asegurarse de que se tienen todas las variables en el archivo **backend/.env** y tener Node.js instalado.
2. Generar una clave local para cifrar mensajes:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Copia ese valor en `backend/.env` como `MESSAGE_ENC_KEY_V1`.
3. Generar un secreto separado para firmar tokens de autenticación:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  ```
  Copia ese valor en `backend/.env` como `AUTH_TOKEN_SECRET`.
4. Luego movernos a la carpeta _backend_ e instalar las dependencias con `pnpm`:
   ```bash
   cd backend
   pnpm install
   ```
5. Finalmente correr el backend con el comando:
  ```bash
  pnpm start
  ```
6. Para probar que el backend recibe con éxito mensajes del llm usamos:
  ```bash
  pnpm demo
  ```

El backend guarda las conversaciones en MongoDB con el contenido cifrado en reposo. El texto plano solo vive en memoria el tiempo necesario para consultar al LLM.

Las colecciones de riesgo `risk_assessments` y `risk_alerts` también se guardan cifradas en reposo; solo permanecen en claro los metadatos necesarios para búsquedas y auditoría.

## Desarrolladores

- Rosa Ramirez [@rvduque](https://github.com/rvduque) (Carnet 20-10527).
- Luis Isea [@lmisea](https://github.com/lmisea) (Carnet 19-10175).
- Gabriel Seijas [@GabrielJSeijas](https://github.com/GabrielJSeijas)(Carnet 19-10036).
- Alejandra Mármol (Carnet 20-10408).
- Ángel Valero [@Ange1uchi](https://github.com/Ange1uchi) (Carnet 18-10436).
