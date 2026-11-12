// The plugin registry (src/plugins/registry.ts) with fake plugins: installing, the switch kept, the hooks, and the isolation (a throw, a
// promise that never settles, a plugin set aside after three failures). Run: npm --prefix app test (Node 22.6 or later).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRegistry} from '../src/plugins/registry.ts';

function memory () {
	const data = {};
	return {data, get: (k) => (k in data ? data[k] : null), set: (k, v) => { if (v === null) delete data[k]; else data[k] = v; }};
}
function setup (opts = {}) {
	const store = memory();
	const logs = [];
	const r = createRegistry({store, log: (id, m) => logs.push(`${id}: ${m}`), timeoutMs: 40, ...opts});
	return {r, store, logs};
}
const ctx = () => ({toast: () => undefined, changed: () => undefined, jellyfin: () => null, store: {get: () => null, set: () => undefined}, t: (x) => x});

/** a fake plugin: a catalog, a choice store, one title action; counts its starts and stops */
function fake (id = 'fake', more = {}) {
	const seen = {starts: 0, stops: 0, rated: []};
	const plugin = {
		id, name: 'Fake', description: 'A plugin for the tests',
		start: () => { seen.starts++; }, stop: () => { seen.stops++; },
		catalog: () => ({
			discover: (onRows) => onRows([{id: 'r', label: 'Row', titles: []}]),
			search: async (text) => [{tmdbId: '1', type: 'movie', title: text, availability: 'none'}],
			title: async (t) => ({tmdbId: t.tmdbId, type: t.type, title: t.title, availability: 'none'}),
			page: async () => ({name: 'Page', rows: []}),
			platforms: async () => [],
			request: async () => true,
			requestsMine: async () => []
		}),
		titleActions: (t) => [{id: 'hello', label: 'Hello ' + t.title, run: async () => ({toast: 'hi'})}],
		rated: (t, score) => { seen.rated.push([t.id, score]); },
		...more
	};
	return {plugin, seen};
}
const title = {type: 'movie', title: 'Alien', tmdbId: '348', here: true};

test('installs a plugin, refuses a bad or taken id', () => {
	const {r} = setup();
	assert.equal(r.register(fake().plugin), true);
	assert.equal(r.register(fake().plugin), false, 'taken');
	assert.equal(r.register(fake('Bad Id').plugin), false);
	assert.equal(r.register(null), false);
	assert.deepEqual(r.list().map((p) => p.id), ['fake']);
});

test('off by default: no hook answers, Lumen stays a plain launcher', () => {
	const {r} = setup();
	r.register(fake().plugin);
	r.startAll(ctx);
	assert.equal(r.isOn('fake'), false);
	assert.equal(r.first('catalog'), null);
	assert.deepEqual(r.titleActions(title), []);
});

test('defaultOn turns it on until the person sets the switch, which is kept', () => {
	const {r, store} = setup();
	const {plugin, seen} = fake('fake', {defaultOn: () => true});
	r.register(plugin);
	r.startAll(ctx);
	assert.equal(r.isOn('fake'), true);
	assert.equal(seen.starts, 1);
	r.setOn('fake', false);
	assert.equal(r.isOn('fake'), false);
	assert.equal(seen.stops, 1);
	assert.deepEqual(JSON.parse(store.data['lumen-plugins-v1']), {fake: false});
	r.setOn('fake', true);
	assert.equal(seen.starts, 2);
});

test('the hooks: the first catalog, every title action, every listener', async () => {
	const {r} = setup();
	const a = fake('a');
	const b = fake('b', {catalog: () => null});
	r.register(a.plugin); r.register(b.plugin);
	r.setOn('a', true); r.setOn('b', true);
	const cat = r.first('catalog');
	assert.ok(cat);
	assert.equal((await cat.search('Alien'))[0].title, 'Alien');
	const actions = r.titleActions(title);
	assert.deepEqual(actions.map((x) => [x.plugin, x.label]), [['a', 'Hello Alien'], ['b', 'Hello Alien']]);
	assert.deepEqual(await actions[0].run(), {toast: 'hi'});
	r.tell('rated', {id: 'x', type: 'Movie', title: 'Alien'}, 8);
	assert.deepEqual(a.seen.rated, [['x', 8]]);
	assert.deepEqual(b.seen.rated, [['x', 8]]);
});

