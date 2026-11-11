// Settings > Plugins (docs/plans/plugins.md): a switch for each installed plugin, and under it, while it is on, the plugin's own rows. The
// page only shows when the build has a plugin. Row ids: `plugin:<id>` for the switch, `plugin:<id>:<setting>` for a plugin's row.
import type {OptionItem} from '../components/SettingsList';
import type {LumenPlugin, PluginSetting} from './api';
import {plugins} from '.';

const PREFIX = 'plugin:';

function settingsOf (p: LumenPlugin): PluginSetting[] {
	if (!p.settings) return [];
	const list = plugins.guard(p, 'settings', () => (p.settings as () => PluginSetting[])(), []);
	return Array.isArray(list) ? list : [];
}

/** The rows of Settings > Plugins. */
export function pluginOptions (): OptionItem[] {
	const rows: OptionItem[] = [];
	plugins.list().forEach((p) => {
		const on = plugins.isOn(p.id);
		const aside = plugins.suspended(p.id);
		rows.push({id: PREFIX + p.id, group: 'plugins', label: p.name, value: on,
			description: p.description + (aside ? ' It failed several times and is set aside until Lumen restarts (the log says why).' : ''),
			valueText: aside ? 'Set aside' : undefined});
		if (!on || aside) return;
		settingsOf(p).forEach((x) => {
			const id = `${PREFIX}${p.id}:${x.id}`;
			const text = (f: (() => string) | undefined) => (f ? plugins.guard(p, 'setting ' + x.id, f, '') : undefined);
			if (x.kind === 'text') {
				const v = plugins.guard(p, 'setting ' + x.id, x.value, '');
				rows.push({id, group: 'plugins', label: x.label, description: x.description, value: v !== '', valueText: text(x.valueText) || v || 'Not set', text: {value: v, placeholder: x.placeholder || ''}});
			} else if (x.kind === 'toggle') {
				rows.push({id, group: 'plugins', label: x.label, description: x.description, value: plugins.guard(p, 'setting ' + x.id, x.value, false)});
			} else {
				rows.push({id, group: 'plugins', label: x.label, description: x.description, value: false, valueText: text(x.valueText) || ''});
			}
		});
	});
	return rows;
}

function find (optionId: string): {p: LumenPlugin; setting: PluginSetting | null} | null {
	if (optionId.indexOf(PREFIX) !== 0) return null;
	const [id, sid] = optionId.slice(PREFIX.length).split(':');
	const p = plugins.list().filter((x) => x.id === id)[0];
	if (!p) return null;
	return {p, setting: sid ? settingsOf(p).filter((x) => x.id === sid)[0] || null : null};
}

/** OK on a row of Settings > Plugins: the switch, a plugin's toggle or action. False when the row is not a plugin's. */
export function pluginOption (optionId: string): boolean {
	const f = find(optionId);
	if (!f) return false;
	const {p, setting} = f;
	if (!setting) plugins.setOn(p.id, !plugins.isOn(p.id));
	else if (setting.kind === 'toggle') { const now = plugins.guard(p, 'setting ' + setting.id, setting.value, false); plugins.guard(p, 'setting ' + setting.id, () => setting.set(!now), undefined); }
	else if (setting.kind === 'action') plugins.guard(p, 'setting ' + setting.id, setting.run, undefined);
	plugins.notify();
	return true;
}

/** A text typed in a plugin's row: an error to show, '' when kept, null when the row is not a plugin's. */
export function pluginText (optionId: string, value: string): string | null {
	const f = find(optionId);
	if (!f || !f.setting || f.setting.kind !== 'text') return null;
	const s = f.setting;
	const error = plugins.guard(f.p, 'setting ' + s.id, () => s.set(value), 'The plugin could not keep it');
	plugins.notify();
	return error || '';
}
