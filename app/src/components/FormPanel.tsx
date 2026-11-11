// A short form over Films & series, asked for by a plugin's action (plugins/api.ts FormSpec), drawn as the request panel: one of a few
// options (each with a hint), a line of text typed with the TV's keyboard (it may stay empty), Send. Notes under it (what was sent before).
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import type {ComponentChildren} from 'preact';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import type {FormSpec} from '../plugins/api';

interface Props {
	form: FormSpec;
	active: boolean;
	onSend: (option: string, text: string) => void;
	onClose: () => void;
}

export function FormPanel ({form, active, onSend, onClose}: Props) {
	const options = form.options;
	/** rows: the options, then the text, then Send */
	const TEXT = options.length;
	const SEND = TEXT + 1;
	const [at, setAt] = useState(0);
	const [option, setOption] = useState(options.length ? options[0].id : '');
	const [text, setText] = useState('');
	const [typing, setTyping] = useState(false);
	const field = useRef<HTMLInputElement>(null);
	useEffect(() => { if (typing && field.current) field.current.focus(); }, [typing]);

	const send = () => onSend(option, text.trim());
	const handleKey = useCallback((key: NavKey): boolean => {
		if (typing) {
			if (key === 'back' || key === 'down' || key === 'up') {
				setTyping(false);
				if (field.current) field.current.blur();
				if (key !== 'back') setAt(key === 'down' ? SEND : Math.max(0, TEXT - 1));
				return true;
			}
			return false;           // the arrows move the caret, OK is the keyboard's
		}
		if (key === 'back') onClose();
		else if (key === 'up' || key === 'down') setAt((a) => clamp(a + (key === 'down' ? 1 : -1), 0, SEND));
		return true;
	}, [typing, onClose, TEXT, SEND]);
	useKeys(handleKey, active);
	const choose = (i: number) => {
		if (i < TEXT) { setOption(options[i].id); setAt(TEXT); }
		else if (i === TEXT) setTyping(true);
		else send();
	};
	useOkPress({onPress: () => choose(at), onLongPress: () => undefined}, active && !typing);

	const row = (i: number, body: ComponentChildren, cls = '') => (
		<div key={i} class={`media-ask__row${cls}${i === at ? ' media-ask__row--focused' : ''}`} onMouseEnter={() => { if (!typing) setAt(i); }}
			onClick={() => { setAt(i); choose(i); }}>{body}</div>
	);
	return (
		<div class="media-ask">
			<div class="media-ask__box media-form">
				<p class="media-rate__ask">{tr(form.heading)}</p>
				<h2 class="media-ask__title">{form.title}</h2>
				<div class="media-ask__list">
					{options.map((o, i) => row(i, <><span>{tr(o.label)}{o.hint && <em class="media-form__hint">{tr(o.hint)}</em>}</span><span class="media-ask__tick">{option === o.id ? '✓' : ''}</span></>))}
					{row(TEXT, <input ref={field} class="media-form__field" type="text" value={text} maxLength={1000} placeholder={tr(form.placeholder)}
						onInput={(e) => setText((e.target as HTMLInputElement).value)} onBlur={() => setTyping(false)} />)}
					{row(SEND, <span>{tr('Send')}</span>)}
				</div>
				{form.notes && form.notes.length > 0 && (
					<div class="media-form__notes">
						{form.notes.slice(0, 3).map((n, i) => <p key={i} class={`media-form__note${n.tone ? ' media-form__note--' + n.tone : ''}`}>{n.text}</p>)}
					</div>
				)}
			</div>
		</div>
	);
}