test('a hook that throws is caught: the others still answer', () => {
	const {r, logs} = setup();
	r.register(fake('bad', {titleActions: () => { throw new Error('boom'); }}).plugin);
	r.register(fake('good').plugin);
	r.setOn('bad', true); r.setOn('good', true);
	assert.deepEqual(r.titleActions(title).map((x) => x.plugin), ['good']);
	assert.ok(logs.some((l) => /bad: titleActions: boom/.test(l)));
});

test('a catalog function that throws gives a rejected promise, not a crash', async () => {
	const {r} = setup();
	const {plugin} = fake('fake', {catalog: () => ({...fake().plugin.catalog(), search: () => { throw new Error('nope'); }})});
	r.register(plugin); r.setOn('fake', true);
	await assert.rejects(r.first('catalog').search('x'), /nope/);
});

test('a promise that never settles is cut after the timeout', async () => {
	const {r, logs} = setup();
	const {plugin} = fake('slow', {catalog: () => ({...fake().plugin.catalog(), search: () => new Promise(() => undefined)})});
	r.register(plugin); r.setOn('slow', true);
	await assert.rejects(r.first('catalog').search('x'), /did not answer/);
	assert.ok(logs.some((l) => /slow: catalog.search: no answer/.test(l)));
});

test('its own rejection (a server off) passes through and is not counted', async () => {
	const {r} = setup();
	const {plugin} = fake('off', {catalog: () => ({...fake().plugin.catalog(), search: () => Promise.reject(new Error('server off'))})});
	r.register(plugin); r.setOn('off', true);
	for (let i = 0; i < 5; i++) await assert.rejects(r.first('catalog').search('x'), /server off/);
	assert.equal(r.suspended('off'), false);
});

test('three failures set the plugin aside until Lumen restarts', () => {
	const {r, logs} = setup();
	let changes = 0;
	r.subscribe(() => { changes++; });
	r.register(fake('flaky', {titleActions: () => { throw new Error('again'); }}).plugin);
	r.setOn('flaky', true);
	for (let i = 0; i < 3; i++) r.titleActions(title);
	assert.equal(r.suspended('flaky'), true);
	assert.equal(r.first('catalog'), null, 'its other hooks are off too');
	assert.ok(logs.some((l) => /set aside/.test(l)));
	assert.ok(changes >= 2, 'the screens hear it');
	assert.equal(r.isOn('flaky'), true, 'the person\'s switch is not changed');
});

test('the screens hear when the plugins have started (what they read before may change)', () => {
	const {r} = setup();
	let heard = 0;
	r.subscribe(() => { heard++; });
	r.register(fake('fake', {defaultOn: () => true}).plugin);
	r.startAll(ctx);
	assert.equal(heard, 1);
});

test('a start that throws does not stop Lumen starting the others', () => {
	const {r} = setup();
	const good = fake('good', {defaultOn: () => true});
	r.register(fake('bad', {defaultOn: () => true, start: () => { throw new Error('no'); }}).plugin);
	r.register(good.plugin);
	r.startAll(ctx);
	assert.equal(good.seen.starts, 1);
});

test('the library: the first plugin that gives one; its read is shielded, a failure reaches Lumen, which reads Jellyfin', async () => {
	const {r} = setup();
	const rows = {resume: [{id: 'e1', type: 'Episode', title: 'A Series', genres: []}], latest: [], movies: [], series: []};
	r.register(fake('none').plugin);
	r.register(fake('lib', {library: () => ({read: () => Promise.resolve(rows)})}).plugin);
	r.register(fake('down', {library: () => ({read: () => Promise.reject(new Error('off'))})}).plugin);
	r.setOn('none', true); r.setOn('lib', true); r.setOn('down', true);
	assert.deepEqual(await r.first('library').read(), rows);
	r.setOn('lib', false);
	await assert.rejects(r.first('library').read(), /off/);
	r.setOn('down', false);
	assert.equal(r.first('library'), null);
});
