#!/usr/bin/env node
// Runs the browser checks against the built calculator: builds dist/ (with the test games), serves it on
// port 8080 and runs each file here with Playwright. Usage: node test/browser/run.js [name ...]
// Needs `playwright` to be installed (it is not one of the project's dependencies).
const {spawn, spawnSync} = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '../..');
const only = process.argv.slice(2);
const tests = fs.readdirSync(__dirname).filter(file => /\.js$/.test(file) && file !== 'lib.js' && file !== 'run.js')
	.filter(file => !only.length || only.indexOf(file.replace(/\.js$/, '')) !== -1).sort();

const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = http.createServer((request, response) => {
	const file = path.join(root, 'dist', decodeURIComponent(request.url.split('?')[0]));
	fs.readFile(file, (error, data) => {
		if (error) {
			response.writeHead(404);
			response.end();
			return;
		}
		response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
		response.end(data);
	});
});

function run(file) {
	return new Promise(resolve => {
		const child = spawn(process.execPath, [path.join(__dirname, file)], {cwd: root});
		let output = '';
		const timer = setTimeout(() => child.kill(), 300000);
		child.stdout.on('data', data => { output += data; });
		child.stderr.on('data', data => { output += data; });
		child.on('close', code => {
			clearTimeout(timer);
			const passed = code === 0 && /all passed\s*$/.test(output);
			console.log((passed ? 'ok    ' : 'FAIL  ') + file);
			if (!passed) console.log(output.split('\n').filter(line => !/^ok /.test(line)).join('\n'));
			resolve(passed);
		});
	});
}

(async () => {
	const build = spawnSync(process.execPath, ['build', 'view', '--test-games'], {cwd: root, encoding: 'utf8'});
	if (build.status !== 0) {
		console.error(build.stdout + build.stderr);
		process.exit(1);
	}
	const own = await new Promise(resolve => {
		server.once('error', () => resolve(false)); // something already serves dist/ there
		server.listen(8080, () => resolve(true));
	});
	let failed = 0;
	for (const file of tests) {
		if (!await run(file)) failed++;
	}
	if (own) server.close();
	console.log(failed ? failed + ' of ' + tests.length + ' failed' : 'all ' + tests.length + ' passed');
	process.exit(failed ? 1 : 0);
})();
