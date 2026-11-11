// The plugin registry (docs/plans/plugins.md): which plugins are installed, which are on, and every call into one, guarded. Plain
// TypeScript with nothing of the TV in it (the storage and the log are given), so test/plugins.test.mjs runs it under node.
//
// Isolation: a plugin's hook that throws is caught (the screen goes on without it), a promise that has not settled after `timeoutMs` is
// rejected, and after `maxFailures` throws or timeouts the plugin is set aside until Lumen restarts. A promise that rejects is the
// plugin's own answer (its server is off) and is not counted.
import type {LumenPlugin, PluginContext} from './api';

export interface Store { get: (key: string) => string | null; set: (key: string, value: string | null) => void }
export interface RegistryOptions {
	store: Store;
	log?: (pluginId: string, message: string) => void;
	/** a call that takes longer is cut (default 20 s) */
	timeoutMs?: number;
	/** throws or timeouts before a plugin is set aside for the session (default 3) */
	maxFailures?: number;
}

const ID = /^[a-z0-9-]{1,40}$/;
const ON_KEY = 'lumen-plugins-v1';

type HookName = 'catalog' | 'choices' | 'titleActions' | 'rated' | 'foreground';

export type Registry = ReturnType<typeof createRegistry>;

export function createRegistry (o: RegistryOptions) {
	const timeout = o.timeoutMs || 20000;
	const maxFailures = o.maxFailures || 3;
	const log = o.log || (() => undefined);
	const installed: LumenPlugin[] = [];
	const failures: Record<string, number> = {};
	const started: Record<string, true> = {};
	const listeners = new Set<() => void>();
	let contextFor: ((p: LumenPlugin) => PluginContext) | null = null;

	const switches = (): Record<string, boolean> => {
		try { return JSON.parse(o.store.get(ON_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
	};
	const notify = () => listeners.forEach((f) => { try { f(); } catch { /* a listener's own problem */ } });

	function failed (p: LumenPlugin, what: string, e: unknown): void {
		failures[p.id] = (failures[p.id] || 0) + 1;
		log(p.id, `${what}: ${e instanceof Error ? e.message : String(e)}`);
		if (failures[p.id] === maxFailures) { log(p.id, `set aside until Lumen restarts (${maxFailures} failures)`); notify(); }
	}
	const suspended = (p: LumenPlugin) => (failures[p.id] || 0) >= maxFailures;

	function isOn (id: string): boolean {
		const p = installed.filter((x) => x.id === id)[0];
		if (!p) return false;
		const s = switches();
		if (id in s) return s[id];
		return guard(p, 'defaultOn', () => !!(p.defaultOn && p.defaultOn()), false);
	}

	/** Runs a plugin's code: a throw is caught, logged and counted; the fallback is returned instead. */
	function guard<T> (p: LumenPlugin, what: string, fn: () => T, fallback: T): T {
		try { return fn(); } catch (e) { failed(p, what, e); return fallback; }
	}

	/** A plugin's promise, cut after the timeout (counted as a failure); its own rejection passes through, not counted. */
	function settle<T> (p: LumenPlugin, what: string, promise: Promise<T>): Promise<T> {
		return new Promise<T>((done, fail) => {
			let over = false;
			const timer = setTimeout(() => { over = true; failed(p, what, new Error(`no answer after ${timeout} ms`)); fail(new Error(`${p.name} did not answer`)); }, timeout);
			promise.then((v) => { if (!over) { clearTimeout(timer); done(v); } }, (e) => { if (!over) { clearTimeout(timer); fail(e); } });
		});
	}

	/** An object a plugin gave (a catalog, a store, an action): each of its functions guarded, each promise cut after the timeout. A sync throw
	 *  in a function that should give a promise becomes a rejected promise. */
	function shield<T extends object> (p: LumenPlugin, what: string, obj: T): T {
		const out = {} as Record<string, unknown>;
		Object.keys(obj).forEach((k) => {
			const v = (obj as Record<string, unknown>)[k];
			if (typeof v !== 'function') { out[k] = v; return; }
			out[k] = (...args: unknown[]) => {
				let r: unknown;
				try { r = (v as (...a: unknown[]) => unknown).apply(obj, args); } catch (e) { failed(p, `${what}.${k}`, e); return Promise.reject(e); }
				return r && typeof (r as Promise<unknown>).then === 'function' ? settle(p, `${what}.${k}`, r as Promise<unknown>) : r;
			};
		});
		return out as T;
	}

	function start (p: LumenPlugin): void {
		if (started[p.id] || !contextFor || !isOn(p.id) || suspended(p)) return;
		started[p.id] = true;
		const ctx = contextFor(p);
		const r = guard(p, 'start', () => (p.start ? p.start(ctx) : undefined), undefined);
		if (r && typeof (r as Promise<void>).then === 'function') settle(p, 'start', r as Promise<void>).catch(() => undefined);
	}
	function stop (p: LumenPlugin): void {
		if (!started[p.id]) return;
		delete started[p.id];
		guard(p, 'stop', () => (p.stop ? p.stop() : undefined), undefined);
	}

	const active = (): LumenPlugin[] => installed.filter((p) => isOn(p.id) && !suspended(p));

	return {
		/** Adds a plugin (the build's list, at start). False for a bad or taken id. */
		register (p: LumenPlugin): boolean {
			if (!p || typeof p !== 'object' || !ID.test(p.id) || installed.some((x) => x.id === p.id)) { log(p && p.id || '?', 'not installed: a bad or taken id'); return false; }
			installed.push(p);
			start(p);
			return true;
		},
		/** every installed plugin, on or off */
		list: (): LumenPlugin[] => installed.slice(),
		isOn,
		/** the plugin is set aside for this session */
		suspended: (id: string): boolean => installed.some((p) => p.id === id && suspended(p)),
		/** the person's switch in Settings > Plugins: kept, and the plugin started or stopped */
		setOn (id: string, on: boolean): void {
			const p = installed.filter((x) => x.id === id)[0];
			if (!p) return;
			o.store.set(ON_KEY, JSON.stringify({...switches(), [id]: on}));
			if (on) start(p); else stop(p);
			notify();
		},
		/** starts every plugin that is on, with the context each one gets (Lumen calls it once, at start) */
		startAll (ctx: (p: LumenPlugin) => PluginContext): void { contextFor = ctx; installed.forEach(start); notify(); },
		active,
		guard,
		shield,

		/** The first active plugin's answer to a hook that gives one object (a catalog, a choice store), shielded; null when none gives one. */
		first<K extends 'catalog' | 'choices'> (hook: K): ReturnType<NonNullable<LumenPlugin[K]>> | null {
			for (const p of active()) {
				const fn = p[hook];
				if (!fn) continue;
				const got = guard(p, hook, () => (fn as () => object | null)(), null);
				if (got) return shield(p, hook, got) as ReturnType<NonNullable<LumenPlugin[K]>>;
			}
			return null;
		},
		/** Every active plugin's title actions, each one's `run` shielded. */
		titleActions (t: Parameters<NonNullable<LumenPlugin['titleActions']>>[0]) {
			const all: {plugin: string; id: string; label: string; run: () => Promise<import('./api').ActionResult>}[] = [];
			active().forEach((p) => {
				if (!p.titleActions) return;
				const list = guard(p, 'titleActions', () => (p.titleActions as NonNullable<LumenPlugin['titleActions']>)(t), []);
				(Array.isArray(list) ? list : []).forEach((a) => {
					if (a && typeof a.label === 'string' && typeof a.run === 'function') all.push({plugin: p.id, ...shield(p, 'action ' + a.id, a)});
				});
			});
			return all;
		},
		/** Tells every active plugin (a score given, Lumen back to the front); what they do is theirs, and cannot stop Lumen. */
		tell<K extends 'rated' | 'foreground'> (hook: K, ...args: Parameters<NonNullable<LumenPlugin[K]>>): void {
			active().forEach((p) => {
				const fn = p[hook] as ((...a: unknown[]) => unknown) | undefined;
				if (!fn) return;
				const r = guard(p, hook, () => fn.apply(p, args), undefined);
				if (r && typeof (r as Promise<unknown>).then === 'function') settle(p, hook, r as Promise<unknown>).catch(() => undefined);
			});
		},
		subscribe (f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; },
		notify
	};
}

export type {HookName};
