const port = Number(process.env.DEMO_PORT || 8010);
const old_port = process.env.PORT;
process.env.PORT = port;
process.env.SUPPRESS_STARTUP_LOGS = 'true';

console.log('Corriendo Backend...');

try {
  await import('./index.js');
} catch (error) {
  console.error('Error arrancando el backend:');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
  throw error;
}

const baseUrl = `http://127.0.0.1:${port}`;
const timeoutMs = 20000;

async function waitForHealthCheck() {
	const startedAt = Date.now();
	console.log('Esperando que el backend quede disponible...');

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(`${baseUrl}/health`);

			if (response.ok) {
				console.log('Backend conectado exitosamente.');
				return;
			}

			console.error(`Health check respondió con status ${response.status}.`);
			console.error(await response.text());
		} catch {
			console.log('Backend todavía no responde, reintentando...');
		}

		await new Promise(resolve => setTimeout(resolve, 500));
	}

	throw new Error('El backend no estuvo listo a tiempo.');
}

async function runDemo() {
	try {
		await waitForHealthCheck();
	} catch (error) {
		console.error('Error esperando al backend:');
		console.error(error?.stack || error?.message || error);
		throw error;
	}

	console.log('Mandando un mensaje de prueba con contenido "holaa"');

	const unique = Date.now();
	const email = `demo-${unique}@blossom.dev`;
	const password = 'DemoPass1234';
	let token;

	try {
		const registerResponse = await fetch(`${baseUrl}/auth/register`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				email,
				password,
				displayName: 'Demo User',
			}),
		});

		const registerJson = await registerResponse.json();

		if (!registerResponse.ok) {
			throw new Error(registerJson?.error || 'No se pudo registrar usuario demo.');
		}

		token = registerJson?.token;
	} catch (error) {
		console.error('Error creando usuario demo:');
		console.error(error?.stack || error?.message || error);
		throw error;
	}

	let response;

	try {
		response = await fetch(`${baseUrl}/chat`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ message: 'holaa' }),
		});
	} catch (error) {
		console.error('Error enviando el mensaje de prueba:');
		console.error(error?.stack || error?.message || error);
		throw error;
	}

	let body;

	try {
		body = await response.text();
	} catch (error) {
		console.error('Error leyendo la respuesta del backend:');
		console.error(error?.stack || error?.message || error);
		throw error;
	}

	if (!response.ok) {
		console.error(`El backend respondió con error ${response.status}.`);
		console.error(body);
		throw new Error('La demo no pudo completar la solicitud al chat.');
	}

	console.log('Mensaje respondido con éxito, la respuesta es:');
	console.log(body);
}

async function main() {
	try {
		await runDemo();
	} catch (error) {
		console.error('Demo finalizada con error:');
		console.error(error?.stack || error?.message || error);
		process.exitCode = 1;
	} finally {
    process.env.SUPPRESS_STARTUP_LOGS = 'false';
    process.env.PORT = Number(old_port);
		console.log('Cerrando backend de demo...');
		await globalThis.__backendShutdown?.('DEMO_FINISH');
		process.exit(process.exitCode ?? 0);
	}
}

main().catch(error => {
	console.error('Error inesperado en la demo:');
	console.error(error?.stack || error?.message || error);
	process.exitCode = 1;
	process.exit(1);
});
